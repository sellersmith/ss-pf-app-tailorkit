import { BlockStack, Box, Card, Collapsible, Divider, Icon, InlineStack, Text } from '@shopify/polaris'
import { MinusIcon, PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import useDevices from '~/utils/hooks/useDevice'

interface FAQProps {
  openFaqs: {
    trial: boolean
    revenue: boolean
    plans: boolean
    upgrade: boolean
  }
  toggleFaq: (key: 'trial' | 'plans' | 'revenue' | 'upgrade') => void
}
export default function FAQ({ openFaqs, toggleFaq }: FAQProps) {
  const { t } = useTranslation()
  const { isSmallDesktopView } = useDevices()

  return (
    <Card>
      <BlockStack gap="600">
        <Text as="h2" variant="headingLg" alignment="center">
          {t('frequently-asked-questions')}
        </Text>

        <InlineStack align="center">
          <Box width={isSmallDesktopView ? '100%' : '66%'}>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <div style={{ cursor: 'pointer' }} onClick={() => toggleFaq('trial')}>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {t('is-there-a-free-trial-available')}
                    </Text>
                    <Text as="span" variant="bodyMd">
                      <Icon source={openFaqs.trial ? MinusIcon : PlusIcon} />
                    </Text>
                  </InlineStack>
                </div>
                <Divider />
                <Collapsible open={openFaqs.trial} id="trial-content">
                  <Box paddingBlock="050">
                    <Text as="span" variant="bodyMd">
                      {t(
                        // eslint-disable-next-line max-len
                        "Yes! Every month begins on our free plan until you earn $50 from products created with TailorKit. After that, we automatically move you into the paid tier that matches your TailorKit-generated revenue. You'll always retain full access to premium features with no time limit."
                      )}
                    </Text>
                  </Box>
                </Collapsible>
              </BlockStack>

              <BlockStack gap="200">
                <div style={{ cursor: 'pointer' }} onClick={() => toggleFaq('revenue')}>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {t('how-is-my-monthly-revenue-calculated')}
                    </Text>
                    <Text as="span" variant="bodyMd">
                      <Icon source={openFaqs.revenue ? MinusIcon : PlusIcon} />
                    </Text>
                  </InlineStack>
                </div>
                <Divider />
                <Collapsible open={openFaqs.revenue} id="revenue-content">
                  <Box paddingBlock="050">
                    <Text as="span" variant="bodyMd">
                      {t(
                        // eslint-disable-next-line max-len
                        'monthly-revenue-is-measured-as-the-total-sales-in-the-past-30-days-of-products-you-created-with-tailorkit-whether-orders-were-processed-by-tailorkit-or-fulfilled-manually-your-pricing-tier-is-then-automatically-updated-each-month-to-match-that-actual-tailorkit-generated-revenue'
                      )}
                    </Text>
                  </Box>
                </Collapsible>
              </BlockStack>

              <BlockStack gap="200">
                <div style={{ cursor: 'pointer' }} onClick={() => toggleFaq('plans')}>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {t('can-i-switch-between-plans')}
                    </Text>
                    <Text as="span" variant="bodyMd">
                      <Icon source={openFaqs.plans ? MinusIcon : PlusIcon} />
                    </Text>
                  </InlineStack>
                </div>
                <Divider />
                <Collapsible open={openFaqs.plans} id="plans-content">
                  <Box paddingBlock="050">
                    <Text as="span" variant="bodyMd">
                      {t(
                        'plans-automatically-adjust-based-on-your-monthly-revenue-you-ll-be-notified-before-any-changes-to-your-billing-occur'
                      )}
                    </Text>
                  </Box>
                </Collapsible>
              </BlockStack>

              <BlockStack gap="200">
                <div style={{ cursor: 'pointer' }} onClick={() => toggleFaq('upgrade')}>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {t('what-if-i-upgrade-mid-cycle')}
                    </Text>
                    <Text as="span" variant="bodyMd">
                      <Icon source={openFaqs.plans ? MinusIcon : PlusIcon} />
                    </Text>
                  </InlineStack>
                </div>
                <Divider />
                <Collapsible open={openFaqs.upgrade} id="plans-content">
                  <Box paddingBlock="050">
                    <Text as="span" variant="bodyMd">
                      {t(
                        // eslint-disable-next-line max-len
                        'we-only-bill-the-difference-so-you-ll-pay-exactly-the-full-amount-for-your-highest-tier-for-example-if-you-ve-paid-14-99-for-early-growth-and-then-hit-mid-tier-scaling-34-99-you-ll-be-charged-just-20-34-99-14-99-on-that-invoice'
                      )}
                    </Text>
                  </Box>
                </Collapsible>
              </BlockStack>
            </BlockStack>
          </Box>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}
