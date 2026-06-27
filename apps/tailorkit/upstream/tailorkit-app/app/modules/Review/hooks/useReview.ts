import { useCallback, useMemo, useState } from 'react'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { useRootLoaderData } from '~/root'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

/**
 * App Bridge `shopify.reviews.request()` declined codes.
 * @see https://shopify.dev/docs/api/app-bridge-library/apis/reviews
 */
export type ReviewRequestDeclinedCode =
  | 'mobile-app'
  | 'already-reviewed'
  | 'annual-limit-reached'
  | 'cooldown-period'
  | 'merchant-ineligible'
  | 'recently-installed'
  | 'already-open'
  | 'open-in-progress'
  | 'cancelled'

export type ReviewRequestResult =
  | { success: true; code: 'success'; message?: string }
  | { success: false; code: ReviewRequestDeclinedCode | 'error'; message?: string }

interface ReviewAskState {
  lastShopifyRequestAt?: string | Date
  lastResultCode?: string
  reviewAskNotNowAt?: string | Date
  reviewAskNeedHelpAt?: string | Date
  reviewedOnShopifyLikely?: boolean
}

interface UseReviewReturn {
  shouldShowReviewCard: boolean
  isSubmitting: boolean
  error: string | null
  trigger: 'achieved_first_order' | 'totalPublishedIntegrations' | null
  publishedCount: number
  hasFirstSale: boolean
  /** Calls App Bridge native review modal and persists result. */
  requestShopifyReview: () => Promise<ReviewRequestResult>
  markNotNow: () => Promise<void>
  markNeedHelp: () => Promise<void>
  markReviewedLikely: () => Promise<void>
}

const NOT_NOW_COOLDOWN_MS = 60 * ONE_DAY_IN_MILLISECONDS
const NEED_HELP_COOLDOWN_MS = 30 * ONE_DAY_IN_MILLISECONDS
const REQUEST_COOLDOWN_MS = 60 * ONE_DAY_IN_MILLISECONDS

function isWithin(at: string | Date | undefined, ms: number): boolean {
  if (!at) return false
  const t = new Date(at).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < ms
}

/**
 * Manage in-app App Store review card eligibility and actions.
 * Uses App Bridge `shopify.reviews.request()` and a cooldown-based
 * suppression model stored in `appConfig.reviewAskState`.
 *
 * Backward compatible with legacy `appConfig.reviewData[]`: if a legacy
 * entry already has rating >= 4 (high-rating user), the card stays hidden.
 */
export function useReview(): UseReviewReturn {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { shopData = {} } = useRootLoaderData()
  const { appConfig = {}, usages } = (shopData as { appConfig?: any; usages?: any }) || {}

  const publishedCount: number = usages?.totalPublishedIntegrations || 0
  const hasFirstSale = Boolean((appConfig?.occurredEvents || {})[CUSTOMERIO_EVENTS.ACHIEVED_FIRST_ORDER])

  const trigger: UseReviewReturn['trigger'] = hasFirstSale
    ? 'achieved_first_order'
    : publishedCount >= 3
      ? 'totalPublishedIntegrations'
      : null

  // Eligibility derived inside useMemo so the only fluctuating dependency
  // is `appConfig` itself (already memoised by the loader response).
  const shouldShowReviewCard = useMemo(() => {
    if (trigger === null) return false
    const occurredEvents = appConfig?.occurredEvents || {}
    // Permanent dismiss via the card's X button is recorded as an occurred
    // event by CardWithDismiss → dismissCardForever.
    const dismissedForever = Boolean(
      occurredEvents[OCCURRED_EVENTS.HOW_S_TAILORKIT_WORKING_FOR_YOU_CARD_DASHBOARD_DISMISSED]
        || occurredEvents[OCCURRED_EVENTS.THANKS_FOR_YOUR_FEEDBACK_CARD_DASHBOARD_DISMISSED]
    )
    if (dismissedForever) return false

    const reviewAskState: ReviewAskState = appConfig?.reviewAskState || {}
    if (reviewAskState.reviewedOnShopifyLikely) return false
    if (isWithin(reviewAskState.lastShopifyRequestAt, REQUEST_COOLDOWN_MS)) return false
    if (isWithin(reviewAskState.reviewAskNotNowAt, NOT_NOW_COOLDOWN_MS)) return false
    if (isWithin(reviewAskState.reviewAskNeedHelpAt, NEED_HELP_COOLDOWN_MS)) return false

    // Legacy: shop already left a high rating, treat as engaged.
    const legacyReviewData: Array<{ rating?: number }> = appConfig?.reviewData || []
    if (legacyReviewData.some(r => (r?.rating ?? 0) >= 4)) return false

    return true
  }, [trigger, appConfig])

  const persistAskState = useCallback(async (patch: Partial<ReviewAskState>) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await authenticatedFetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_REVIEW_ASK_STATE', reviewAskState: patch }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review state')
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const requestShopifyReview = useCallback(async (): Promise<ReviewRequestResult> => {
    const now = new Date()
    try {
      // App Bridge global is typed in @shopify/app-bridge-types.
      const result = (await shopify.reviews.request()) as ReviewRequestResult
      const patch: Partial<ReviewAskState> = {
        lastShopifyRequestAt: now,
        lastResultCode: result.code,
      }
      if (result.code === 'already-reviewed') {
        patch.reviewedOnShopifyLikely = true
      }
      // Don't await persist failures — UI flow shouldn't break on API hiccup.
      persistAskState(patch).catch(() => {})
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Review request failed'
      persistAskState({ lastShopifyRequestAt: now, lastResultCode: 'error' }).catch(() => {})
      return { success: false, code: 'error', message }
    }
  }, [persistAskState])

  const markNotNow = useCallback(async () => {
    await persistAskState({ reviewAskNotNowAt: new Date() })
  }, [persistAskState])

  const markNeedHelp = useCallback(async () => {
    await persistAskState({ reviewAskNeedHelpAt: new Date() })
  }, [persistAskState])

  const markReviewedLikely = useCallback(async () => {
    await persistAskState({ reviewedOnShopifyLikely: true })
  }, [persistAskState])

  return {
    shouldShowReviewCard,
    isSubmitting,
    error,
    trigger,
    publishedCount,
    hasFirstSale,
    requestShopifyReview,
    markNotNow,
    markNeedHelp,
    markReviewedLikely,
  }
}
