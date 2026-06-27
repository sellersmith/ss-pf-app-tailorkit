import { BlockStack, Box, Button, InlineStack, List, Popover, ProgressBar, Text, Tooltip } from '@shopify/polaris'
import { PersonSegmentIcon } from '@shopify/polaris-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { calculateAiCreditBalance } from '~/models/helpers/ai-credit-utils'
import { authenticatedFetch } from '~/shopify/fns.client'
import BlockLoading from '~/components/loading/BlockLoading'
import type { ShopDocument } from '~/models/Shop.d'
import { differenceInDays, addDays, addMonths } from 'date-fns'
import { CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX } from '../constants'
import { AI_CREDIT_PER_MONTH } from '~/constants/ai-assistant'

function UsageSegment() {
  const [active, setActive] = useState(false)
  const [shopData, setShopData] = useState<ShopDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  const handleToggle = () => {
    setActive(!active)
  }

  const activator = (
    <Tooltip content={t('usage-quota')} zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX}>
      <div style={{ display: 'flex' }}>
        <Box position="relative" paddingBlockStart="100">
          <Button
            icon={PersonSegmentIcon}
            variant="monochromePlain"
            onClick={handleToggle}
            accessibilityLabel={t('usage-quota')}
          />
        </Box>
      </div>
    </Tooltip>
  )

  useEffect(() => {
    if (!active) return

    setLoading(true)
    ;(async () => {
      const shop = await authenticatedFetch('/api/preferences')
      setShopData(shop as ShopDocument)
      setLoading(false)
    })()
  }, [active])

  // Calculate available credits
  const aiCreditUsage = shopData?.usages?.aiCredit
  const plan = (shopData?.subscription as any)?.plan
  const allocation = plan?.aiCreditsPerMonth || AI_CREDIT_PER_MONTH
  const creditBalance = calculateAiCreditBalance(aiCreditUsage, allocation)
  const total = creditBalance.monthlyAllocation + creditBalance.purchasedCredits
  const usage = creditBalance.monthlyUsage
  const startMonth = aiCreditUsage?.startMonth || new Date()

  return (
    <Popover
      active={active}
      activator={activator}
      zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX}
      preferredAlignment="left"
      onClose={handleToggle}
    >
      <Box padding={'200'} minWidth="250px">
        {loading ? (
          <BlockLoading paddingBlockEnd={0} paddingBlockStart={0} size="small" />
        ) : (
          <UsageSegmentSection usage={usage} total={total} startMonth={startMonth} />
        )}
      </Box>
    </Popover>
  )
}

export default UsageSegment

interface UsageSegmentSectionProps {
  usage: number
  total: number
  startMonth: Date
}

export const UsageSegmentSection = (props: UsageSegmentSectionProps) => {
  const { usage, total, startMonth } = props

  const { t } = useTranslation()

  const progress = total > 0 ? (usage / total) * 100 : 0

  // Reset date is plus 30 days and not larger than next month
  const resetDate = new Date(Math.max(addDays(startMonth, 30).getTime(), addMonths(new Date(), 1).getTime()))

  const dayLeft = differenceInDays(resetDate, new Date())

  return (
    <BlockStack gap="200">
      <BlockStack gap="100">
        <Text as="p" variant="headingMd" fontWeight="bold">
          {t('monthly-credit-quota')}
        </Text>
        <InlineStack gap={'200'} align="space-between">
          <Text as="p" variant="bodyMd">
            {t('usage')}
          </Text>
          <Text as="p" variant="bodyMd">
            {usage} / {total}
          </Text>
        </InlineStack>

        <ProgressBar progress={progress} tone="success" />
      </BlockStack>

      <BlockStack gap="100">
        <Text as="p" variant="bodyMd">
          {t('your-quota-will-be-reset-in-count-day', { count: dayLeft })}
        </Text>
        <Text as="p" variant="bodyMd">
          {t('response-cost')}:
        </Text>
        <List type="bullet">
          <List.Item>{t('response-cost-text')}</List.Item>
          <List.Item>{t('response-cost-image')}</List.Item>
        </List>
      </BlockStack>
    </BlockStack>
  )
}
