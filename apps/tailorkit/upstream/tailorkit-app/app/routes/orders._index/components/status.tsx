import { Badge, type BadgeProps } from '@shopify/polaris'
import { formatOrderStatus } from '../fns'
interface IBadgeStatusProps {
  tone: BadgeProps['tone'] | undefined
  progress: BadgeProps['progress'] | undefined
}

export const BADGE_STATUS: {
  [key: string]: IBadgeStatusProps
} = {
  SUCCESS: { tone: 'success', progress: 'complete' },
  INFO: { tone: 'info', progress: 'partiallyComplete' },
  ATTENTION: { tone: 'attention', progress: 'complete' },
  NONE: { tone: undefined, progress: undefined },
}

export function FinancialStatus({ financial_status }: any) {
  const props: IBadgeStatusProps = ['authorized', 'paid'].includes(financial_status)
    ? BADGE_STATUS.SUCCESS
    : ['partially_paid', 'partially_refunded'].includes(financial_status)
      ? BADGE_STATUS.INFO
      : ['refunded'].includes(financial_status)
        ? BADGE_STATUS.ATTENTION
        : BADGE_STATUS.NONE

  return (
    <Badge tone={props.tone} progress={props.progress}>
      {formatOrderStatus(financial_status)}
    </Badge>
  )
}
