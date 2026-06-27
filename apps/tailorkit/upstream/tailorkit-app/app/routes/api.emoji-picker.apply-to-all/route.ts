import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import Layer from '~/models/Layer.server'

/**
 * Bulk-apply the shop-wide emoji set to every text layer in the shop.
 *
 * Route: POST /api/emoji-picker/apply-to-all
 * Body : JSON { emojis: string, font?: { family: string; src: string } }
 *
 * Replaces `settings.emojiPicker.emojis` and `settings.emojiPicker.font` on
 * every text layer in the shop where `settings.emojiPicker.enabled === true`.
 * Layers that haven't enabled the emoji picker are left untouched.
 *
 * This is the "bulk" version of Penelope's TDE pain point: instead of
 * configuring each text layer in each template, the merchant sets the master
 * list once in Sale Tools → Emoji picker, clicks "Apply to all templates",
 * and every text layer that already has the picker enabled gets the same set.
 *
 * Replace semantics (not append): merchants who want a different set on a
 * specific template still edit that layer in the template editor.
 */

interface ApplyBody {
  emojis?: unknown
  font?: unknown
}

// Generous upper bound for a PUA-glyph string. The picker UI typically has
// dozens to a few hundred chars; this just guards against accidental bulk
// writes of MB-sized payloads to every text layer in the shop.
const MAX_EMOJIS_LENGTH = 2000
const MAX_FONT_FIELD_LENGTH = 2048

function isFontShape(value: unknown): value is { family: string; src: string } {
  if (typeof value !== 'object' || value === null) return false
  const family = (value as { family?: unknown }).family
  const src = (value as { src?: unknown }).src
  if (typeof family !== 'string' || typeof src !== 'string') return false
  if (family.length === 0 || family.length > MAX_FONT_FIELD_LENGTH) return false
  // Storefront font loader fetches this URL; reject anything that isn't a
  // proper HTTPS URL to keep mixed-content and odd schemes out of the DB.
  if (!src.startsWith('https://') || src.length > MAX_FONT_FIELD_LENGTH) return false
  return true
}

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  // Auth first — never reveal endpoint existence or shape to unauthenticated callers.
  const { session } = await authenticate.admin(request)
  const shopDomain = session.shop

  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 })
  }

  let body: ApplyBody
  try {
    body = (await request.json()) as ApplyBody
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawEmojis = typeof body.emojis === 'string' ? body.emojis : ''
  if (rawEmojis.length > MAX_EMOJIS_LENGTH) {
    return json({ success: false, error: 'Emoji string too long' }, { status: 400 })
  }
  const emojis = rawEmojis
  const font = isFontShape(body.font) ? body.font : undefined

  // Build the $set payload. If font is undefined, $unset it so the layer
  // doesn't keep a stale font pointer from a previous master list.
  const updateOps: Record<string, unknown> = {
    $set: {
      'settings.emojiPicker.emojis': emojis,
    },
  }
  if (font) {
    ;(updateOps.$set as Record<string, unknown>)['settings.emojiPicker.font'] = font
  } else {
    updateOps.$unset = { 'settings.emojiPicker.font': '' }
  }

  const result = await Layer.updateMany(
    {
      shopDomain,
      type: 'text',
      'settings.emojiPicker.enabled': true,
    },
    updateOps
  )

  return json({
    success: true,
    matched: result.matchedCount,
    modified: result.modifiedCount,
  })
})
