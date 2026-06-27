/**
 * Shared "Create" button with a dropdown for flow choice.
 *
 * Replaces the single create-button + A/B-test gate that used to live on
 * Dashboard / Templates / Personalized Products / OnboardingFlow modal.
 *
 * Behavior:
 * - Main button click → invokes the merchant's last-used flow (or Quick Setup
 *   for new merchants).
 * - Chevron click → opens menu with all 3 flows.
 * - Picking an option persists `lastCreateFlow` so the next click defaults to
 *   it cross-device.
 * - All invocations route via `/dashboard?openCreateFlow=<flow>` so the
 *   dashboard's existing param consumer handles the actual modal/wizard
 *   activation. One source of truth for flow launch.
 */

import { useCallback, useState } from 'react'
import { ActionList, Button, ButtonGroup, Popover } from '@shopify/polaris'
import { useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { authenticatedFetch } from '~/shopify/fns.client'
import { ONBOARDING_FLOW_ROUTER_ACTIONS } from '~/routes/api.onboarding-flow-router/constants'
import type { CreateFlow } from '~/models/Shop'
import { CREATE_FLOW_OPTIONS, DEFAULT_CREATE_FLOW, getOption } from './options'

export type CreateFlowSurface =
  | 'dashboard_setup_guide'
  | 'dashboard_product_suggested'
  | 'templates'
  | 'products'
  | 'onboarding_modal'

export interface CreateFlowDropdownProps {
  /** Per-shop preference. null/undefined = new merchant; falls back to Quick Setup. */
  lastCreateFlow: CreateFlow | null | undefined
  /** Surface tag attached to the CREATE_FLOW_INVOKED tracking event. */
  surface: CreateFlowSurface
  /** Optional override for the main button label (e.g. "Create template" on Templates). */
  label?: string
  /** Optional side-effect fired before flow invocation. Use for legacy tracking
   *  events that don't fit CREATE_FLOW_INVOKED (e.g. SETUP_GUIDE_CREATE_TEMPLATE). */
  onBeforeInvoke?: (flow: CreateFlow) => void
}

export function CreateFlowDropdown({ lastCreateFlow, surface, label, onBeforeInvoke }: CreateFlowDropdownProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { trackEvent } = useEventsTracking()
  const [menuOpen, setMenuOpen] = useState(false)

  const defaultFlow: CreateFlow = lastCreateFlow ?? DEFAULT_CREATE_FLOW
  const defaultLabel = label ?? t(getOption(defaultFlow).title)

  const invokeFlow = useCallback(
    (flow: CreateFlow, isDefaultAction: boolean) => {
      onBeforeInvoke?.(flow)

      // Optimistic persist — never block navigation on this. Log on failure so
      // a silent breakage in the persistence path is observable in dev tools.
      void authenticatedFetch('/api/onboarding-flow-router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: ONBOARDING_FLOW_ROUTER_ACTIONS.SET_LAST_CREATE_FLOW,
          flow,
        }),
      }).catch((err: unknown) => {
        console.error('[CreateFlowDropdown] Failed to persist lastCreateFlow:', err)
      })

      trackEvent(EVENTS_TRACKING.CREATE_FLOW_INVOKED, {
        flow_chosen: flow,
        surface,
        is_default_action: isDefaultAction,
      })

      // Single source of truth: route to dashboard, let it open the right modal/wizard.
      navigate(`/dashboard?openCreateFlow=${flow}`)
    },
    [navigate, surface, trackEvent, onBeforeInvoke]
  )

  const handleMainClick = useCallback(() => {
    invokeFlow(defaultFlow, true)
  }, [invokeFlow, defaultFlow])

  const handleOptionClick = useCallback(
    (flow: CreateFlow) => {
      setMenuOpen(false)
      invokeFlow(flow, false)
    },
    [invokeFlow]
  )

  return (
    <ButtonGroup variant="segmented">
      <Button variant="primary" onClick={handleMainClick}>
        {defaultLabel}
      </Button>
      <Popover
        active={menuOpen}
        onClose={() => setMenuOpen(false)}
        activator={
          <Button
            variant="primary"
            disclosure={menuOpen ? 'up' : 'down'}
            onClick={() => setMenuOpen(prev => !prev)}
            accessibilityLabel={t('choose-flow')}
          />
        }
      >
        <ActionList
          actionRole="menuitem"
          items={CREATE_FLOW_OPTIONS.map(opt => ({
            content: t(opt.title),
            helpText: t(opt.subtitle),
            icon: opt.icon,
            active: opt.flow === defaultFlow,
            onAction: () => handleOptionClick(opt.flow),
          }))}
        />
      </Popover>
    </ButtonGroup>
  )
}
