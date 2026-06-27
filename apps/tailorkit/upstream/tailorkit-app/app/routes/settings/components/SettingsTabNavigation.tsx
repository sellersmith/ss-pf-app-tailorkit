// Settings tab navigation component
import { useLocation } from '@remix-run/react'
import { Tabs } from '@shopify/polaris'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { useSettingsSaveBar } from '../contexts/SettingsSaveBarContext'

const basePath = '/settings'

function SettingsTabNavigation() {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  const location = useLocation()
  const pathname = location.pathname
  const { hasPendingChanges } = useSettingsSaveBar()

  const tabs = useMemo(
    () => [
      {
        id: 'preferences',
        content: t('preferences'),
        url: `${basePath}/preferences`,
      },
      // {
      //   id: 'billing',
      //   content: t('billing'),
      //   url: `${basePath}/billing`,
      // },
      {
        id: 'account',
        content: t('account'),
        url: `${basePath}/account`,
      },
      {
        id: 'providers',
        content: t('providers'),
        url: `${basePath}/providers`,
      },
    ],
    [t]
  )

  // Find the current active tab index
  const activeTabIndex = useMemo(() => {
    const activeTab = tabs.findIndex(tab => tab.url === pathname)
    return activeTab >= 0 ? activeTab : -1
  }, [pathname, tabs])

  const [selected, setSelected] = useState(activeTabIndex)

  useEffect(() => {
    setSelected(activeTabIndex)
  }, [activeTabIndex])

  useEffect(() => {
    // Set default to first tab if no matching tab found
    if (activeTabIndex === -1 && tabs.length > 0) {
      navigate(tabs[0].url)
    }
  }, [activeTabIndex, tabs, navigate])

  const handleTabChange = (selectedTabIndex: number) => {
    if (hasPendingChanges) {
      // Trigger Shopify's default save bar behavior
      navigate('/')
      return
    }
    setSelected(selectedTabIndex)
    navigate(tabs[selectedTabIndex].url)
  }

  return (
    <Tabs
      tabs={tabs.map(tab => ({ content: tab.content, id: tab.id }))}
      selected={selected}
      onSelect={handleTabChange}
    />
  )
}

export default SettingsTabNavigation
