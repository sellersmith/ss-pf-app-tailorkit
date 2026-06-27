/**
 * Cancellation Guard - Safe-by-default guardrails for subscription cancellation
 *
 * Prevents accidental mass cancellation by:
 * 1. Pre-cancellation verification (subscription must exist and be active)
 * 2. Structured audit logging with caller context
 * 3. Rate limiting (cooldown between cancellations for same shop)
 * 4. Explicit gating via environment variable for destructive updateMany
 *
 * All cancellation paths MUST go through verifyCancellation() before mutating.
 */

import Subscription from '../Subscription.server'
import type { SubscriptionDocument } from '../Subscription'

/** Cancellation reasons for audit trail */
export type CancellationReason =
  | 'app_uninstalled'
  | 'app_subscription_update_cancelled'
  | 'app_subscription_update_expired'
  | 'app_subscription_update_frozen'
  | 'dev_store_transfer'
  | 'plan_upgrade'
  | 'plan_downgrade'
  | 'manual_settings'
  | 'shop_redact'

/** Structured cancellation context for audit logging */
export interface CancellationContext {
  reason: CancellationReason
  shopDomain: string
  /** The specific subscription ID being cancelled (when known) */
  targetSubscriptionId?: string
  /** Shopify charge ID from webhook payload for cross-reference */
  shopifyChargeId?: string
  /** Caller file/function for traceability */
  caller: string
  /** Additional metadata for debugging */
  metadata?: Record<string, unknown>
}

/** Result of pre-cancellation verification */
export interface CancellationVerification {
  allowed: boolean
  /** If not allowed, explains why */
  denialReason?: string
  /** Active subscriptions found for the shop */
  activeSubscriptionCount: number
  /** The specific subscription that would be cancelled */
  targetSubscription?: SubscriptionDocument | null
}

// In-memory cooldown tracker (per-shop, prevents rapid-fire cancellations)
const recentCancellations = new Map<string, number>()
const CANCELLATION_COOLDOWN_MS = 5_000 // 5 seconds between cancellations for same shop

/**
 * Verify whether a cancellation should proceed.
 * Must be called before any subscription status mutation.
 *
 * Checks:
 * 1. Shop has active subscriptions to cancel
 * 2. Not within cooldown period from a recent cancellation
 * 3. Target subscription (if specified) exists and is active
 */
export async function verifyCancellation(ctx: CancellationContext): Promise<CancellationVerification> {
  const { shopDomain, targetSubscriptionId } = ctx

  // Check cooldown
  const lastCancelTime = recentCancellations.get(shopDomain)
  if (lastCancelTime && Date.now() - lastCancelTime < CANCELLATION_COOLDOWN_MS) {
    logCancellationEvent('BLOCKED_COOLDOWN', ctx, {
      lastCancelTime: new Date(lastCancelTime).toISOString(),
      cooldownMs: CANCELLATION_COOLDOWN_MS,
    })
    return {
      allowed: false,
      denialReason: `Cancellation blocked: cooldown active (last cancel ${Date.now() - lastCancelTime}ms ago)`,
      activeSubscriptionCount: 0,
    }
  }

  // Count active subscriptions
  const activeSubscriptions = await Subscription.find({
    shopDomain,
    status: 'active',
    periodical: { $ne: 'one-time' },
  }).select('_id shopifyCharge plan status')

  if (activeSubscriptions.length === 0) {
    logCancellationEvent('SKIPPED_NO_ACTIVE', ctx, {})
    return {
      allowed: true, // Allow — it's a no-op, the cancellation will do nothing
      denialReason: undefined,
      activeSubscriptionCount: 0,
    }
  }

  // If targeting a specific subscription, verify it exists in the active set
  let targetSubscription: SubscriptionDocument | null = null
  if (targetSubscriptionId) {
    targetSubscription
      = (activeSubscriptions.find(s => s._id.toString() === targetSubscriptionId) as SubscriptionDocument) || null

    if (!targetSubscription) {
      logCancellationEvent('WARN_TARGET_NOT_ACTIVE', ctx, {
        activeIds: activeSubscriptions.map(s => s._id.toString()),
      })
    }
  }

  // Log and allow
  logCancellationEvent('VERIFIED_OK', ctx, {
    activeSubscriptionCount: activeSubscriptions.length,
    activeIds: activeSubscriptions.map(s => s._id.toString()),
  })

  return {
    allowed: true,
    activeSubscriptionCount: activeSubscriptions.length,
    targetSubscription,
  }
}

/**
 * Record that a cancellation was executed (updates cooldown tracker).
 * Call this AFTER successful cancellation mutations.
 */
export function recordCancellationExecuted(shopDomain: string): void {
  recentCancellations.set(shopDomain, Date.now())

  // Prevent memory leak — clean up entries older than 1 minute
  if (recentCancellations.size > 1000) {
    const cutoff = Date.now() - 60_000
    for (const [domain, time] of recentCancellations.entries()) {
      if (time < cutoff) {
        recentCancellations.delete(domain)
      }
    }
  }
}

/**
 * Check if broad updateMany cancellation is enabled.
 * Safe-by-default: disabled unless explicitly opted in via env var.
 *
 * When disabled, only the specific subscription ID will be cancelled.
 * When enabled, all active non-one-time subscriptions for the shop are also cancelled.
 */
export function isBroadCancelEnabled(): boolean {
  return process.env.ENABLE_BROAD_SUBSCRIPTION_CANCEL === 'true'
}

/**
 * Structured logging for all cancellation events.
 * Outputs JSON to stdout for log aggregation/alerting.
 */
export function logCancellationEvent(event: string, ctx: CancellationContext, details: Record<string, unknown>): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: event.startsWith('BLOCKED') || event.startsWith('ERROR') ? 'error' : 'info',
    component: 'cancellation-guard',
    event,
    shopDomain: ctx.shopDomain,
    reason: ctx.reason,
    caller: ctx.caller,
    targetSubscriptionId: ctx.targetSubscriptionId || null,
    shopifyChargeId: ctx.shopifyChargeId || null,
    ...details,
  }

  if (logEntry.level === 'error') {
    console.error('[CancellationGuard]', JSON.stringify(logEntry))
  } else {
    console.log('[CancellationGuard]', JSON.stringify(logEntry))
  }
}
