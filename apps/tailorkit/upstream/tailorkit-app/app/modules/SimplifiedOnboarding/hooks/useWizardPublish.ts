/**
 * Hook for wizard publish flow (Step 5).
 * Handles product cloning, template creation, and publishing via API.
 * Shared logic between "View It On Storefront" and "View It In Editor" actions.
 */

import { useCallback, useState } from 'react'
import { useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useRootLoaderData } from '~/root'
import { navigateToShopifyAdmin } from '~/utils/shopify'
import { isApprovedCharge } from '~/models/PricingPlan.fns'
import type { ShopDocument } from '~/models/Shop'
import type { RootLoaderData } from '~/types/loaders'
import { SIMPLIFIED_ONBOARDING_EVENTS } from '../tracking-events'
import type {
  PublishMode,
  PublishResult,
  TemplateGenState,
  TemplateType,
  WizardMockupResult,
  WizardProduct,
  WizardAction,
} from '../types'

interface UseWizardPublishOptions {
  selectedProduct: WizardProduct | null
  selectedImageUrl: string | null
  mockupResult: WizardMockupResult | null
  /** Composite mockup image (product + mask overlay) for congrats thumbnail */
  compositeImageUrl: string | null
  selectedTemplateType: TemplateType | null
  selectedExistingTemplate: { id: string; name: string; previewUrl: string } | null
  templateStates: Record<TemplateType, TemplateGenState>
  publishResult: PublishResult | null
  wizardStartTime: number
  /** Publish mode chosen by the merchant on Step 5 (clone vs integrate-direct) */
  publishMode: PublishMode
  /** When true, upload the composite mockup + request server to make it the featured image */
  replaceFeaturedMedia: boolean
  dispatch: React.Dispatch<WizardAction>
  fireWizardCompleted: (action: string) => void
}

/** Check if template type uses vector/image (non-text) generation */
function isNonTextTemplate(templateType: string) {
  return templateType.includes('initial') || templateType.includes('monogram') || templateType.startsWith('custom-')
}

export function useWizardPublish({
  selectedProduct,
  selectedImageUrl,
  mockupResult,
  compositeImageUrl,
  selectedTemplateType,
  selectedExistingTemplate,
  templateStates,
  publishResult,
  wizardStartTime,
  publishMode,
  replaceFeaturedMedia,
  dispatch,
  fireWizardCompleted,
}: UseWizardPublishOptions) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const rootData = useRootLoaderData()
  const { PUBLIC_ENV: { APP_HANDLE } = {} } = rootData || {}
  const navigate = useNavigate()
  const [publishStepMessage, setPublishStepMessage] = useState('')
  const [publishAction, setPublishAction] = useState<'storefront' | 'editor' | null>(null)

  // First-product-free gate. The wizard publishes via /api/onboarding/publish-product
  // which bypasses the Full Editor's UnifiedHeader gate. Mirrors the same condition
  // used there and in the server endpoint, so we redirect to /pricing before making
  // the round-trip. Server is the source of truth (see 402 handling below).
  const shopData = (rootData as RootLoaderData | undefined)?.shopData as ShopDocument | null | undefined
  const needsSubscriptionForPublish = shopData
    ? !isApprovedCharge(shopData) && (shopData.usages?.totalPublishedIntegrations || 0) >= 1
    : false

  // Open editor in a new tab so the user can come back and select a pricing plan
  const openEditorInNewTab = useCallback(
    (integrationId: string, mockupId?: string) => {
      const params = new URLSearchParams({ onboarding: 'true', simplified: 'true' })
      if (mockupId) params.set('mockup', mockupId)
      navigateToShopifyAdmin(`/apps/${APP_HANDLE}/personalized-products/${integrationId}?${params}`)
    },
    [APP_HANDLE]
  )

  // Shared publish flow: resolves template image URL, calls API, returns result or null
  const executePublishFlow = useCallback(async (): Promise<PublishResult | null> => {
    if (!selectedProduct || !mockupResult || (!selectedTemplateType && !selectedExistingTemplate)) return null

    let templateImageUrl: string | undefined
    let templateImageWidth = 0
    let templateImageHeight = 0
    // Skip template image upload when using an existing template (it already has layers/images in DB)
    if (selectedTemplateType && isNonTextTemplate(selectedTemplateType)) {
      const rawUrl = templateStates[selectedTemplateType]?.sourceImageUrl
      if (rawUrl) {
        // Resolve natural dimensions so the server can fit-center the image layer
        // within the print area (instead of stretching to fill it).
        try {
          const tmpImg = new Image()
          tmpImg.crossOrigin = 'anonymous'
          await new Promise<void>((resolve, reject) => {
            tmpImg.onload = () => resolve()
            tmpImg.onerror = () => reject()
            tmpImg.src = rawUrl
          })
          templateImageWidth = tmpImg.naturalWidth
          templateImageHeight = tmpImg.naturalHeight
        } catch {
          /* fallback: server will use printArea dimensions */
        }

        if (rawUrl.startsWith('http')) {
          templateImageUrl = rawUrl
        } else {
          setPublishStepMessage(t('publishing-uploading-artwork'))
          const { uploadProcessedImageViaAPI } = await import('~/modules/MockupWizard/fns.client')
          const blob = await fetch(rawUrl).then(r => r.blob())
          // Use correct extension based on MIME type (SVG for vector templates with filters)
          const ext = blob.type === 'image/svg+xml' ? 'svg' : 'png'
          const uploadResult = await uploadProcessedImageViaAPI(blob, `onboarding-template-${Date.now()}.${ext}`)
          templateImageUrl = uploadResult?.url
        }
      }
    }

    // Ensure processedImageUrl is a CDN URL, not a base64 data URL.
    // The mockup wizard may store a data URL if client-side processing was used;
    // uploading it here keeps the POST body small (~2KB vs ~2MB) and prevents
    // Shopify metafield writes from exceeding the 2M character limit.
    let processedImageUrl = mockupResult.processedImageUrl
    if (processedImageUrl && !processedImageUrl.startsWith('http')) {
      setPublishStepMessage(t('publishing-uploading-mask'))
      const { uploadProcessedImageViaAPI } = await import('~/modules/MockupWizard/fns.client')
      const blob = await fetch(processedImageUrl).then(r => r.blob())
      const uploadResult = await uploadProcessedImageViaAPI(blob, `onboarding-mask-${Date.now()}.png`)
      if (uploadResult?.url) {
        processedImageUrl = uploadResult.url
      }
    }

    // Resolve original product image dimensions so the server can upscale
    // processed-space positions to original-image space. Loaded from the
    // product image URL which is already cached by the browser.
    let originalImageWidth = 0
    let originalImageHeight = 0
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
        img.src = selectedImageUrl
      })
      originalImageWidth = img.naturalWidth
      originalImageHeight = img.naturalHeight
    } catch {
      /* fallback: server will skip upscaling */
    }

    // When the merchant opted in to replace the featured media, upload the composite image
    // (product + template overlay) so the server has a CDN URL to hand to Shopify.
    // Failure is non-fatal — publish still proceeds; the server treats a missing URL as "skip
    // the media replace" and the client fires a telemetry event below.
    let featuredMediaUrl: string | undefined
    let featuredMediaWidth = 0
    let featuredMediaHeight = 0
    if (replaceFeaturedMedia && compositeImageUrl) {
      try {
        if (compositeImageUrl.startsWith('http')) {
          featuredMediaUrl = compositeImageUrl
        } else {
          setPublishStepMessage(t('publishing-uploading-featured-media'))
          const { uploadProcessedImageViaAPI } = await import('~/modules/MockupWizard/fns.client')
          const blob = await fetch(compositeImageUrl).then(r => r.blob())
          const uploadResult = await uploadProcessedImageViaAPI(blob, `onboarding-featured-${Date.now()}.png`)
          featuredMediaUrl = uploadResult?.url
        }
        if (featuredMediaUrl) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject()
            img.src = featuredMediaUrl!
          })
          featuredMediaWidth = img.naturalWidth
          featuredMediaHeight = img.naturalHeight
        }
      } catch (err) {
        // Upload or dimension resolution failed. Log + track, then proceed.
        console.error('[useWizardPublish] featured media upload failed:', err)
        trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_FEATURED_MEDIA_REPLACE_FAILED, {
          product_id: selectedProduct.id,
          publish_mode: publishMode,
          stage: 'upload',
          error: err instanceof Error ? err.message : 'unknown',
        })
        featuredMediaUrl = undefined
      }
    }

    setPublishStepMessage(t('publishing-creating-product'))
    // We call fetch directly (not authenticatedFetch) so we can read the 402 body
    // when the server-side first-product-free gate rejects this publish — the
    // shared helper throws on non-2xx and discards the body. The auth token still
    // comes from the same App Bridge source.
    // Window.shopify is globally typed (app/globals.d.ts) — no `as any` needed.
    // Falls back through window.opener for popup contexts.
    const shopify = window.opener?.shopify ?? window.shopify
    const idToken = await shopify.idToken()
    const res = await fetch('/api/onboarding/publish-product', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        productId: selectedProduct.id,
        productTitle: selectedProduct.title,
        templateType: selectedTemplateType || 'existing',
        // Tells the server whether to duplicate the product (clone) or attach personalization
        // onto the original product variants (integrate-direct).
        publishMode,
        processedImageUrl,
        selectedImageUrl,
        originalImageWidth,
        originalImageHeight,
        mockupResult: {
          ...mockupResult,
          processedImageUrl,
        },
        templateImageUrl,
        templateImageWidth: templateImageWidth || undefined,
        templateImageHeight: templateImageHeight || undefined,
        // SVG overlay with filter primitives for the storefront to extract and re-apply
        overlaySvg: selectedTemplateType ? templateStates[selectedTemplateType]?.overlaySvg : undefined,
        // When using an existing template, pass its ID to skip template creation
        existingTemplateId: selectedExistingTemplate?.id || undefined,
        // Replace featured media — merchant intent flag + CDN URL of the composite mockup.
        // Server treats a missing URL as "skip" so an upload failure degrades gracefully.
        replaceFeaturedMedia,
        featuredMediaUrl,
        featuredMediaWidth: featuredMediaWidth || undefined,
        featuredMediaHeight: featuredMediaHeight || undefined,
      }),
    })

    const data = await res.json().catch(() => null)

    // 402: server-side first-product-free gate rejected. Mirrors the client-side
    // pre-check, but acts as the source of truth when client cache is stale.
    if (res.status === 402 && data?.needsSubscription) {
      dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'ready' })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_FAILED, {
        error: 'NEEDS_SUBSCRIPTION',
        publish_mode: publishMode,
        replace_featured_media: replaceFeaturedMedia,
      })
      navigate('/pricing')
      return null
    }

    if (!data?.success) {
      // Surface a friendly message for the conflict case (already-personalized product) so the
      // merchant knows to switch modes or open the existing personalization. Other errors fall
      // back to the server's generic message.
      const friendlyError
        = data?.error === 'PRODUCT_ALREADY_INTEGRATED'
          ? t('this-product-already-has-personalization-open-it-from-the-personalized-products-page-to-edit')
          : data?.error || 'Failed to publish product'
      dispatch({ type: 'SET_ERROR', error: friendlyError })
      dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'ready' })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_FAILED, {
        error: data?.error,
        publish_mode: publishMode,
        // Cross-correlation property for adoption analysis.
        replace_featured_media: replaceFeaturedMedia,
      })
      return null
    }

    // Server-side media replacement failed but publish itself succeeded (non-fatal).
    // Fire a dedicated event so we can track failure rate separately from adoption.
    if (replaceFeaturedMedia && data.featuredMediaReplaced === false) {
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_FEATURED_MEDIA_REPLACE_FAILED, {
        product_id: selectedProduct.id,
        publish_mode: publishMode,
        stage: 'server',
        error: data.featuredMediaError,
      })
    }

    setPublishStepMessage(t('publishing-finalizing'))

    return {
      storefrontUrl: data.storefrontUrl,
      integrationId: data.integrationId,
      mockupId: data.mockupId,
      newProductId: data.newProductId,
      totalDurationMs: Date.now() - wizardStartTime,
      sourceProductId: selectedProduct.id,
      mockupImageUrl: compositeImageUrl || mockupResult.processedImageUrl || undefined,
      // Server-authoritative flags used by downstream tracking events
      featuredMediaReplaced: data.featuredMediaReplaced === true,
      featuredMediaError: data.featuredMediaError,
    }
  }, [
    selectedProduct,
    mockupResult,
    compositeImageUrl,
    selectedTemplateType,
    selectedExistingTemplate,
    selectedImageUrl,
    templateStates,
    wizardStartTime,
    publishMode,
    replaceFeaturedMedia,
    t,
    trackEvent,
    dispatch,
    navigate,
  ])

  // "View It On Storefront": publishes product, auto-opens storefront when done.
  // The "View It On Storefront" button on the completed screen is a fallback
  // in case the browser blocks the automatic popup.
  const handleSeeItWorks = useCallback(async () => {
    if (!selectedProduct || !mockupResult || (!selectedTemplateType && !selectedExistingTemplate)) return

    // Gate: 2nd+ publish without subscription → redirect to pricing.
    if (needsSubscriptionForPublish) {
      navigate('/pricing')
      return
    }

    setPublishAction('storefront')
    dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'publishing' })
    trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_STARTED, {
      productId: selectedProduct.id,
      templateType: selectedTemplateType || 'existing',
      publish_mode: publishMode,
      replace_featured_media: replaceFeaturedMedia,
    })

    try {
      const result = await executePublishFlow()
      if (!result) return

      dispatch({ type: 'SET_PUBLISH_RESULT', result })
      dispatch({ type: 'SET_INTEGRATION_ID', integrationId: result.integrationId })
      dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'completed' })

      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_COMPLETED, {
        storefrontUrl: result.storefrontUrl,
        newProductId: result.newProductId,
        totalDurationMs: result.totalDurationMs,
        publish_mode: publishMode,
        // Server-authoritative outcome (may be false if upload or media API failed even
        // when the merchant opted in). Intent vs. outcome is captured in two separate props.
        replace_featured_media: replaceFeaturedMedia,
        featured_media_replaced: result.featuredMediaReplaced === true,
      })
      fireWizardCompleted('view_on_storefront')

      // Auto-open storefront after publish. May be blocked by popup blocker
      // since this runs after an async operation — the button on the completed
      // screen serves as a fallback for the user to click manually.
      window.open(result.storefrontUrl, '_blank')
    } catch (err) {
      console.error('[useWizardPublish] See It Works failed:', err)
      dispatch({ type: 'SET_ERROR', error: 'Something went wrong. Please try again.' })
      dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'ready' })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_FAILED, {
        error: err instanceof Error ? err.message : 'Unknown error',
        publish_mode: publishMode,
        replace_featured_media: replaceFeaturedMedia,
      })
    }
  }, [
    selectedProduct,
    mockupResult,
    selectedTemplateType,
    selectedExistingTemplate,
    publishMode,
    replaceFeaturedMedia,
    trackEvent,
    executePublishFlow,
    fireWizardCompleted,
    dispatch,
    needsSubscriptionForPublish,
    navigate,
  ])

  // "View It In Editor": publishes (if needed), opens template editor in new tab
  const handleViewInEditor = useCallback(async () => {
    if (!selectedProduct || !mockupResult || (!selectedTemplateType && !selectedExistingTemplate)) return

    // Already published — open immediately (synchronous user gesture)
    if (publishResult) {
      fireWizardCompleted('view_in_editor')
      openEditorInNewTab(publishResult.integrationId, publishResult.mockupId)
      return
    }

    // Gate: 2nd+ publish without subscription → redirect to pricing.
    if (needsSubscriptionForPublish) {
      navigate('/pricing')
      return
    }

    setPublishAction('editor')
    dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'publishing' })
    setPublishStepMessage(t('publishing-creating-product'))

    try {
      const result = await executePublishFlow()
      if (!result) return

      dispatch({ type: 'SET_PUBLISH_RESULT', result })
      dispatch({ type: 'SET_INTEGRATION_ID', integrationId: result.integrationId })
      dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'completed' })

      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_COMPLETED, {
        storefrontUrl: result.storefrontUrl,
        newProductId: result.newProductId,
        totalDurationMs: result.totalDurationMs,
        action: 'view_in_editor',
        publish_mode: publishMode,
        replace_featured_media: replaceFeaturedMedia,
        featured_media_replaced: result.featuredMediaReplaced === true,
      })
      fireWizardCompleted('view_in_editor')

      // Auto-open editor after publish. May be blocked by popup blocker
      // since this runs after an async operation — the congrats screen
      // provides a manual "View It In Editor" link as fallback.
      openEditorInNewTab(result.integrationId, result.mockupId)
    } catch (err) {
      console.error('[useWizardPublish] View In Editor failed:', err)
      dispatch({ type: 'SET_ERROR', error: 'Something went wrong. Please try again.' })
      dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'ready' })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_FAILED, {
        error: err instanceof Error ? err.message : 'Unknown error',
        action: 'view_in_editor',
        publish_mode: publishMode,
        replace_featured_media: replaceFeaturedMedia,
      })
    }
  }, [
    selectedProduct,
    mockupResult,
    selectedTemplateType,
    selectedExistingTemplate,
    publishResult,
    publishMode,
    replaceFeaturedMedia,
    t,
    trackEvent,
    executePublishFlow,
    fireWizardCompleted,
    openEditorInNewTab,
    dispatch,
    needsSubscriptionForPublish,
    navigate,
  ])

  return {
    publishStepMessage,
    publishAction,
    handleSeeItWorks,
    handleViewInEditor,
  }
}
