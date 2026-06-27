import { Outlet, useNavigation } from '@remix-run/react'
import { Box, Page } from '@shopify/polaris'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import SettingsTabNavigation from './components/SettingsTabNavigation'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { useTranslation } from 'react-i18next'
import { ROUTE_SKELETONS } from '~/constants/route-skeletons'
import { SettingsSaveBarProvider, useSettingsSaveBar } from './contexts/SettingsSaveBarContext'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import useDevices from '~/utils/hooks/useDevice'

function SettingsContent() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { hasPendingChanges, isSaving, triggerSave, triggerDiscard } = useSettingsSaveBar()
  const { isSmallMobileView } = useDevices()

  const getSkeletonForRoute = (pathname: string | undefined) => {
    if (!pathname) return null

    // Find matching skeleton by checking if pathname starts with any key in ROUTE_SKELETONS
    const matchedPath = Object.keys(ROUTE_SKELETONS).find(path =>
      pathname.startsWith(path)
    ) as keyof typeof ROUTE_SKELETONS
    return matchedPath ? ROUTE_SKELETONS[matchedPath] : null
  }

  // Show skeleton when navigating OR when navigation.location exists (loader is running)
  const isNavigating = navigation.state !== 'idle' || !!navigation.location
  const targetPath = navigation.location?.pathname
  const skeleton = isNavigating && targetPath ? getSkeletonForRoute(targetPath) : null

  if (skeleton) {
    return skeleton
  }

  return (
    <Page title={t('settings')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <SettingsTabNavigation />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        {skeleton || <Outlet />}
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
    <SettingsSaveBarProvider>
      <SettingsContent />
    </SettingsSaveBarProvider>
  )
}

export default withNavMenu(withInteractiveChat(Index))
