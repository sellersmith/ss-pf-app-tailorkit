import type { AdminAppHost } from '../../../../web/core/src/app-platform/admin'
import React from 'react'
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
  if (isFullBleedRoute(host)) {
    return <TailorKitCopiedRouteHost host={host} />
  }

  return (
    <TailorKitNavShell host={host}>
      <TailorKitCopiedRouteHost host={host} />
    </TailorKitNavShell>
  )
}

export default TailorKitAdmin
