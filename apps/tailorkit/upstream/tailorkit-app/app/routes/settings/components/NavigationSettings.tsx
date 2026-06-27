import { useLocation, useNavigate } from '@remix-run/react'
import { ActionList, Box, Card, Icon, Text } from '@shopify/polaris'
import { PageReferenceIcon, ProfileIcon, ReceiptDollarIcon } from '@shopify/polaris-icons'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const path = '/settings'

function NavigationSettings() {
  const { t } = useTranslation()

  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname

  const navigationItems = useMemo(
    () => [
      {
        content: t('product-page'),
        url: `${path}/product-page`,
      },
      {
        content: t('account'),
        icon: ProfileIcon,
        url: `${path}/account`,
      },
      {
        content: t('billing'),
        icon: ReceiptDollarIcon,
        url: `${path}/billing`,
      },
      {
        content: t('preferences'),
        icon: PageReferenceIcon,
        url: `${path}/preferences`,
      },
    ],
    [t]
  )

  useEffect(() => {
    // Set default to first navigation item
    if (!navigationItems.filter(item => item.url === pathname)[0]) {
      navigate(navigationItems[0].url)
    }
  }, [pathname, navigationItems, navigate])

  return (
    <Box paddingBlockStart={'400'}>
      <Card padding="0" roundedAbove="sm">
        <Box background="bg-surface-tertiary" padding={'300'} borderBlockEndWidth="025" borderColor="border">
          <Text variant="headingMd" as="h1">
            {t('settings')}
          </Text>
        </Box>

        <ActionList
          actionRole="menuitem"
          items={navigationItems.map(item => {
            const active = item.url === pathname

            return {
              content: item.content,
              prefix: item.icon ? <Icon source={item.icon} /> : undefined,
              active,
              onAction: () => {
                if (active) {
                  return false
                }

                navigate(item.url)
              },
            }
          })}
        />
      </Card>
    </Box>
  )
}

export default NavigationSettings
