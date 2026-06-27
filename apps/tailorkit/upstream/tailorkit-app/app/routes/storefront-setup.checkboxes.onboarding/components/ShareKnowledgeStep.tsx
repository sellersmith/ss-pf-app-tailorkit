import { BlockStack, Card, Image, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

// Image from OneTick CDN showing McDonald's fries example
const ONETICK_SNACK_IMAGE = 'https://cdn.shopify.com/s/files/1/0646/2953/8985/files/onetick-snack.png'

/**
 * ShareKnowledgeStep - Educational content about add-on products
 * Inspired by OneTick's onboarding with McDonald's fries example
 */
export default function ShareKnowledgeStep() {
  const { t } = useTranslation()

  return (
    <Card padding="600">
      <BlockStack gap="300">
        <Text as="p">
          {t('you-ve-probably-heard-mcdonald-s-famous-question')}:{' '}
          <b>
            <i>{t('do-you-want-fries-with-that')}</i>
          </b>{' '}
          – {t('a-classic-example-of-upselling-and-cross-selling')}
        </Text>

        <InlineStack align="center">
          <Image alt="About add-on products" source={ONETICK_SNACK_IMAGE} width="342px" height="140px" />
        </InlineStack>

        <Text as="p">
          {t('while-many-focus-on-best-practices-we-believe-the-key-is')} <b>{t('understanding-your-customers')}</b>
        </Text>

        <Text as="p">
          {t('to-increase-sales-you-need-to-understand-what-your-customers-truly-need')}.{' '}
          {t(
            'mcdonald-s-increases-revenue-by-15-40-with-this-because-they-know-fries-go-perfectly-with-a-big-mac-not-a-sports-drink'
          )}
        </Text>

        <Text as="p">
          {t('before-you-start-think-about-what-your-customers-want')}.{' '}
          {t('this-simple-principle-will-help-you-create-the-right-offers')}
        </Text>

        <Text as="p">{t('we-ll-share-more-tips-along-the-way-stay-tuned')}</Text>
      </BlockStack>
    </Card>
  )
}
