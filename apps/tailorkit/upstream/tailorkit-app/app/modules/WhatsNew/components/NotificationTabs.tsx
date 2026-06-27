import type { TabProps } from '@shopify/polaris'
import { Box, Icon, InlineStack, Tabs, Text } from '@shopify/polaris'
import { StarFilledIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { NotificationTab } from '../types'

interface NotificationTabsProps {
  activeTab: NotificationTab
  onTabChange: (tab: NotificationTab) => void
}

/**
 * Tab navigation component for filtering notifications
 */
export function NotificationTabs({ activeTab, onTabChange }: NotificationTabsProps) {
  const { t } = useTranslation()

  const tabs: Array<TabProps> = [
    { id: 'all', content: t('all') },
    {
      id: 'hot-trends',
      // @ts-ignore
      content: (
        <InlineStack gap="100" wrap={false}>
          <Box width="20px">
            <Icon source={StarFilledIcon} tone="success" />
          </Box>
          <Text variant="bodyMd" tone="success" as="span">
            {t('hot-trends')}
          </Text>
        </InlineStack>
      ),
    },
    { id: 'new-features', content: t('new-features') },
    { id: 'tutorials', content: t('tutorials') },
    { id: 'promotions', content: t('promotions') },
    { id: 'unread', content: t('unread') },
  ]

  const selectedIndex = Math.max(
    0,
    tabs.findIndex(tab => tab.id === activeTab)
  )

  return (
    <Tabs
      tabs={tabs}
      selected={selectedIndex}
      onSelect={tabIndex => {
        const tab = tabs[tabIndex]
        if (tab) onTabChange(tab.id as NotificationTab)
      }}
    />
  )
}
