/* eslint-disable max-len */
import type { ClientLoaderFunctionArgs } from '@remix-run/react'
import { useLoaderData, useNavigate } from '@remix-run/react'
import { Badge, BlockStack, Box, Button, Collapsible, Icon, InlineStack, Page, Text } from '@shopify/polaris'
import { ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import reactQuillStyles from 'react-quill-new/dist/quill.snow.css?url'
import { TemplatesService } from '~/api/services/templates'
import { NavMenuItems } from '~/bootstrap/app-config'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import richTextEditorStyles from '~/components/.client/RichTextEditor/styles.css?url'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import AnnouncementComponent from '~/modules/Announcement'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { linksImageModalCSS } from '~/modules/modals'
import OnboardingTour from '~/modules/Onboarding'
import { buildPrebuiltPrintAreas } from '~/modules/ProductEditor/utilities/prebuiltPrintAreas'
import ProductSelector from '~/modules/ProductSelector'
import Review from '~/modules/Review'
import { templateEditorCSS } from '~/modules/TemplateEditor'
import { authenticatedFetch } from '~/shopify/fns.client'
import { checkUserHasProduct } from '~/shopify/graphql/products/fns.client'
import type { IProduct, IVariant } from '~/types/shopify-product'
import { useModal } from '~/utils/hooks/useModal'
import { useScrollIntoView } from '~/utils/hooks/useScrollIntoView'
import { duplicateClipartTemplate } from '~/utils/integration/templateDuplication'
import { showToast } from '~/utils/toastEvents'
import { uuid } from '~/utils/uuid'
import useInitIntegration from '../../modules/ProductEditor/hooks/useInitIntegration'
import { OCCURRED_EVENTS } from '../api.preferences/constants'
import { isApprovedCharge } from '~/models/PricingPlan.fns'
import { isInTrial } from '../api.pricing/utils/fns'
import { USER_JOURNEY_TYPE } from '../api.user-journey/constants'
import { trackEventStartCreateProduct } from '../personalized-products._index/fns/eventTracking'
import AppBlockStatusCard from './components/AppBlockStatusCard'
import AppsPromotionCard from './components/AppsPromotionCard'
import ThemesPromoCard from './components/ThemesPromoCard'
import ClipartShowcaseCard from './components/ClipartShowcaseCard'
import { OnboardingFlow } from './components/OnboardingFlow'
import { ACTIVE_PRODUCT_ONBOARDING_FLAG, SIMPLIFIED_ONBOARDING_AB_TEST_FLAG } from './components/OnboardingFlow/flags'
import { SimplifiedOnboardingInPage } from '~/modules/SimplifiedOnboarding'
import PublishToEarnModal from './components/PublishToEarnModal'
import { UsageCardTrial } from '~/routes/pricing._index/components/UsageCardComponents'
import { WhatsNewAlertIcon } from '~/modules/WhatsNew/components/WhatsNewAlertIcon'
import { WhatsNewModal } from '~/modules/WhatsNew/components/WhatsNewModal'
import { WhatsNewProvider } from '~/modules/WhatsNew/providers/WhatsNewProvider'
import { ComponentErrorBoundary } from '~/components/ErrorBoundary'
import OrderCards from './components/OrderCards'
import { ProductSuggestedCard } from './components/ProductSuggestedCard'
import PublishToEarnCard from './components/PublishToEarnCard'
import PublishToEarnCardSpacer from './components/PublishToEarnCardSpacer'
import PromoBannerNTIV2 from './components/PromoBannerNTIV2'
import SetupGuideCard, { PLAYGROUND_CARD_ANCHOR_ID } from './components/SetupGuideCard'
import { UserMilestonesConfettiEffect } from './components/UserMilestonesCard'
import { useOnboarding } from './hooks/useOnboarding'
import { useCreateFlowRouter } from './hooks/useCreateFlowRouter'
import dashboardStyles from './styles.css?url'
import { getOrdersData } from './utilities/fetchOrdersData'
import { dismissCardForever } from './utilities/dismissCardForever'
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { getTrackingDataFromCookie } from '~/utils/trackingCookie.server'
import Coupon, { applyCouponToShop, validateCoupon } from '~/models/Coupon.server'
import type { CouponDocument } from '~/models/Coupon'
import RedirectTracking from '~/models/RedirectTracking.server'
import { getActiveSubscriptionByShopDomain } from '~/models/Subscription.server'
import { getShopData } from '~/models/Shop.server'
import type { Template } from '~/types/psd'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import NeedHelpCard from './components/NeedHelpCard'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { initGlobalStylingIfNotExists } from '~/models/GlobalStyling.server'
import { handleCheckStorefrontAccessToken } from '~/services/storefront/storefront-access-token.server'
import NewPricingBannerNotification from './components/NewPricingBannerNotification'
import OldPricingAiCreditBanner from './components/OldPricingAiCreditBanner'

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request)
  const { shop } = session

  // Check and create storefront access token if needed (for OneTick addon variant feature)
  // Run async to not block the dashboard loading
  handleCheckStorefrontAccessToken(shop, admin, session).catch(error => {
    console.error('[Dashboard] Failed to check storefront access token:', error)
  })

  // Initialize GlobalStyling with checkbox defaults if not exists (for OneTick checkbox styling)
  // Also handles migration for existing shops
  initGlobalStylingIfNotExists(shop, admin).catch(error => {
    console.error('[Dashboard] Failed to init GlobalStyling:', error)
  })

  // Get data from tracking cookie
  const referalData = await getTrackingDataFromCookie(request)

  try {
    if (referalData?.queryParams.coupon) {
      // Get coupon
      const coupon = (await Coupon.findOne({ code: referalData.queryParams.coupon })) as CouponDocument

      if (coupon) {
        // Update the coupon to valid for current shop
        if (!coupon.applyTo?.includes(shop)) {
          await Coupon.updateOne(
            { code: referalData.queryParams.coupon },
            { applyTo: [...(coupon?.applyTo || []), shop] }
          )
        }

        // Don't apply new coupon automatically if subscription already has a "valid" coupon
        const subscription = await getActiveSubscriptionByShopDomain(shop)
        const shopData = await getShopData(shop)
        if (!subscription || !shopData) return null

        if (subscription.couponCode) {
          const isValidCoupon = await validateCoupon(subscription.couponCode, shopData)

          if (isValidCoupon) {
            return null
          }
        }

        // Apply coupon to shop
        await applyCouponToShop(referalData.queryParams.coupon, shop)

        // Update redirect tracking
        await RedirectTracking.updateOne({ _id: referalData._id }, { appliedCoupon: shop })
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (referalData && message === 'Coupon was applied') {
      await RedirectTracking.updateOne({ _id: referalData._id }, { appliedCoupon: shop })
    } else {
      console.error(error)
    }
  }

  return null
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const { searchParams } = new URL(request.url)
  const chargeApproved = searchParams.get('approved') === 'true'

  const [shop, ordersData, userJourneyRes, userHasProduct, firstTemplateIntegrationRes] = await Promise.all([
    authenticatedFetch('/api/preferences'),
    getOrdersData(),
    authenticatedFetch(`/api/user-journey?type=${USER_JOURNEY_TYPE.ONBOARDING}`),
    checkUserHasProduct(),
    authenticatedFetch('/api/first-template-integration'),
  ])

  const { numberOfOrders = 0, totalRevenues = 0 } = ordersData || {}

  // Inject firstTemplateWithIntegration into shop.appConfig
  if (firstTemplateIntegrationRes?.success && firstTemplateIntegrationRes?.data) {
    shop.appConfig = shop.appConfig || {}
    shop.appConfig.userFirstActions = shop.appConfig.userFirstActions || {}
    shop.appConfig.userFirstActions.firstTemplateWithIntegration = firstTemplateIntegrationRes.data
  }

  return {
    shop,
    numberOfOrders,
    totalRevenues,
    userJourneyRes,
    userHasProduct,
    chargeApproved,
  }
}

export const links: LinksFunction = () => [
  ...templateEditorCSS,
  ...linksImageModalCSS,
  { rel: 'preload', href: dashboardStyles, as: 'style' },
  { rel: 'preload', href: reactQuillStyles, as: 'style' },
  { rel: 'preload', href: richTextEditorStyles, as: 'style' },
]

clientLoader.hydrate = true

export function HydrateFallback() {
  // Return null because we run ClientOnly. Set a fallback for each route
  return null
}

function Index(props: WithTranslationProps) {
  const { t } = useTranslation()
  const {
    onboardingModalActive,
    setOnboardingModalActive,
    hydrated,
    forceLegacyOnboarding,
    setForceLegacyOnboarding,
    createWizardActive,
    setCreateWizardActive,
  } = props as WithTranslationProps & {
    forceLegacyOnboarding: boolean
    setForceLegacyOnboarding: (value: boolean) => void
    createWizardActive: boolean
    setCreateWizardActive: (active: boolean) => void
  }
  const { shop, numberOfOrders, totalRevenues, chargeApproved } = useLoaderData<typeof clientLoader>()
  const { appConfig = {}, shopConfig = {} } = shop || {}
  // Memoize so useEffect deps that depend on occurredEvents don't re-fire
  // on every render (the `?? {}` fallback would otherwise produce a fresh
  // object identity each time when the field is missing).
  const occurredEvents = useMemo(() => appConfig?.occurredEvents || {}, [appConfig?.occurredEvents])

  const [refresh, setRefresh] = useState(false)
  const [trialUsageDismissed, setTrialUsageDismissed] = useState(false)
  const navigate = useNavigate()

  const isInTrialPeriod = useMemo(() => isInTrial(shop.subscription), [shop.subscription])
  const isChargeApproved = useMemo(() => isApprovedCharge(shop as any), [shop])

  const { trackEvent } = useEventsTracking()
  const { prepareVariantsSelected } = useInitIntegration()
  const { openModal, closeModal, state, setModalData } = useModal()

  const productSelectorModalState = state?.[MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID]
  const productSelectorModal = productSelectorModalState?.active
  const productId = productSelectorModalState?.data?.productId
  const defaultSource = productSelectorModalState?.data?.defaultSource
  const autoSelectAllVariants = productSelectorModalState?.data?.autoSelectAllVariants
  const nonExistingProductData = productSelectorModalState?.data?.nonExistingProductData
  const clipartSelection = productSelectorModalState?.data?.clipartSelection
  // Charm-mode flag lives in modal data (auto-cleared on close via onClearModalData)
  // — never a standalone state to avoid lifecycle leaks across other dashboard surfaces
  // that open the same ProductSelector modal.
  const charmModeRequested = productSelectorModalState?.data?.charmMode === true

  // Consume ?openCreateFlow= from URL (set by intent page redirect or dropdown).
  // Logic lives in a dedicated hook so the dispatcher can be reused / tested
  // and dashboard/route.tsx stays under the project's file-size budget.
  useCreateFlowRouter({
    openModal,
    setCreateWizardActive,
    setOnboardingModalActive,
    setForceLegacyOnboarding,
    occurredEvents,
    isChargeApproved,
  })

  // Show success toast after plan approval and clean up URL
  useEffect(() => {
    if (chargeApproved && typeof window !== 'undefined') {
      trackEvent(EVENTS_TRACKING.PRICING_CHECKOUT_RESULT, {
        [EVENTS_PARAMETERS_NAME.CHECKOUT_OUTCOME]: 'approved',
      })
      showToast(t('payment-successful'))
      navigate('/dashboard', { replace: true })
    }
  }, [chargeApproved, navigate, t, trackEvent])

  const handleLearnMore = useCallback(() => {
    navigate(NavMenuItems.PRICING)
  }, [navigate])

  const handleDismissTrialUsage = useCallback(() => {
    setTrialUsageDismissed(true)
    dismissCardForever(OCCURRED_EVENTS.TRIAL_USAGE_CARD_DASHBOARD_DISMISSED)
  }, [])

  const toggleProductSelector = useCallback(() => {
    const toggleFunc = productSelectorModal ? closeModal : openModal

    if (productSelectorModal) {
      // Send event tracking close product selector modal
      trackEvent(EVENTS_TRACKING.CLOSE_PRODUCT_SELECTOR_MODAL)
    }

    // Toggle product selector modal
    toggleFunc(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)
  }, [productSelectorModal, closeModal, openModal, trackEvent])

  const handleProductSelect = useCallback(
    async (_products: IProduct[], variants: IVariant[]) => {
      // Send event tracking start create product
      trackEventStartCreateProduct(trackEvent)

      try {
        // If clipart has been selected from showcase, create a REAL template by cloning it first
        // and pass the cloned template detail as the payload so integration saving works.
        let templatePayload: Template | undefined
        if (Array.isArray(clipartSelection) && clipartSelection.length) {
          const firstSelected = clipartSelection[0]
          try {
            const cloneResult = await duplicateClipartTemplate(firstSelected._id)

            if (cloneResult?.success && cloneResult?.data?.templateId) {
              // Track clipart conversion
              try {
                const convertEventProps = {
                  [EVENTS_PARAMETERS_NAME.CLIPART_ID]: firstSelected._id,
                  [EVENTS_PARAMETERS_NAME.CLIPART_NAME]: firstSelected.alt || firstSelected.name || '',
                  [EVENTS_PARAMETERS_NAME.ID]: cloneResult.data.templateId,
                  [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'dashboard_showcase',
                }
                trackEvent(EVENTS_TRACKING.CLIPART_CONVERT, convertEventProps)
              } catch (e) {
                console.error('[TK Analytics] Failed to track CLIPART_CONVERT', e)
              }

              // Fetch full template detail for IDB storage and preview initialization
              templatePayload = await TemplatesService.getByIds([cloneResult.data.templateId]).then(arr => arr?.[0])
            } else {
              // Fallback: use clipart details (ephemeral) if cloning failed for any reason
              const details = await TemplatesService.getClipartsDetails(clipartSelection)
              templatePayload = details?.[0] || undefined
            }
          } catch (e) {
            // Fallback on error: use clipart details (ephemeral)
            const details = await TemplatesService.getClipartsDetails(clipartSelection)
            templatePayload = details?.[0] || undefined
          }
        }

        const integrationId = uuid()

        // Build prebuilt print areas map for stable IDs in URL and generator
        const { prebuiltPrintAreasByVariantId, selectedPrintAreaId } = buildPrebuiltPrintAreas(variants)

        // IMPORTANT: Wait for prepareVariantsSelected to complete before navigating
        // This ensures template is fully saved to IDB before the integration screen loads
        const integrationUrl = await prepareVariantsSelected({
          variants,
          integrationId,
          template: templatePayload,
          prebuiltPrintAreasByVariantId,
          selectedPrintAreaId,
        })

        // Add small delay to ensure IDB transaction is fully committed
        // This prevents race condition where PrintAreaTemplateItem loads before IDB sync
        await new Promise(resolve => setTimeout(resolve, 100))

        // If the merchant entered via the Charm Builder flow, append charmMode=true
        // so the unified editor pre-creates a CHARM_NODE layer on mount.
        // (charmModeRequested is derived from modal data — auto-cleared on modal close.)
        if (charmModeRequested) {
          const separator = integrationUrl.includes('?') ? '&' : '?'
          navigate(`${integrationUrl}${separator}charmMode=true`)
        } else {
          navigate(integrationUrl)
        }
      } catch (error) {
        console.error('[Dashboard] Failed to initialize personalized product editor:', error)
      }
    },
    [navigate, prepareVariantsSelected, trackEvent, clipartSelection, charmModeRequested]
  )

  const onRefresh = useCallback(() => {
    setRefresh(!refresh)
  }, [refresh])

  useScrollIntoView({ paramKey: 'goto' })

  useLayoutEffect(() => {
    if (appConfig?.requiredFulfillmentServices && Object.values(appConfig?.requiredFulfillmentServices).some(Boolean)) {
      navigate(NavMenuItems.PROVIDERS)
    }
  }, [appConfig?.requiredFulfillmentServices, navigate])

  useLayoutEffect(() => {
    // Return if onboarding modal is active
    if (onboardingModalActive) return

    trackEvent(EVENTS_TRACKING.OPEN_DASHBOARD_INDEX)
  }, [trackEvent, onboardingModalActive])

  // subscription.plan is `string | PricingPlanDocument` — only the populated
  // (object) shape exposes name/alias. String form is the raw plan id.
  const subscriptionPlan
    = shop?.subscription?.plan && typeof shop.subscription.plan === 'object'
      ? (shop.subscription.plan as PricingPlanDocument)
      : null
  const planName = subscriptionPlan?.name || subscriptionPlan?.alias || ''

  // Determine if user has published a product (experienced user)
  const hasPublishedProduct = Boolean(occurredEvents?.[CUSTOMERIO_EVENTS.PUBLISHED_FIRST_INTEGRATION])

  // Collapsible state for onboarding sections — collapsed by default for experienced users
  const [onboardingSectionsOpen, setOnboardingSectionsOpen] = useState(!hasPublishedProduct)

  const handleToggleOnboarding = useCallback(() => {
    setOnboardingSectionsOpen(prev => !prev)
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    setForceLegacyOnboarding(false)
    setOnboardingModalActive(false)
  }, [setOnboardingModalActive, setForceLegacyOnboarding])

  if (!hydrated) return <Fragment />

  return (
    <Fragment>
      {createWizardActive ? (
        <SimplifiedOnboardingInPage
          active
          appConfig={appConfig || {}}
          onComplete={() => setCreateWizardActive(false)}
          onSkip={() => setCreateWizardActive(false)}
          entryPoint="dashboard_create"
          backAction={{ content: t('dashboard'), onAction: () => setCreateWizardActive(false) }}
        />
      ) : onboardingModalActive ? (
        // Story header removed — install intent page now serves as the first-impression surface.
        // OnboardingFlow's CategorySelection (control) or SimplifiedOnboardingInPage (treatment)
        // renders directly for non-published shops.
        // forceLegacyOnboarding overrides the AB test for merchants who explicitly
        // chose Full Editor from intent page/dropdown.
        SIMPLIFIED_ONBOARDING_AB_TEST_FLAG && props.abTestGroup === 'treatment' && !forceLegacyOnboarding ? (
          <SimplifiedOnboardingInPage
            active={onboardingModalActive}
            appConfig={appConfig || {}}
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingComplete}
            entryPoint="dashboard_onboarding"
          />
        ) : ACTIVE_PRODUCT_ONBOARDING_FLAG ? (
          // Back button shown only when the merchant explicitly opted into Full Editor
          // (from intent page or dropdown). Gates on forceLegacyOnboarding so the
          // auto-rendered onboarding path keeps its no-back-button behavior.
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            onBack={forceLegacyOnboarding ? handleOnboardingComplete : undefined}
          />
        ) : (
          <OnboardingTour onRefresh={onRefresh} />
        )
      ) : (
        <ComponentErrorBoundary fallback={<></>}>
          <WhatsNewProvider>
            <Page title={!onboardingModalActive ? t('dashboard') : undefined} secondaryActions={<WhatsNewAlertIcon />}>
              <Fragment>
                <BlockStack gap={'400'}>
                  {/* System alerts — always at the top */}
                  <AnnouncementComponent t={t} dataSource="/api/announcement" fetchFunction={authenticatedFetch} />
                  <NewPricingBannerNotification shop={shop} />
                  <OldPricingAiCreditBanner shop={shop} />

                  {!occurredEvents?.[OCCURRED_EVENTS.TRIAL_USAGE_CARD_DASHBOARD_DISMISSED] && !trialUsageDismissed && (
                    <UsageCardTrial
                      shop={shop}
                      t={t}
                      progressBarSize="small"
                      onDismiss={handleDismissTrialUsage}
                      header={
                        <InlineStack gap="200" blockAlign="center">
                          <Text as="h3" variant="headingMd" fontWeight="semibold">
                            {t('your-trial-usage')}
                          </Text>
                          {planName && <Badge tone="info">{planName}</Badge>}
                        </InlineStack>
                      }
                      footer={
                        <Box>
                          <Button onClick={handleLearnMore}>{t('learn-more')}</Button>
                        </Box>
                      }
                    />
                  )}

                  {/* 1. App Block / App Embed Status — critical system alerts */}
                  {appConfig && <AppBlockStatusCard appConfig={appConfig} />}

                  {/* 2a. First-timer reorder: Setup Guide before Performance.
                         Performance summary on a fresh shop is a wall of zeros that
                         signals failure before the merchant sees the next action; promoting
                         the action card frames the dashboard as "here's your next step". */}
                  {!hasPublishedProduct && appConfig && <SetupGuideCard appConfig={appConfig} />}

                  {/* 2b. Performance Summary — primary metrics for returning merchants */}
                  <OrderCards
                    numberOfOrders={numberOfOrders}
                    totalRevenues={totalRevenues}
                    shopifyMoneyFormat={shopConfig?.money_format || ''}
                    usageFee={shop.usages?.discountedUsageFee}
                  />

                  {/* 3. Get Started & Playground — collapsible for experienced users */}
                  {hasPublishedProduct && (
                    <Box>
                      <Button
                        variant="plain"
                        onClick={handleToggleOnboarding}
                        icon={<Icon source={onboardingSectionsOpen ? ChevronUpIcon : ChevronDownIcon} />}
                      >
                        {onboardingSectionsOpen
                          ? t('hide-onboarding-and-playground')
                          : t('view-onboarding-and-playground')}
                      </Button>
                    </Box>
                  )}
                  <Collapsible
                    open={onboardingSectionsOpen}
                    id="onboarding-playground-collapsible"
                    transition={{ duration: '300ms', timingFunction: 'ease-in-out' }}
                  >
                    <BlockStack gap="400">
                      {/* Returning-merchant variant of Setup Guide stays inside the
                          collapsible (skipped for first-timers since they already saw the
                          full variant above Performance). */}
                      {hasPublishedProduct && appConfig && <SetupGuideCard appConfig={appConfig} />}
                      <PromoBannerNTIV2 />
                      {!occurredEvents?.[OCCURRED_EVENTS.CLIPART_SHOWCASE_CARD_DASHBOARD_DISMISSED] && (
                        <div id={PLAYGROUND_CARD_ANCHOR_ID}>
                          <ClipartShowcaseCard />
                        </div>
                      )}
                    </BlockStack>
                  </Collapsible>

                  <PublishToEarnModal />

                  {/* Review banner — eligibility/suppression handled inside useReview */}
                  <Review page="dashboard" />

                  {/* Show product suggested card if first integration published */}
                  {!occurredEvents?.[OCCURRED_EVENTS.PRODUCT_SUGGESTED_CARD_DASHBOARD_DISMISSED]
                    && hasPublishedProduct && <ProductSuggestedCard />}
                  {!occurredEvents?.[OCCURRED_EVENTS.NEED_HELP_CARD_DASHBOARD_DISMISSED] && <NeedHelpCard />}

                  {/* 4. Cross-sell / Upsell — bottom of page */}
                  {!occurredEvents?.[OCCURRED_EVENTS.TRY_OUR_OTHER_APPS_CARD_DASHBOARD_DISMISSED] && (
                    <AppsPromotionCard />
                  )}
                  {!occurredEvents?.[OCCURRED_EVENTS.THEMES_PROMO_CARD_DASHBOARD_DISMISSED] && hasPublishedProduct && (
                    <ThemesPromoCard />
                  )}
                </BlockStack>

                {isInTrialPeriod && <UserMilestonesConfettiEffect />}

                {/* Dynamic spacer that adjusts height based on PublishToEarnCard to prevent content overlap */}
                <PublishToEarnCardSpacer />
                {/* Publish to Earn floating card */}
                <PublishToEarnCard />
              </Fragment>
              <WhatsNewModal />
            </Page>
          </WhatsNewProvider>
        </ComponentErrorBoundary>
      )}

      {productSelectorModal && (
        <ProductSelector
          nonExistingProductData={nonExistingProductData}
          productId={productId}
          autoSelectAllVariants={autoSelectAllVariants}
          open={productSelectorModal}
          defaultSource={defaultSource}
          clipartSelection={clipartSelection}
          onClose={toggleProductSelector}
          onSelect={handleProductSelect}
          onClearModalData={() => {
            setModalData(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, null)
          }}
        />
      )}
    </Fragment>
  )
}

export default EnhancedIndex

function EnhancedIndex() {
  const { t } = useTranslation()
  const {
    onboardingModalActive,
    setOnboardingModalActive,
    abTestGroup,
    hydrated,
    forceLegacyOnboarding,
    setForceLegacyOnboarding,
  } = useOnboarding()

  // Lifted here so withNavMenu can read it to hide nav items during the wizard
  // for unsubscribed merchants (see withNavMenu.tsx).
  const [createWizardActive, setCreateWizardActive] = useState(false)

  const Component = useMemo(
    () => (onboardingModalActive ? Index : withNavMenu(withIdleTracker(withInteractiveChat(Index), 'dashboard'))),
    [onboardingModalActive]
  )

  if (!hydrated) return <Fragment />

  return (
    <Component
      onboardingModalActive={onboardingModalActive}
      hydrated={hydrated}
      setOnboardingModalActive={setOnboardingModalActive}
      abTestGroup={abTestGroup}
      forceLegacyOnboarding={forceLegacyOnboarding}
      setForceLegacyOnboarding={setForceLegacyOnboarding}
      createWizardActive={createWizardActive}
      setCreateWizardActive={setCreateWizardActive}
      t={t}
    />
  )
}
