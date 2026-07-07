import type { AdminAppHost } from '../../../../web/core/src/app-platform/admin'
import React from 'react'
import { AppProvider as PolarisAppProvider } from '@shopify/polaris'
import polarisTranslations from '@shopify/polaris/locales/en.json'
import { matchTailorKitProductPersonalizerCopiedRoute } from '../domain/product-personalizer-admin-route-host-contract'
import { TailorKitCopiedRouteHost } from './copied-routes/host'
import { TailorKitNavShell } from './nav-shell'

interface TailorKitAdminProps {
  host: AdminAppHost
}

// The PP ProductEditor (`personalized-products.$id`) and its loading route own the full viewport, so the
// persistent sidebar is suppressed for them. List-type screens (orders list/detail, PP list) render inside
// the sidebar shell.
function isFullBleedRoute(host: AdminAppHost): boolean {
  const route = matchTailorKitProductPersonalizerCopiedRoute(host.route.fullPath)
  return route?.routeId === 'personalized-products.$id' || route?.routeId === 'personalized-products.loading'
}

/** TailorKit wholesale copy-first migration: active admin shell mounts copied TailorKit routes only. */
export const TailorKitAdmin: React.FC<TailorKitAdminProps> = ({ host }) => {
  // The shell itself renders Polaris components (nav-shell buttons/cards, copied-route-host loading/error
  // banners), so it MUST provide the Polaris i18n context. The copied-route runtime mounts into its own
  // React root with its own AppProvider, so this wrapper only serves the shell's own Polaris usage.
  const shell = isFullBleedRoute(host) ? (
    <TailorKitCopiedRouteHost host={host} />
  ) : (
    <TailorKitNavShell host={host}>
      <TailorKitCopiedRouteHost host={host} />
    </TailorKitNavShell>
  )

  return <PolarisAppProvider i18n={polarisTranslations}>{shell}</PolarisAppProvider>
}

export default TailorKitAdmin
