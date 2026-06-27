// PageFly single-shell for the TailorKit Sales Tools (/storefront-setup) screen.
//
// The copied-route runtime renders ONE component per routeId and the `@remix-run/react` `Outlet` shim
// returns null — so the verbatim upstream parent route's `<Outlet/>` would never mount its tab bodies. This
// shell replaces that parent (upstream `Index` + `SaleToolsContent`): it owns the graft-pruned tab layout
// and pathname-switches between the 3 VERBATIM tab bodies instead of using `<Outlet/>`.
//
// Graft-and-prune vs upstream `app/routes/storefront-setup/route.tsx`:
//  - Pruned: the `FULL_PAGE_ROUTES` branch (quick-prompts/styling/checkboxes are out of scope, dropped).
//  - Pruned: `export { loader }` / `HydrateFallback` (server-only; the runtime feeds root loader data).
//  - Pruned: the `withIdleTracker(withInteractiveChat(withNavMenu(...)))` HOC chain — the PageFly nav-shell
//    already provides the admin chrome; the HOCs are app-bridge NavMenu wrappers with no role here.
//  - Pruned: the Upsell tab (`sales`) — it is OneTick, a separate product, not TailorKit. The shell owns a
//    PageFly 2-tab nav (Storefront default + AI Tools) instead of the verbatim 3-tab `SaleToolsTabNavigation`
//    so the upstream mirror stays byte-faithful and no removed tab renders a "route does not map" banner.
//  - Replaced: `<Outlet/>` → `renderActiveTab(pathname)` (the only host seam beyond the prunes above).
// Everything else (Page title, SaleToolsSaveBarProvider, ContextualSaveBar, the verbatim tab bodies) is the
// verbatim upstream component, imported through the `~/` aliases so their internals resolve to PageFly seams.
import { Box, Page, Tabs } from '@shopify/polaris'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
// PageFly-authored shell imports the Remix seams directly from the island shim (the same module the
// `@remix-run/react` Vite alias resolves to), so this active app file carries no forbidden upstream import.
import { useLocation } from '../product-editor-island/pagefly-remix-react-shim'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import useDevices from '~/utils/hooks/useDevice'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import {
  SaleToolsSaveBarProvider,
  useSaleToolsSaveBar,
} from '~/routes/storefront-setup/contexts/SaleToolsSaveBarContext'
import StorefrontTab from '~/routes/storefront-setup.storefront/route'
import AIToolsTab from '~/routes/storefront-setup.ai-tools/route'
import StorefrontSetupStylingView from './storefront-setup-styling-view'

const BASE_PATH = '/storefront-setup'

/** The `/storefront-setup/styling` sub-view is a full-page screen (own Page chrome + save bar), not a tab. */
const STYLING_SEGMENT = 'styling'

function activeSegment(pathname: string): string {
  return pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(`${BASE_PATH}/`.length).split('/')[0] : ''
}

/** Picks the verbatim tab body from the current TailorKit pathname (the host seam replacing `<Outlet/>`). */
function ActiveTabBody({ pathname }: { pathname: string }) {
  switch (activeSegment(pathname)) {
    case 'ai-tools':
      return <AIToolsTab />
    case 'storefront':
      return <StorefrontTab />
    default:
      // Bare /storefront-setup — the tab nav below redirects to the default tab; render nothing meanwhile.
      return null
  }
}

/**
 * PageFly 2-tab nav (Storefront default + AI Tools) replacing the verbatim 3-tab `SaleToolsTabNavigation`.
 * Replicates the upstream nav behaviour (active-tab sync, bare-base → default redirect, save-bar leave guard)
 * minus the dropped Upsell tab — so the upstream mirror file is never edited.
 */
function StorefrontSetupTabNavigation() {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  const { pathname } = useLocation()
  const { hasPendingChanges } = useSaleToolsSaveBar()

  const tabs = useMemo(
    () => [
      { id: 'storefront', content: t('storefront'), url: `${BASE_PATH}/storefront` },
      { id: 'ai-tools', content: t('ai-tools'), url: `${BASE_PATH}/ai-tools` },
    ],
    [t]
  )

  const activeTabIndex = useMemo(() => {
    const index = tabs.findIndex(tab => pathname.startsWith(tab.url))
    return index >= 0 ? index : -1
  }, [pathname, tabs])

  const [selected, setSelected] = useState(activeTabIndex)
  useEffect(() => setSelected(activeTabIndex), [activeTabIndex])

  useEffect(() => {
    // Only redirect when exactly on the bare base (not on a tab path).
    if (activeTabIndex === -1 && pathname === BASE_PATH && tabs.length > 0) navigate(tabs[0].url)
  }, [activeTabIndex, pathname, tabs, navigate])

  const handleTabChange = (selectedTabIndex: number) => {
    // Unsaved changes → bounce to `/` so the save bar's leave-confirmation runs (upstream parity).
    if (hasPendingChanges) {
      navigate('/')
      return
    }
    setSelected(selectedTabIndex)
    navigate(tabs[selectedTabIndex].url)
  }

  return (
    <Tabs tabs={tabs.map(tab => ({ content: tab.content, id: tab.id }))} selected={selected} onSelect={handleTabChange} />
  )
}

function SaleToolsContent() {
  const { t } = useTranslation()
  const location = useLocation()
  const { hasPendingChanges, isSaving, triggerSave, triggerDiscard } = useSaleToolsSaveBar()
  const { isSmallMobileView } = useDevices()

  return (
    <Page title={t('sales-tools')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <StorefrontSetupTabNavigation />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        <ActiveTabBody pathname={location.pathname} />
      </Box>
      <ContextualSaveBar
        isOpen={hasPendingChanges}
        loading={isSaving}
        onSave={triggerSave}
        onDiscard={triggerDiscard}
      />
    </Page>
  )
}

export default function TailorKitStorefrontSetupShell() {
  const location = useLocation()

  // The styling sub-view is a standalone full-page screen with its own Page chrome + ContextualSaveBar
  // (driven by its local styling-history state, not SaleToolsSaveBar) — render it outside the tab layout.
  if (activeSegment(location.pathname) === STYLING_SEGMENT) {
    return <StorefrontSetupStylingView />
  }

  return (
    <SaleToolsSaveBarProvider>
      <SaleToolsContent />
    </SaleToolsSaveBarProvider>
  )
}
