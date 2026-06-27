// Persistent TailorKit admin sidebar. Upstream used the app-bridge `NavMenu` (the `withNavMenu` HOC, now
// neutralized by the route-behavior shim); app-platform has no NavMenu, so this renders a left sidebar
// inside the PageFly embed and switches screens via `host.ports.navigation.navigate`.
//
// Only the screens PageFly has ported are shown (Personalized Products, Orders). Labels mirror TailorKit
// upstream (`app/bootstrap/hoc/withNavMenu.tsx`); unported upstream destinations are intentionally omitted
// (not shown disabled) per operator request — disabled items added no value.
import React from 'react'
import { Box, Card, InlineGrid, BlockStack, Button } from '@shopify/polaris'
import type { AdminAppHost } from '../../../../web/core/src/app-platform/admin'

interface TailorKitNavItem {
  id: string
  label: string
  /** Path relative to `host.routeBase` (matches the upstream TailorKit route, e.g. '/orders'). */
  path: string
}

// Ported, enabled destinations only. Order mirrors upstream nav.
const NAV_ITEMS: readonly TailorKitNavItem[] = [
  { id: 'personalized-products', label: 'Personalized Products', path: '/personalized-products' },
  { id: 'orders', label: 'Orders', path: '/orders' },
  { id: 'storefront-setup', label: 'Sales Tools', path: '/storefront-setup' },
]

function absolutePath(routeBase: string, path: string): string {
  return `${routeBase}${path}`
}

// Active when the current full path is, or is nested under, the item's absolute path. Longest match wins.
function activeItemId(host: AdminAppHost): string | null {
  const fullPath = host.route.fullPath.split(/[?#]/)[0] || ''
  let bestId: string | null = null
  let bestLen = -1
  for (const item of NAV_ITEMS) {
    const abs = absolutePath(host.routeBase, item.path)
    const matches = fullPath === abs || fullPath.startsWith(`${abs}/`)
    if (matches && abs.length > bestLen) {
      bestId = item.id
      bestLen = abs.length
    }
  }
  return bestId
}

interface TailorKitNavShellProps {
  host: AdminAppHost
  children: React.ReactNode
}

export const TailorKitNavShell: React.FC<TailorKitNavShellProps> = ({ host, children }) => {
  const activeId = activeItemId(host)

  const onNavigate = (item: TailorKitNavItem) => {
    host.ports.navigation.navigate(absolutePath(host.routeBase, item.path))
  }

  return (
    <Box padding="400">
      <InlineGrid columns={{ xs: '1fr', md: '240px 1fr' }} gap="400">
        <Box as="nav">
          <Card padding="200">
            <BlockStack gap="100">
              {NAV_ITEMS.map(item => (
                <Button
                  key={item.id}
                  variant={item.id === activeId ? 'primary' : 'tertiary'}
                  textAlign="left"
                  fullWidth
                  onClick={() => onNavigate(item)}
                >
                  {item.label}
                </Button>
              ))}
            </BlockStack>
          </Card>
        </Box>
        <Box minWidth="0">{children}</Box>
      </InlineGrid>
    </Box>
  )
}

export default TailorKitNavShell
