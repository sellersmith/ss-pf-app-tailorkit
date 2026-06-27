/**
 * Daily export of Elva conversations from MongoDB to Supabase staging table
 * `auto_improve_elva_conversations_export`.
 *
 * Per-conversation aggregation (not per-message): one row per conversationId,
 * concatenating redacted user + assistant messages, attaching explicit + implicit
 * feedback events, and computing an abandonment heuristic.
 *
 * Consumed by the weekly `/elva-auto-improve` skill (conversation-driven discovery loop).
 *
 * Plan: plans/260512-1538-EMTLKIT-5336-elva-conversation-discovery-loop/phase-01-conversation-export.md
 */
import supabaseClient from '~/utils/supabase-client.server'
import { ConversationMessageModel } from '~/models/ConversationMessage.server'
import ElvaFeedback from '~/models/ElvaFeedback.server'
import { redactPii } from '~/utils/pii-redact.server'

const TABLE = 'auto_improve_elva_conversations_export'

// 14d lookback — captures conversations whose most recent message falls in window.
const LOOKBACK_MS = 14 * 24 * 60 * 60_000
// Cap to bound payload + Mongo query cost; warn via return value if hit.
const MAX_CONVERSATIONS = 2000
// PostgREST friendly chunk size.
const UPSERT_CHUNK = 200
// Truncate concat strings above this byte length (Supabase row size guard).
const MAX_CONCAT_BYTES = 64 * 1024
const TRUNCATION_MARKER = '\n...[truncated]'
const MESSAGE_DELIMITER = '\n---\n'
// 24h after last assistant message with no user reply → abandoned.
const ABANDON_THRESHOLD_MS = 24 * 60 * 60_000

interface FeedbackEvent {
  type: 'explicit' | 'implicit'
  signal: string
  message_idx: number
  at: string
}

interface ConversationRow {
  conversation_id: string
  shop_domain: string
  started_at: string
  last_message_at: string
  message_count: number
  user_message_count: number
  user_messages_concat: string | null
  assistant_messages_concat: string | null
  kb_rows_cited: string[]
  feedback_events: FeedbackEvent[]
  feedback_negative_count: number
  feedback_positive_count: number
  abandoned: boolean
}

export interface SyncElvaConversationsResult {
  skipped?: boolean
  reason?: string
  upserted?: number
  conversations?: number
  capHit?: boolean
}

// Kill switch — entire auto-improve pipeline disabled when false.
// TODO: migrate to `process.env.ELVA_AUTO_IMPROVE_ENABLED === 'true'` once validated end-to-end.
const ELVA_AUTO_IMPROVE_ENABLED = true

export async function syncElvaConversationsExport(): Promise<SyncElvaConversationsResult> {
  if (!ELVA_AUTO_IMPROVE_ENABLED) {
    return { skipped: true, reason: 'kill switch' }
  }

  const since = new Date(Date.now() - LOOKBACK_MS)

  // Step 1: distinct conversationIds with at least one message inside window.
  const recentConvoIds = (await ConversationMessageModel.distinct('conversationId', {
    timestamp: { $gte: since },
  })) as string[]

  if (recentConvoIds.length === 0) {
    return { upserted: 0, conversations: 0 }
  }

  const capHit = recentConvoIds.length > MAX_CONVERSATIONS
  const convoIds = capHit ? recentConvoIds.slice(0, MAX_CONVERSATIONS) : recentConvoIds

  const rows: ConversationRow[] = []
  for (const batch of chunkArray(convoIds, 100)) {
    const batchRows = await Promise.all(batch.map(buildConversationRow))
    for (const r of batchRows) {
      if (r) rows.push(r)
    }
  }

  if (rows.length === 0) {
    return { upserted: 0, conversations: convoIds.length, capHit }
  }

  let upserted = 0
  for (const chunk of chunkArray(rows, UPSERT_CHUNK)) {
    const { error } = await supabaseClient.from(TABLE).upsert(chunk, { onConflict: 'conversation_id' })
    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`)
    }
    upserted += chunk.length
  }

  return { upserted, conversations: convoIds.length, capHit }
}

async function buildConversationRow(conversationId: string): Promise<ConversationRow | null> {
  const [messages, implicitFeedback] = await Promise.all([
    ConversationMessageModel.find({ conversationId }).sort({ timestamp: 1 }).lean(),
    ElvaFeedback.find({ conversationId }).lean(),
  ])

  if (!messages || messages.length === 0) return null

  const shopDomain = (messages[0] as any).shopDomain ?? 'unknown'
  const startedAt = new Date((messages[0] as any).timestamp)
  const lastMessage = messages[messages.length - 1] as any
  const lastMessageAt = new Date(lastMessage.timestamp)

  // PII redaction MUST run per-message BEFORE concat to prevent cross-message PII bleed
  // (e.g., partial-token regexes anchored to message boundaries can leak when concatenated).
  const userMessages: string[] = []
  const assistantMessages: string[] = []
  const kbRowsCited = new Set<string>()
  const feedbackEvents: FeedbackEvent[] = []
  let negCount = 0
  let posCount = 0
  let userMessageCount = 0

  messages.forEach((m: any, idx: number) => {
    const role = String(m.role ?? '')
    const content = redactPii(String(m.content ?? ''))
    if (role === 'user') {
      userMessages.push(content)
      userMessageCount += 1
    } else {
      assistantMessages.push(content)
    }

    const cited = extractKbRowsCited(m.metadata)
    cited.forEach(id => kbRowsCited.add(id))

    if (m.feedback) {
      const signal = String(m.feedback)
      feedbackEvents.push({
        type: 'explicit',
        signal,
        message_idx: idx,
        at: new Date(m.lastUpdated ?? m.timestamp).toISOString(),
      })
      if (isNegativeSignal(signal)) negCount += 1
      else if (isPositiveSignal(signal)) posCount += 1
    }
  })

  // Implicit feedback: tie each event to its closest message by messageId match,
  // fall back to the last message index when unknown.
  const idToIdx = new Map<string, number>()
  messages.forEach((m: any, idx: number) => {
    if (m.id) idToIdx.set(String(m.id), idx)
  })
  implicitFeedback.forEach((f: any) => {
    const idx = (f.messageId && idToIdx.get(String(f.messageId))) ?? messages.length - 1
    const signal = String(f.signal ?? '')
    feedbackEvents.push({
      type: 'implicit',
      signal,
      message_idx: idx,
      at: new Date(f.createdAt ?? Date.now()).toISOString(),
    })
    if (isNegativeSignal(signal)) negCount += 1
    else if (isPositiveSignal(signal)) posCount += 1
    if (Array.isArray(f.kbRowsCited)) {
      f.kbRowsCited.forEach((id: any) => kbRowsCited.add(String(id)))
    }
  })

  const abandoned
    = String(lastMessage.role ?? '') === 'assistant' && Date.now() - lastMessageAt.getTime() > ABANDON_THRESHOLD_MS

  return {
    conversation_id: conversationId,
    shop_domain: shopDomain,
    started_at: startedAt.toISOString(),
    last_message_at: lastMessageAt.toISOString(),
    message_count: messages.length,
    user_message_count: userMessageCount,
    user_messages_concat: truncate(userMessages.join(MESSAGE_DELIMITER)),
    assistant_messages_concat: truncate(assistantMessages.join(MESSAGE_DELIMITER)),
    kb_rows_cited: Array.from(kbRowsCited),
    feedback_events: feedbackEvents,
    feedback_negative_count: negCount,
    feedback_positive_count: posCount,
    abandoned,
  }
}

function isNegativeSignal(s: string): boolean {
  return s === 'unhelpful' || s === 'implicit_down' || s === 'dislike'
}

function isPositiveSignal(s: string): boolean {
  return s === 'helpful' || s === 'implicit_up' || s === 'like'
}

function extractKbRowsCited(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const cited = (metadata as Record<string, unknown>).kbRowsCited
  return Array.isArray(cited) ? cited.map(String) : []
}

function truncate(s: string): string | null {
  if (!s) return null
  const bytes = Buffer.byteLength(s, 'utf8')
  if (bytes <= MAX_CONCAT_BYTES) return s
  // Binary search for the largest char-length whose UTF-8 byte length fits.
  const headroom = MAX_CONCAT_BYTES - Buffer.byteLength(TRUNCATION_MARKER, 'utf8')
  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    if (Buffer.byteLength(s.slice(0, mid), 'utf8') <= headroom) lo = mid
    else hi = mid - 1
  }
  return s.slice(0, lo) + TRUNCATION_MARKER
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
