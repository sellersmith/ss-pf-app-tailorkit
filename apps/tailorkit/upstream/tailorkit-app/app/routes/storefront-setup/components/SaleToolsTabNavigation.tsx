import { useLocation } from '@remix-run/react'
import { Tabs } from '@shopify/polaris'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { useSaleToolsSaveBar } from '../contexts/SaleToolsSaveBarContext'

const basePath = '/storefront-setup'

function SaleToolsTabNavigation() {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  const location = useLocation()
  const pathname = location.pathname
  const { hasPendingChanges } = useSaleToolsSaveBar()

  const tabs = useMemo(
    () => [
      {
        id: 'storefront',
        content: t('storefront'),
        url: `${basePath}/storefront`,
      },
      {
        id: 'sales',
        content: t('upsell'),
        url: `${basePath}/sales`,
      },
      {
        id: 'ai-tools',
        content: t('ai-tools'),
        url: `${basePath}/ai-tools`,
      },
    ],
    [t]
  )

  // Find the current active tab index
  const activeTabIndex = useMemo(() => {
    const activeTab = tabs.findIndex(tab => pathname.startsWith(tab.url))
    return activeTab >= 0 ? activeTab : -1
  }, [pathname, tabs])

  const [selected, setSelected] = useState(activeTabIndex)

  useEffect(() => {
    setSelected(activeTabIndex)
  }, [activeTabIndex])

  useEffect(() => {
    // Only redirect if we're exactly on /storefront-setup (not on sub-routes like /styling)
    if (activeTabIndex === -1 && pathname === basePath && tabs.length > 0) {
      navigate(tabs[0].url)
    }
  }, [activeTabIndex, pathname, tabs, navigate])

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

export default SaleToolsTabNavigation
