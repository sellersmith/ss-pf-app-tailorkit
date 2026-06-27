import { Modal, BlockStack, InlineStack, Text, Banner, Badge } from '@shopify/polaris'
import { format } from 'date-fns'
import type { TFunction } from 'i18next'
import type { BillingCycleDocument, UsageFeeRecord } from '~/models/BillingCycle'
import { getPlanBadgeColor } from '~/models/helpers/pricing-utils'

export interface CurrentPlanCharges {
  timeline: Date
  planName: string
  feePerOrder: number
  extraOrders: number
  subtotal: number
}

interface ExtraOrderFeeModalProps {
  active: boolean
  onClose: () => void
  billingCycles: BillingCycleDocument[]
  currentPlanCharges: CurrentPlanCharges
  t: TFunction
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'MMMM dd, yyyy')
}

export function ExtraOrderFeeModal({ active, onClose, billingCycles, currentPlanCharges, t }: ExtraOrderFeeModalProps) {
  // Flatten all usage fees from billing cycles into charge records format
  const recordsWithCharges = billingCycles.flatMap(cycle => {
    const planName = (cycle.planId as any)?.alias || (cycle.planId as any)?.name || 'Unknown Plan'
    return cycle.charges.usageFees.map((fee: UsageFeeRecord) => ({
      _id: `${cycle._id}-${fee.chargedAt}`,
      chargeDetails: {
        timeline: fee.chargedAt,
        planName,
        feePerOrder: cycle.planLimits.overageFeePerOrder,
        extraOrders: fee.extraOrders,
        subtotal: fee.amount,
      },
    }))
  })

  // Calculate total from historical records + current pending charges
  const historicalTotal = recordsWithCharges.reduce((sum, record) => sum + record.chargeDetails.subtotal, 0)
  const total = historicalTotal + currentPlanCharges.subtotal

  return (
    <Modal
      open={active}
      onClose={onClose}
      title={t('extra-order-fee')}
      primaryAction={{
        content: t('close'),
        onAction: onClose,
      }}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Info banner */}
          <Banner tone="info" onDismiss={undefined}>
            {t(
              'since-you-changed-plans-mid-billing-cycle-extra-order-fees-are-charged-based-on-the-plan-active-at-the-time-of-each-extra-order'
            )}
          </Banner>

          {/* Table */}
          <div
            style={{
              border: '1px solid var(--p-color-border)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {/* Table header */}
            <div
              style={{
                backgroundColor: 'var(--p-color-bg-surface-tertiary)',
                padding: '8px 12px',
                display: 'grid',
                gridTemplateColumns: '140px 1fr 140px 1fr 1fr',
                gap: '12px',
                borderBottom: '1px solid var(--p-color-border)',
              }}
            >
              <Text as="p" variant="bodyMd" fontWeight="medium" tone="subdued">
                {t('timeline')}
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="medium" tone="subdued">
                {t('plan')}
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="medium" tone="subdued" alignment="end">
                {t('fee-per-extra-order')}
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="medium" tone="subdued" alignment="end">
                {t('extra-order')}
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="medium" tone="subdued" alignment="end">
                {t('subtotal')}
              </Text>
            </div>

            {/* Historical records */}
            {recordsWithCharges.map((record, index) => (
              <div
                key={record._id.toString()}
                style={{
                  backgroundColor: index % 2 === 0 ? 'var(--p-color-bg-fill-active)' : 'var(--p-color-bg-fill)',
                  padding: '8px 12px',
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 140px 1fr 1fr',
                  gap: '12px',
                  borderBottom: '1px solid var(--p-color-border)',
                }}
              >
                <Text as="p" variant="bodyMd">
                  {formatDate(record.chargeDetails.timeline)}
                </Text>
                <div>
                  <Badge tone={getPlanBadgeColor(record.chargeDetails.planName) as any}>
                    {record.chargeDetails.planName}
                  </Badge>
                </div>
                <Text as="p" variant="bodyMd" alignment="end">
                  ${record.chargeDetails.feePerOrder.toFixed(2)}
                </Text>
                <Text as="p" variant="bodyMd" alignment="end">
                  {record.chargeDetails.extraOrders}
                </Text>
                <Text as="p" variant="bodyMd" alignment="end">
                  ${record.chargeDetails.subtotal.toFixed(2)}
                </Text>
              </div>
            ))}

            {/* Current plan charges row - only show if there are NEW pending charges */}
            {currentPlanCharges.subtotal > 0 && (
              <div
                style={{
                  backgroundColor:
                    recordsWithCharges.length % 2 === 0 ? 'var(--p-color-bg-fill-active)' : 'var(--p-color-bg-fill)',
                  padding: '8px 12px',
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 140px 1fr 1fr',
                  gap: '12px',
                  borderBottom: '1px solid var(--p-color-border)',
                }}
              >
                <Text as="p" variant="bodyMd">
                  {formatDate(currentPlanCharges.timeline)}
                </Text>
                <div>
                  <InlineStack gap="100" blockAlign="center">
                    <Badge tone={getPlanBadgeColor(currentPlanCharges.planName) as any}>
                      {currentPlanCharges.planName}
                    </Badge>
                  </InlineStack>
                </div>
                <Text as="p" variant="bodyMd" alignment="end">
                  ${currentPlanCharges.feePerOrder.toFixed(2)}
                </Text>
                <Text as="p" variant="bodyMd" alignment="end">
                  {currentPlanCharges.extraOrders}
                </Text>
                <Text as="p" variant="bodyMd" alignment="end">
                  ${currentPlanCharges.subtotal.toFixed(2)}
                </Text>
              </div>
            )}

            {/* Total row */}
            <div
              style={{
                backgroundColor: 'var(--p-color-bg-fill-active)',
                padding: '8px 12px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '12px',
                borderTop: '1px solid var(--p-color-border)',
              }}
            >
              <Text as="p" variant="headingMd">
                {t('total')}
              </Text>
              <Text as="p" variant="headingMd" alignment="end">
                ${total.toFixed(2)}
              </Text>
            </div>
          </div>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
