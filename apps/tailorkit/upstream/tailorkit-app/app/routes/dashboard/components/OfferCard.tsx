import { Card, Text, InlineStack, BlockStack } from '@shopify/polaris'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ILLUSTRATORS } from '~/constants/assets-url'

// Time to show the offer card
const DATE_TO_END = '2025-06-30'

export default function OfferCard() {
  const { t } = useTranslation()

  const isOfferActive = useMemo(() => {
    const today = new Date()
    const endDate = new Date(DATE_TO_END)

    // Set the time to the end of the day
    endDate.setHours(23, 59, 59, 999)
    return today <= endDate
  }, [])

  return (
    isOfferActive && (
      <Card>
        <InlineStack gap="300" wrap={false}>
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">
              {t('limited-time-offer-50-off-your-first-billing-cycle-title')}
            </Text>
            <Text as="p" variant="bodyMd">
              {t('limited-time-offer-50-off-your-first-billing-cycle-description')}
            </Text>
          </BlockStack>
          <img width={282} height={100} src={ILLUSTRATORS.COUPON_OFFER_50_PERCENT} alt="Offer 50% off" />
        </InlineStack>
      </Card>
    )
  )
}
