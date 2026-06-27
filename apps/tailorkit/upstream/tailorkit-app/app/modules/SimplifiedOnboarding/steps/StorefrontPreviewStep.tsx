/**
 * Step 5: Make It Live — three-phase flow:
 * Phase A (install): Theme extension enable + app block installation
 * Phase B (ready): "View it on storefront" always enabled (fallback ensures panel shows)
 * Phase C (completed): Congratulations message with inline pricing cards for unsubscribed users
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Divider,
  InlineGrid,
  InlineStack,
  Spinner,
  Text,
  useBreakpoints,
} from '@shopify/polaris'
import { CheckCircleIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useRevalidator } from '@remix-run/react'
import { useInstallAppBlock } from '~/hooks/useInstallAppBlock'
import { useAppConfig } from '~/hooks/useAppConfig'
import { InstallAppEmbedActivator } from '~/components/InstallAppEmbedActivator'
import { useRootLoaderData } from '~/root'
import { isApprovedCharge } from '~/models/PricingPlan.fns'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { SubscriptionDocument } from '~/models/Subscription'
import { fetchPricingPlansV2, fetchTrialInfo, fetchBillingState, subscribeToPlan } from '~/routes/pricing._index/fns'
import { mapPlansToDisplayData } from '~/routes/pricing._index/utils/planDisplayMapper'
import { calculateRemainingTrialDays } from '~/routes/pricing._index/utils/trial-calculations'
import PlanCard from '~/routes/pricing._index/components/PlanSelectionCards/PlanCard'
import { SocialProofSection } from '~/routes/pricing._index/components/social-proof-section'
import type {
  PublishMode,
  PublishPhase,
  PublishResult,
  TemplateType,
  WizardMockupResult,
  WizardProduct,
} from '../types'
import { PublishModeToggle } from '../components/publish-mode-toggle'
import { ReplaceFeaturedMediaToggle } from '../components/replace-featured-media-toggle'
import styles from '../styles.module.css'

interface StorefrontPreviewStepProps {
  product: WizardProduct
  mockupResult: WizardMockupResult
  compositeImageUrl?: string | null
  selectedTemplateType: TemplateType | null
  appConfig: Record<string, unknown>
  appBlockInstalled: boolean
  publishPhase: PublishPhase
  publishResult: PublishResult | null
  /** Progress message during publish flow (e.g. 'Uploading AI generated artwork...') */
  publishStepMessage?: string
  wizardStartTime: number
  hideHeader?: boolean
  /** Current publish mode — controls whether publish clones or integrates directly */
  publishMode: PublishMode
  /** Number of products selected (for tracking on toggle change) */
  selectedProductCount: number
  /** Whether the generated mockup should replace the product's featured media on publish */
  replaceFeaturedMedia: boolean
  onAppBlockInstalled: (installed: boolean) => void
  onAppEmbedEnabled: (enabled: boolean) => void
  onPublishModeChange: (mode: PublishMode, previousMode: PublishMode) => void
  onReplaceFeaturedMediaChange: (next: boolean, previous: boolean) => void
}

export function StorefrontPreviewStep({
  product,
  mockupResult,
  compositeImageUrl,
  selectedTemplateType,
  appConfig,
  appBlockInstalled,
  publishPhase,
  publishResult,
  publishStepMessage,
  hideHeader,
  wizardStartTime,
  publishMode,
  selectedProductCount: _selectedProductCount,
  replaceFeaturedMedia,
  onAppBlockInstalled,
  onAppEmbedEnabled,
  onPublishModeChange,
  onReplaceFeaturedMediaChange,
}: StorefrontPreviewStepProps) {
  const { t } = useTranslation()
  const revalidator = useRevalidator()
  const { mdDown } = useBreakpoints()

  // Fetch actual theme config (enabledAppBlock, customizerLink) — shop.appConfig from
  // the Remix loader doesn't include theme config; it requires a separate API call.
  const { appConfig: themeConfig, refetch: refetchThemeConfig, fetched: themeConfigFetched } = useAppConfig(appConfig)

  const handleRevalidate = useCallback(() => {
    // Schedule revalidation to avoid "Cannot update RouterProvider while rendering" error.
    // Don't set onAppBlockInstalled(true) here — let the auto-detect effect below
    // check the actual theme config response before declaring installed.
    setTimeout(() => {
      revalidator.revalidate()
      refetchThemeConfig()
    }, 0)
  }, [revalidator, refetchThemeConfig])

  // Use the fetched theme config for app block detection.
  // Only trust the API response (themeCfg.enabledAppBlock) — NOT the wizard state
  // (appBlockInstalled), which could be stale or prematurely set.
  const themeCfg = (themeConfig || {}) as Record<string, any>
  const customizerLink = themeCfg.customizerLink || themeCfg.productThemeLink || ''
  const enabledAppBlock = !!themeCfg.enabledAppBlock

  const { showCountdown, countdown, isChecking, installFailed, onInstallingAppBlock } = useInstallAppBlock({
    customizerLink,
    enabledAppBlock,
    revalidate: handleRevalidate,
    appBlockDiagnostics: themeCfg.appBlockDiagnostics,
  })

  // Auto-detect if app block is already installed from fetched theme config
  useEffect(() => {
    if (themeCfg.enabledAppBlock && !appBlockInstalled) {
      onAppBlockInstalled(true)
    }
  }, [themeCfg.enabledAppBlock, appBlockInstalled, onAppBlockInstalled])

  // Sync app embed status back to wizard state so button actions can check it
  // Only depend on the derived value, not the callback ref (inline arrow = new ref each render)
  useEffect(() => {
    onAppEmbedEnabled(!!themeCfg.enabledAppEmbed)
  }, [!!themeCfg.enabledAppEmbed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase C: Congratulations — detect subscription from root loader (works on all pages)
  const rootData = useRootLoaderData()
  const hasSubscription = rootData?.shopData ? isApprovedCharge(rootData.shopData) : false

  // Fetch pricing plans when congrats phase is reached for unsubscribed users
  const [plans, setPlans] = useState<PricingPlanDocument[]>([])
  const [remainingTrialDays, setRemainingTrialDays] = useState<number | null>(null)
  const [billingCycleBaseline, setBillingCycleBaseline] = useState(0)
  const [loadingPlanAlias, setLoadingPlanAlias] = useState<string>()

  useEffect(() => {
    if (publishPhase !== 'completed' || hasSubscription) return
    let cancelled = false
    Promise.all([fetchPricingPlansV2(), fetchTrialInfo(), fetchBillingState()]).then(
      ([fetchedPlans, trialInfo, billingState]) => {
        if (cancelled) return
        setPlans(fetchedPlans)
        const maxTrialDays = Math.max(...fetchedPlans.map(p => p.trialDays || 0), 0)
        setRemainingTrialDays(calculateRemainingTrialDays(trialInfo, maxTrialDays))
        setBillingCycleBaseline(billingState.billingCycleBaseline)
      }
    )
    return () => {
      cancelled = true
    }
  }, [publishPhase, hasSubscription])

  // Convert plans to display format
  const subscription = rootData?.shopData?.subscription as SubscriptionDocument | null
  const currentOrderCount = rootData?.shopData?.usages?.orders || 0
  const displayPlans = useMemo(
    () => mapPlansToDisplayData(plans, t, subscription, currentOrderCount, billingCycleBaseline),
    [plans, t, subscription, currentOrderCount, billingCycleBaseline]
  )
  // On mobile show Growth first (higher-value plan) for CRO
  const orderedPlans = useMemo(() => (mdDown ? [...displayPlans].reverse() : displayPlans), [displayPlans, mdDown])

  // Handle plan selection → subscribe → redirect to Shopify billing
  const handleSelectPlan = useCallback(
    async (planAlias: string) => {
      const plan = plans.find(p => p.alias === planAlias)
      if (!plan) return
      setLoadingPlanAlias(planAlias)
      try {
        const result = await subscribeToPlan(plan._id)
        if (result.success && result.confirmationUrl) {
          window.parent.location.href = result.confirmationUrl
          return
        }
      } catch {
        // Silent — user can retry
      } finally {
        setLoadingPlanAlias(undefined)
      }
    },
    [plans]
  )

  // Determine current plan action for each card
  const currentPlanAlias = (subscription?.plan as PricingPlanDocument | null)?.alias
  const currentPlanPrice = (subscription?.plan as PricingPlanDocument | null)?.price

  // Derive plan action per card
  const getPlanAction = useCallback(
    (planAlias: string, planPrice: number) => {
      if (currentPlanAlias === planAlias) return 'current' as const
      if (!currentPlanAlias) return 'select' as const
      return planPrice > (currentPlanPrice || 0) ? ('upgrade' as const) : ('downgrade' as const)
    },
    [currentPlanAlias, currentPlanPrice]
  )

  // Shared plan card list — used in both mobile (stacked) and desktop (grid) layouts
  const planCards = orderedPlans.map(plan => (
    <PlanCard
      key={plan.alias}
      plan={plan}
      onSelectPlan={handleSelectPlan}
      planAction={getPlanAction(plan.alias, plan.price)}
      isLoading={loadingPlanAlias === plan.alias}
      t={t}
      remainingTrialDays={remainingTrialDays}
      isDealActive={rootData?.isDealActive}
      isDealEligible={rootData?.isDealEligible}
    />
  ))

  if (publishPhase === 'completed' && publishResult) {
    const mockupImage = publishResult.mockupImageUrl || compositeImageUrl || mockupResult.processedImageUrl || undefined

    return (
      <div className={styles.congratsContainer}>
        <BlockStack gap="500">
          {/* Headline — direct mode: product is already live (existing product). Clone mode:
              new duplicate is UNLISTED until merchant flips status. */}
          <BlockStack gap="200">
            <Text as="h2" variant="headingLg">
              {hasSubscription
                ? publishMode === 'integrate-direct'
                  ? t('your-personalized-product-is-live')
                  : t('your-personalized-product-is-live')
                : t('your-product-is-ready-select-a-plan-to-go-live')}
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              {hasSubscription
                ? publishMode === 'integrate-direct'
                  ? t('your-product-is-now-personalized-and-visible-on-your-storefront')
                  : t(
                      'your-product-is-published-as-unlisted-set-it-to-active-on-shopify-admin-products-page-when-ready-to-sell'
                    )
                : t('your-first-product-is-live-subscribe-to-a-plan-to-publish-unlimited-products')}
            </Text>
          </BlockStack>

          {/* Aha reminder — product thumbnail callout */}
          <div className={styles.ahaReminder}>
            <img src={mockupImage} alt={product.title} className={styles.ahaThumbnail} />
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {hasSubscription
                ? t('great-work-your-product-is-ready-for-buyers')
                : t('ready-to-publish-more-like-this-masterpiece')}
            </Text>
          </div>

          {/* Pricing section for unsubscribed users */}
          {!hasSubscription
            && (orderedPlans.length > 0 ? (
              <>
                {(remainingTrialDays === null || remainingTrialDays > 0) && (
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    {t('enjoy-trial-days-free-to-explore-all-features-before-any-payment-is-required', {
                      trialDaysFree: remainingTrialDays,
                    })}
                  </Text>
                )}
                {mdDown ? (
                  <BlockStack gap="400">{planCards}</BlockStack>
                ) : (
                  <InlineGrid columns={orderedPlans.length} gap="400">
                    {planCards}
                  </InlineGrid>
                )}
                <SocialProofSection t={t} />
              </>
            ) : (
              <Box padding="400">
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              </Box>
            ))}
        </BlockStack>
      </div>
    )
  }

  const enabledAppEmbed = !!themeCfg.enabledAppEmbed
  const bothInstalled = enabledAppEmbed && appBlockInstalled

  // Phase A & B: Install + Ready
  return (
    <BlockStack gap="600">
      {/* Header — merchant-friendly outcome messaging (mode-aware) */}
      {!hideHeader && (
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            {t('your-product-is-ready-to-go-live')}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {publishMode === 'integrate-direct'
              ? t('add-personalization-directly-to-your-existing-product-the-original-product-will-be-modified')
              : t('we-ll-create-a-personalized-copy-of-your-product-your-original-product-stays-exactly-as-it-is')}
          </Text>
        </BlockStack>
      )}

      {/* Publish configuration — mode (clone vs direct) + optional featured-media replacement.
          Both toggles share the same visibility gate so the merchant's choices are locked
          once publish starts. */}
      {publishPhase !== 'publishing' && publishPhase !== 'completed' && (
        <BlockStack gap="400">
          <PublishModeToggle mode={publishMode} onChange={onPublishModeChange} />
          <ReplaceFeaturedMediaToggle
            checked={replaceFeaturedMedia}
            mode={publishMode}
            onChange={next => onReplaceFeaturedMediaChange(next, replaceFeaturedMedia)}
          />
        </BlockStack>
      )}

      {/* Hide Step 1 + Step 2 entirely when both are already done — the success
          banner below conveys the same information without extra noise. */}
      {!bothInstalled && (
        <>
          {/* Step 1: Enable theme extension (required for fallback to work) */}
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                {enabledAppEmbed ? t('step-1-theme-extension-enabled') : t('step-1-enable-theme-extension')}
              </Text>
              {!enabledAppEmbed && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  {t('this-lets-your-store-display-the-personalization-panel-on-product-pages')}
                </Text>
              )}
            </BlockStack>

            <Box paddingBlockStart="100">
              <InstallAppEmbedActivator
                appConfig={themeCfg}
                showDescription={false}
                revalidate={handleRevalidate}
                buttonProps={
                  enabledAppEmbed
                    ? undefined
                    : {
                        children: t('enable-theme-extension'),
                        loading: !themeConfigFetched,
                      }
                }
              />
            </Box>
          </BlockStack>

          <Divider />

          {/* Step 2: Install app block (optional — improves experience) */}
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                {appBlockInstalled ? t('step-2-app-block-installed') : t('step-2-install-app-block-optional')}
              </Text>
              {!appBlockInstalled && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  {t(
                    'For the best experience, add the app block to your product page. '
                      + 'If skipped, buyers will see a "Personalize" button instead.'
                  )}
                </Text>
              )}
            </BlockStack>

            <Box paddingBlockStart="100">
              {!appBlockInstalled ? (
                <InlineStack gap="200" align="start" blockAlign="center">
                  <Button
                    onClick={() => {
                      if (!customizerLink) {
                        console.error(
                          '[StorefrontPreviewStep] customizerLink is empty — appConfig may not have loaded yet'
                        )
                        return
                      }
                      onInstallingAppBlock()
                    }}
                    disabled={!customizerLink}
                    loading={!themeConfigFetched}
                  >
                    {t('install-app-block')}
                  </Button>
                  {showCountdown && (
                    <Button variant="monochromePlain" loading={isChecking} disabled>
                      {isChecking
                        ? t('installing')
                        : countdown > 0
                          ? t('installing-countdown-s', { countdown })
                          : t('installing')}
                    </Button>
                  )}
                  {installFailed && (
                    <Text as="span" variant="bodyMd" tone="caution">
                      {t('could-not-verify-installation-you-can-skip-this-step')}
                    </Text>
                  )}
                </InlineStack>
              ) : (
                <Button icon={CheckCircleIcon} disabled variant="primary">
                  {t('installed')}
                </Button>
              )}
            </Box>
          </BlockStack>

          <Divider />
        </>
      )}

      {/* Contextual guidance */}
      <BlockStack gap="300">
        {publishPhase === 'publishing' ? (
          <Box padding="800">
            <BlockStack gap="400" align="center">
              <InlineStack align="center">
                <Spinner size="large" />
              </InlineStack>
              <Text as="p" variant="bodyMd" alignment="center">
                {publishStepMessage
                  ? t(publishStepMessage)
                  : t('creating-your-personalized-product-and-publishing-it-to-your-storefront')}
              </Text>
            </BlockStack>
          </Box>
        ) : bothInstalled ? (
          <Banner tone="success">
            <Text as="p">
              {publishMode === 'integrate-direct'
                ? t(
                    'Your product is ready. Click "View it on storefront" to add personalization to '
                      + '"{{productTitle}}" directly. The original product will be modified.',
                    { productTitle: product.title }
                  )
                : t(
                    'Everything is set up. Click "View it on storefront" to create a personalized copy of '
                      + '"{{productTitle}}" and see it live. Your original product won\'t be changed.',
                    { productTitle: product.title }
                  )}
            </Text>
          </Banner>
        ) : enabledAppEmbed ? (
          <Banner tone="info">
            <Text as="p">
              {publishMode === 'integrate-direct'
                ? t(
                    'theme-extension-is-active-click-view-it-on-storefront-to-add-personalization-directly-to-your-product'
                  )
                : t(
                    'Theme extension is active. Click "View it on storefront" to create a personalized copy of your product. '
                      + "Your original product won't be changed."
                  )}
            </Text>
          </Banner>
        ) : (
          <Banner tone="warning">
            <Text as="p">
              {t('enable-the-theme-extension-above-so-buyers-can-see-the-personalization-panel-on-your-store')}
            </Text>
          </Banner>
        )}
      </BlockStack>
    </BlockStack>
  )
}
