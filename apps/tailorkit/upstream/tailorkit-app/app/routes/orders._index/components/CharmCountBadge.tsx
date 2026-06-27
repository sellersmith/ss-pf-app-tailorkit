import { Badge } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

interface CharmCountBadgeProps {
  count: number
}

/** Small badge showing charm count next to a parent product in order list popover */
export function CharmCountBadge({ count }: CharmCountBadgeProps) {
  const { t } = useTranslation()
  if (count <= 0) return null
  return <Badge tone="info">{t('count-charm', { count })}</Badge>
}
