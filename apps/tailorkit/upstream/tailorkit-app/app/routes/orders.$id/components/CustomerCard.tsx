import { BlockStack, Card, Link, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

export const CustomerCard = (props: { customer: any; order: any; subdomain: string }) => {
  const { customer, order, subdomain } = props

  const { t } = useTranslation()
  const { id: cId, email, first_name, last_name, phone } = customer || {}

  const billing_address = (order.billing_address?.address1 ? order.billing_address : customer?.default_address) || {}
  const shipping_address = (order.shipping_address?.address1 ? order.shipping_address : billing_address) || {}

  return (
    <Card>
      <BlockStack gap={'600'}>
        <BlockStack gap={'100'}>
          <Text as="p" fontWeight="bold">
            {t('customer')}
          </Text>

          <Link target="_blank" url={`https://admin.shopify.com/store/${subdomain}/customers/${cId}`}>
            {`${first_name} ${last_name}`}
          </Link>

          <Text as="p">{email || t('no-email')}</Text>
          <Text as="p">{phone || t('no-phone-number')}</Text>
        </BlockStack>

        <BlockStack gap={'100'}>
          <Text as="p" fontWeight="bold">
            {t('billing-address')}
          </Text>

          <Text as="p">{`${billing_address.first_name} ${billing_address.last_name}`}</Text>
          <Text as="p">
            {`${billing_address.address1}${billing_address.address2 ? `, ${billing_address.address2}` : ''}`}
          </Text>
          <Text as="p">{`${billing_address.city}${billing_address.zip ? `, ${billing_address.zip}` : ''}`}</Text>
          <Text as="p">{billing_address.country}</Text>
        </BlockStack>

        <BlockStack gap={'100'}>
          <Text as="p" fontWeight="bold">
            {t('shipping-address')}
          </Text>

          <Text as="p">{`${shipping_address.first_name} ${shipping_address.last_name}`}</Text>
          <Text as="p">
            {`${shipping_address.address1}${shipping_address.address2 ? `, ${shipping_address.address2}` : ''}`}
          </Text>
          <Text as="p">{`${shipping_address.city}${shipping_address.zip ? `, ${shipping_address.zip}` : ''}`}</Text>
          <Text as="p">{shipping_address.country}</Text>
        </BlockStack>
      </BlockStack>
    </Card>
  )
}
