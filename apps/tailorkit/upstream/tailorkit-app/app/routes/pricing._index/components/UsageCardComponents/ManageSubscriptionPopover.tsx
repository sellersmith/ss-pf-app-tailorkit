import { useCallback, useState } from 'react'
import { ActionList, Button, Popover } from '@shopify/polaris'
import { MenuHorizontalIcon } from '@shopify/polaris-icons'
import type { TFunction } from 'i18next'
import { navigateToShopifyAdmin } from '~/utils/shopify'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'

interface ManageSubscriptionPopoverProps {
  t: TFunction
  /** Called when merchant chooses "Change plan" — scroll to / focus the plan cards. */
  onChangePlan: () => void
}

/**
 * Top-right manage menu for the subscriber Billing card.
 *
 * Actions:
 * - Change plan         → in-app (plan cards already on page)
 * - View invoices & payment → Shopify Admin /settings/billing (new tab)
 * - Manage Shopify plan → Shopify Admin /settings/plan       (new tab)
 *
 * Cancellation is handled by uninstalling the app (Shopify auto-cancels the
 * recurring charge); we surface that fact passively elsewhere on the card —
 * no in-app cancel control here.
 */
export function ManageSubscriptionPopover(props: ManageSubscriptionPopoverProps) {
  const { t, onChangePlan } = props
  const [open, setOpen] = useState(false)
  const { trackEvent } = useEventsTracking()

  const togglePopover = useCallback(() => setOpen(prev => !prev), [])
  const closePopover = useCallback(() => setOpen(false), [])

  const fireAction = useCallback(
    (action: string) => {
      trackEvent(EVENTS_TRACKING.BILLING_ACTION_CLICK, {
        [EVENTS_PARAMETERS_NAME.ACTION]: action,
      })
    },
    [trackEvent]
  )

  const items = [
    {
      content: t('change-plan'),
      onAction: () => {
        fireAction('change_plan')
        closePopover()
        onChangePlan()
      },
    },
    {
      content: t('view-invoices-and-payment'),
      onAction: () => {
        fireAction('view_invoices')
        closePopover()
        navigateToShopifyAdmin('/settings/billing')
      },
    },
    {
      content: t('manage-shopify-plan'),
      onAction: () => {
        fireAction('manage_shopify_plan')
        closePopover()
        navigateToShopifyAdmin('/settings/plan')
      },
    },
  ]

  const activator = (
    <Button
      variant="tertiary"
      icon={MenuHorizontalIcon}
      onClick={togglePopover}
      accessibilityLabel={t('manage-subscription')}
    />
  )

  return (
    <Popover active={open} activator={activator} onClose={closePopover} preferredAlignment="right">
      <ActionList actionRole="menuitem" items={items} />
    </Popover>
  )
}
