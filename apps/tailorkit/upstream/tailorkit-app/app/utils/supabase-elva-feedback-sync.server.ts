/**
 * Hourly export of Elva feedback (explicit + implicit) from MongoDB to Supabase
 * staging table `auto_improve_elva_feedback_export`.
 *
 * Pulled from `app/routes/api.public.background-processes/route.tsx` Promise.allSettled.
 * Local Claude Code routine reads this table to drive the auto-improvement loop.
 *
 * Plan: plans/260506-0932-EMTLKIT-5333-elva-auto-improve-loop/phase-01-server-side-export.md
 */
import supabaseClient from '~/utils/supabase-client.server'
import { ConversationMessageModel } from '~/models/ConversationMessage.server'
import ElvaFeedback from '~/models/ElvaFeedback.server'
import { redactPii } from '~/utils/pii-redact.server'
import { FeedbackType } from '~/enums/conversationMessage'

const TABLE = 'auto_improve_elva_feedback_export'
// 1h cron interval + 30min buffer for late-written records
const LOOKBACK_MS = 90 * 60_000
const MAX_PER_SOURCE = 500
const UPSERT_CHUNK = 200

interface ExportRow {
  id: string
  shop_domain: string
  conversation_id: string
  user_message: string | null
  assistant_message: string | null
  feedback: string
  feedback_source: 'explicit' | 'implicit'
  kb_rows_cited: string[]
  trigger_keywords: string[]
  next_user_message: string | null
  message_created_at: string
}

export interface SyncElvaFeedbackResult {
  skipped?: boolean
  reason?: string
  upserted?: number
  explicit?: number
  implicit?: number
}

// Kill switch — entire auto-improve pipeline disabled when false.
// TODO: migrate back to `process.env.ELVA_AUTO_IMPROVE_ENABLED === 'true'` once the loop has been validated end-to-end in production.
const ELVA_AUTO_IMPROVE_ENABLED = true

export async function syncElvaFeedbackExport(): Promise<SyncElvaFeedbackResult> {
  if (!ELVA_AUTO_IMPROVE_ENABLED) {
    return { skipped: true, reason: 'kill switch' }
  }

  const since = new Date(Date.now() - LOOKBACK_MS)

  const [explicit, implicit] = await Promise.all([
    ConversationMessageModel.find({
      feedback: { $in: Object.values(FeedbackType) },
      timestamp: { $gte: since },
    })
      .limit(MAX_PER_SOURCE)
      .lean(),
    ElvaFeedback.find({ createdAt: { $gte: since } })
      .limit(MAX_PER_SOURCE)
      .lean(),
  ])

  const explicitRows: ExportRow[] = explicit.map(m => ({
    id: `expl-${m.id}`,
    shop_domain: m.shopDomain,
    conversation_id: m.conversationId,
    // user_message context not loaded here — Phase 3 cluster engine fetches lazily
    user_message: null,
    assistant_message: redactPii(String(m.content ?? '')),
    feedback: String(m.feedback),
    feedback_source: 'explicit',
    kb_rows_cited: extractKbRowsCited(m.metadata),
    trigger_keywords: [],
    next_user_message: null,
    message_created_at: new Date(m.timestamp).toISOString(),
  }))

  const implicitRows: ExportRow[] = implicit.map((f: any) => ({
    id: `impl-${String(f._id)}`,
    shop_domain: f.shopDomain ?? 'unknown',
    conversation_id: f.conversationId,
    user_message: null,
    assistant_message: redactPii(String(f.replyText ?? '')),
    feedback: String(f.signal),
    feedback_source: 'implicit',
    kb_rows_cited: Array.isArray(f.kbRowsCited) ? f.kbRowsCited.map(String) : [],
    trigger_keywords: Array.isArray(f.triggerKeywords) ? f.triggerKeywords.map(String) : [],
    // ElvaFeedback already redacts + truncates nextUserMessage on write
    next_user_message: f.nextUserMessage ?? null,
    message_created_at: new Date(f.createdAt).toISOString(),
  }))

  const rows = [...explicitRows, ...implicitRows]
  if (rows.length === 0) {
    return { upserted: 0, explicit: 0, implicit: 0 }
  }

  let upserted = 0
  for (const chunk of chunkArray(rows, UPSERT_CHUNK)) {
    const { error } = await supabaseClient.from(TABLE).upsert(chunk, { onConflict: 'id' })
    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`)
    }
    upserted += chunk.length
  }

  return { upserted, explicit: explicitRows.length, implicit: implicitRows.length }
}

function extractKbRowsCited(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const cited = (metadata as Record<string, unknown>).kbRowsCited
  return Array.isArray(cited) ? cited.map(String) : []
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
