/**
 * Consumes ?openCreateFlow= from the URL and dispatches the merchant into the
 * matching create flow surface (Quick Setup wizard, ProductSelector with
 * charmMode, or the legacy CategorySelection grid for Full Editor).
 *
 * Single dispatcher pattern: the intent page and CreateFlowDropdown both
 * navigate to /dashboard?openCreateFlow=<flow> rather than dispatching
 * directly, so flow-launch logic lives in one place.
 *
 * One-shot: strips the param after handling so a refresh doesn't retrigger.
 */
import { useEffect } from 'react'
import { useSearchParams } from '@remix-run/react'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { CREATE_FLOWS } from '~/routes/api.onboarding-flow-router/constants'
import type { CreateFlow } from '~/models/Shop'

interface UseCreateFlowRouterOptions {
  // Matches useModal's exported `openModal: Function` shape — usage passes
  // arbitrary modal data objects (defaultSource, charmMode, etc.).
  openModal: Function
  setCreateWizardActive: (active: boolean) => void
  setOnboardingModalActive: (active: boolean) => void
  setForceLegacyOnboarding: (force: boolean) => void
  occurredEvents: Record<string, unknown> | undefined
  isChargeApproved: boolean
}

export function useCreateFlowRouter({
  openModal,
  setCreateWizardActive,
  setOnboardingModalActive,
  setForceLegacyOnboarding,
  occurredEvents,
  isChargeApproved,
}: UseCreateFlowRouterOptions): void {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const flow = searchParams.get('openCreateFlow')
    if (!flow) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('openCreateFlow')
        return next
      },
      { replace: true }
    )
    if (!(CREATE_FLOWS as readonly string[]).includes(flow)) {
      console.warn('[useCreateFlowRouter] Unknown openCreateFlow value:', flow)
      return
    }
    const validFlow = flow as CreateFlow
    if (validFlow === 'quick_setup') {
      setCreateWizardActive(true)
    } else if (validFlow === 'charm_builder') {
      // 'existing' = merchant's own Shopify products (ProductSelector default).
      // charmMode is consumed by handleProductSelect to append ?charmMode=true
      // to the editor URL.
      openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, {
        defaultSource: 'existing',
        charmMode: true,
      })
    } else if (validFlow === 'full_editor') {
      // Non-published shops: render OnboardingFlow.CategorySelection (premade
      // template grid → product selector with cloned premade → editor). The
      // intent page sets intentPageShown=true which makes useOnboarding skip
      // the auto-render branch, so we flip onboardingModalActive back on
      // explicitly here. forceLegacyOnboarding overrides the AB test branch.
      // Published shops OR subscribed shops: open ProductSelector directly.
      // Subscribed-but-unpublished merchants must not fall through to legacy
      // onboarding — useOnboarding would immediately cancel the modal because
      // isChargeApproved=true bypasses the onboarding gate, leaving the
      // merchant with a no-op page reload instead of the expected modal.
      // 'existing' = merchant's own Shopify products (an unknown source
      // would fall through to Printify — see api.products/route.ts:167).
      const hasPublished = Boolean(occurredEvents?.[CUSTOMERIO_EVENTS.PUBLISHED_FIRST_INTEGRATION])
      if (hasPublished || isChargeApproved) {
        openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, {
          defaultSource: 'existing',
        })
      } else {
        setForceLegacyOnboarding(true)
        setOnboardingModalActive(true)
      }
    }
  }, [
    searchParams,
    setSearchParams,
    setCreateWizardActive,
    openModal,
    occurredEvents,
    isChargeApproved,
    setOnboardingModalActive,
    setForceLegacyOnboarding,
  ])
}
