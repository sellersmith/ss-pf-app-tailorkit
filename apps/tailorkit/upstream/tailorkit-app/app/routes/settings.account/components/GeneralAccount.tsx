import { BlockStack, Card, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { ShopDocument } from '~/models/Shop'
import SettingLayout from '~/routes/settings/components/SettingLayout'

function GeneralAccount(props: { shop: ShopDocument }) {
  const { shop } = props

  const { shopConfig } = shop

  const { t } = useTranslation()

  return (
    <SettingLayout title={t('general')}>
      <Card>
        <BlockStack gap={'200'}>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('shop-owner')}
              </Text>
              <Text as="p" variant="bodyMd">
                {shopConfig.shop_owner}
              </Text>
            </InlineStack>
            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('email')}
              </Text>
              <Text as="p" variant="bodyMd">
                {shopConfig.email}
              </Text>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}

export default GeneralAccount
