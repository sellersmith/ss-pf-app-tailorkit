import { Outlet, useLocation } from '@remix-run/react'
import { Box, Page } from '@shopify/polaris'
import { useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavMenuItems } from '~/bootstrap/app-config'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { HydrateFallback } from '~/routes/dashboard/route'
import useDevices from '~/utils/hooks/useDevice'
import SaleToolsTabNavigation from './components/SaleToolsTabNavigation'
import { SaleToolsSaveBarProvider, useSaleToolsSaveBar } from './contexts/SaleToolsSaveBarContext'

export { loader } from './loader.server'
export { HydrateFallback }

// Routes that should render as full pages (not within tabs)
const FULL_PAGE_ROUTES = [
  NavMenuItems.QUICK_PROMPTS,
  NavMenuItems.STOREFRONT_SETUP_STYLING,
  NavMenuItems.STOREFRONT_SETUP_CHECKBOXES,
]

function SaleToolsContent() {
  const { t } = useTranslation()
  const location = useLocation()
  const { hasPendingChanges, isSaving, triggerSave, triggerDiscard } = useSaleToolsSaveBar()
  const { isSmallMobileView } = useDevices()

  const [isLoading, setIsLoading] = useState(true)
  const [isFullPageRoute, setIsFullPageRoute] = useState(false)

  useLayoutEffect(() => {
    const isFullPage = FULL_PAGE_ROUTES.some(route => location.pathname.startsWith(route))
    setIsFullPageRoute(isFullPage)
    setIsLoading(false)
  }, [location.pathname])

  // Show loading state briefly to prevent flash
  if (isLoading) {
    return null
  }

  // For full page routes (quick-prompts, styling, checkboxes), render just the Outlet
  if (isFullPageRoute) {
    return <Outlet />
  }

  // For tab routes, render the tabbed layout
  return (
    <Page title={t('sales-tools')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <SaleToolsTabNavigation />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        <Outlet />
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

function Index() {
  return (
    <SaleToolsSaveBarProvider>
      <SaleToolsContent />
    </SaleToolsSaveBarProvider>
  )
}

export default withIdleTracker(withInteractiveChat(withNavMenu(Index)))
