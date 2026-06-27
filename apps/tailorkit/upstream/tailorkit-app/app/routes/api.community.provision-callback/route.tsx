import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { trackFeatureEvent } from '~/bootstrap/fns/feature-tracking.server'
import Shop from '~/models/Shop.server'
import crypto from 'crypto'

const COMMUNITY_PROVISION_SECRET = process.env.COMMUNITY_PROVISION_SECRET || ''

interface ProvisionCallbackBody {
  email: string
  success: boolean
  isNewAccount?: boolean
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate HMAC signature from ss-community callback.
 * ss-community sends HMAC-SHA256 of the raw body in X-Signature header.
 */
function validateCallbackSignature(body: string, signature: string | null): boolean {
  if (!signature || !COMMUNITY_PROVISION_SECRET) {
    return false
  }

  // Validate hex format before Buffer.from
  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    return false
  }

  try {
    const expectedSignature = crypto.createHmac('sha256', COMMUNITY_PROVISION_SECRET).update(body).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))
  } catch {
    return false
  }
}

/**
 * POST /api/community/provision-callback
 *
 * Called by ss-community after provisioning is complete.
 * Updates Shop.appConfig.communityAccount to mark as linked.
 *
 * Body: { email: string, success: boolean }
 * Header: X-Signature - HMAC-SHA256 signature of body for validation
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 })
  }

  if (!COMMUNITY_PROVISION_SECRET) {
    console.error('[Community Provision Callback] COMMUNITY_PROVISION_SECRET not configured')
    return json({ success: false, error: 'Service unavailable' }, { status: 503 })
  }

  // Get raw body for HMAC validation
  const rawBody = await request.text()

  // Validate HMAC signature
  const signature = request.headers.get('X-Signature')
  if (!validateCallbackSignature(rawBody, signature)) {
    console.error('[Community Provision Callback] Invalid signature')
    return json({ success: false, error: 'Invalid signature' }, { status: 401 })
  }

  // Parse body
  let body: ProvisionCallbackBody
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, success, isNewAccount } = body

  if (!email || typeof success !== 'boolean') {
    return json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  if (!isValidEmail(email)) {
    return json({ success: false, error: 'Invalid email format' }, { status: 400 })
  }

  if (!success) {
    return json({ success: true, message: 'Provision failed, no update performed' })
  }

  // Success - update shop's community account linkage
  try {
    const shop = await Shop.findOne({ 'shopConfig.email': email })

    if (!shop) {
      console.error('[Community Provision Callback] Shop not found for email:', email)
      return json({ success: false, error: 'Request could not be processed' }, { status: 400 })
    }

    await Shop.updateOne(
      { _id: shop._id },
      {
        $set: {
          'appConfig.communityAccount': {
            linked: true,
            email: email,
            linkedAt: new Date(),
          },
        },
      }
    )

    console.log('[Community Provision Callback] Successfully linked community account for:', email)

    // Track Mixpanel event - don't fail callback if tracking fails
    try {
      await trackFeatureEvent(shop, 'community_provision', 'account_linked', {
        email: email,
        isNewAccount: isNewAccount ?? true,
      })
    } catch (trackingError) {
      console.error('[Community Provision Callback] Mixpanel tracking error:', trackingError)
    }

    return json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Community Provision Callback] Error updating shop:', errorMessage)
    return json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
