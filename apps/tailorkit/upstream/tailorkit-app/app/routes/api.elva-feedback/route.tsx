/**
 * POST /api/elva-feedback
 *
 * Internal endpoint — called by the Elva reply handler when the next user message
 * arrives after an AI reply. Classifies implicit sentiment and persists the signal.
 *
 * Body: { conversationId, messageId, replyText, kbRowsCited, nextUserMessage, shopDomain }
 * Returns: { signal, triggerKeywords, persisted: true }
 *
 * TODO(auth): Add Shopify App session verification once the internal caller can
 * supply a session token. For MVP this route is server-to-server only (not exposed
 * via Shopify embed iframe) so auth is omitted intentionally. Revisit before any
 * external exposure.
 */
import type { ActionFunction } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import ElvaFeedback from '~/models/ElvaFeedback.server'
import { classifyFeedback } from '~/utils/elva-feedback-heuristic'
import { redactPii } from '~/utils/pii-redact.server'

const MAX_NEXT_MESSAGE_LEN = 500
const MAX_REPLY_TEXT_LEN = 4000
const INTERNAL_SECRET = process.env.ELVA_FEEDBACK_SECRET || ''

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  // Shared-secret gate until Shopify session auth is wired up.
  if (INTERNAL_SECRET) {
    const headerSecret = request.headers.get('x-elva-feedback-secret') || ''
    if (headerSecret !== INTERNAL_SECRET) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Bound request body size (1 MB max) before parsing.
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > 1_048_576) {
    return json({ error: 'Payload too large' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { conversationId, messageId, replyText, kbRowsCited, nextUserMessage, shopDomain } = body

  if (!conversationId || typeof conversationId !== 'string') {
    return json({ error: 'conversationId is required' }, { status: 400 })
  }
  if (!messageId || typeof messageId !== 'string') {
    return json({ error: 'messageId is required' }, { status: 400 })
  }
  if (!replyText || typeof replyText !== 'string') {
    return json({ error: 'replyText is required' }, { status: 400 })
  }

  const safeNextMessageRaw = typeof nextUserMessage === 'string' ? nextUserMessage.slice(0, MAX_NEXT_MESSAGE_LEN) : ''
  const safeNextMessage = safeNextMessageRaw ? redactPii(safeNextMessageRaw) : ''
  const safeReplyText = typeof replyText === 'string' ? replyText.slice(0, MAX_REPLY_TEXT_LEN) : ''

  // Classify on the raw (pre-redaction) text so keyword patterns like "still broken" still fire.
  const { signal, triggerKeywords } = classifyFeedback(safeNextMessageRaw)

  try {
    await ElvaFeedback.create({
      conversationId,
      messageId,
      replyText: safeReplyText,
      kbRowsCited: Array.isArray(kbRowsCited) ? kbRowsCited.slice(0, 20) : [],
      signal,
      triggerKeywords,
      nextUserMessage: safeNextMessage || undefined,
      shopDomain: typeof shopDomain === 'string' ? shopDomain : undefined,
    })
  } catch (err) {
    console.error('[elva-feedback] DB write failed:', err)
    return json({ error: 'Persistence failed' }, { status: 500 })
  }

  return json({ signal, triggerKeywords, persisted: true })
}
