import { InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

interface IPlanNameCardProps {
  planName?: string
}

function PlanNameCard(props: IPlanNameCardProps) {
  const { planName } = props

  const { t } = useTranslation()

  return (
    <InlineStack align="space-between">
      <Text as="h3" variant="headingSm">
        {t('your-plan')}
      </Text>
      <Text as="h3" variant="headingSm">
        {planName || t('free')}
      </Text>
    </InlineStack>
  )
}

export default PlanNameCard
