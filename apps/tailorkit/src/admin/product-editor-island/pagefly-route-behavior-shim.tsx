import React from 'react'
import { useTranslation } from 'react-i18next'

type TailorKitComponent = React.ComponentType<Record<string, unknown>>

/**
 * PageFly hosts TailorKit Product Personalizer as an app-scoped admin surface.
 * TailorKit route wrappers for tours, idle support, and feedback chrome are not
 * part of the V0.1 core listing/detail/save/publish flow, so they stay disabled
 * at the adapter boundary.
 *
 * IMPORTANT: upstream `withNavMenu` wraps its component in `withTranslation`, which injects a `t`
 * prop (`<Component {...props} t={t} />`). Some copied routes (e.g. orders) read `props.t` directly
 * rather than the `useTranslation()` hook — so this shim, which stands in for `withNavMenu`, MUST also
 * inject `t`, or `const { t } = props` is undefined and `t('orders')` throws at render. The runtime
 * already mounts an `I18nextProvider`, so `useTranslation()` resolves here.
 */
function withPageFlyRouteBehaviorShim(Component?: TailorKitComponent): TailorKitComponent {
  return function PageFlyTailorKitRouteBehaviorShim(props: Record<string, unknown>) {
    const { t } = useTranslation()
    return Component ? <Component {...props} t={t} /> : null
  }
}

export function useTourGuide() {
  return { tour: '' }
}

export async function getUserJourneyOfTourGuide() {
  return null
}

export function isTutorialGuide() {
  return false
}

export const withTourGuide = withPageFlyRouteBehaviorShim

export default withPageFlyRouteBehaviorShim
