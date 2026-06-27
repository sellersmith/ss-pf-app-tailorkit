/**
 * SelectPlanModal Component
 *
 * Modal for confirming plan selection with discount code validation
 * and price breakdown before proceeding to checkout.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Modal, BlockStack, InlineStack, Text, Divider, Badge, Banner, TextField, Button, Icon } from '@shopify/polaris'
import { CheckIcon } from '@shopify/polaris-icons'
import type { SelectPlanModalProps } from './types'
import { formatCurrency, getPlanDisplayName, calculatePlanPrice } from '../../utils/planRecommendation'
import { authenticatedFetch } from '~/shopify/fns.client'
import { PRICING_ACTION } from '~/routes/api.pricing/constants'
import type { CouponDocument } from '~/models/Coupon'
import type { CalculatedPrice, DiscountStatus } from '../../utils/planRecommendation'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'

function getCouponAppliedMessage(t: SelectPlanModalProps['t'], coupon: CouponDocument): string {
  const { type, amount } = coupon.discount
  const months = coupon.limit?.discountEndsAfter

  if (type === 'percent') {
    return months ? t('x-off-first-n-months-applied', { amount, months }) : t('x-off-applied', { amount })
  }

  if (type === 'fixed') {
    const formatted = formatCurrency(amount)
    return months
      ? t('x-amount-off-first-n-months-applied', { amount: formatted, months })
      : t('x-amount-off-applied', { amount: formatted })
  }

  return t('discount-code-applied-successfully')
}

export function SelectPlanModal({
  t,
  open,
  onClose,
  plan,
  calculatedPrice: initialCalculatedPrice,
  onConfirm,
  isLoading = false,
  isOldPricingMigration = false,
  // currentOrderUsage = 0,
  currentAiCreditUsage = 0,
  migrationCouponCode,
  remainingTrialDays,
  isDealActive,
  isDealEligible,
}: SelectPlanModalProps) {
  const { trackEvent } = useEventsTracking()

  // Discount code state
  const [discountCode, setDiscountCode] = useState<string>('')
  const [discountStatus, setDiscountStatus] = useState<DiscountStatus>('idle')
  const [validatedCoupon, setValidatedCoupon] = useState<CouponDocument | null>(null)
  const [discountError, setDiscountError] = useState<string>('')
  const [calculatedPrice, setCalculatedPrice] = useState<CalculatedPrice | null>(initialCalculatedPrice)
  const migrationCouponApplied = useRef(false)

  // Reset state when modal opens/closes or plan changes
  useEffect(() => {
    if (open) {
      setDiscountCode('')
      setDiscountStatus('idle')
      setValidatedCoupon(null)
      setDiscountError('')
      setCalculatedPrice(initialCalculatedPrice)
      migrationCouponApplied.current = false
    }
  }, [open, initialCalculatedPrice])

  // Handle discount code input change
  const handleDiscountCodeChange = useCallback(
    (value: string) => {
      setDiscountCode(value.toUpperCase())
      if (discountStatus !== 'idle') {
        setDiscountStatus('idle')
        setDiscountError('')
        setValidatedCoupon(null)
        // Reset to original price
        setCalculatedPrice(initialCalculatedPrice)
      }
    },
    [discountStatus, initialCalculatedPrice]
  )

  // Handle discount code validation
  const handleCheckDiscount = useCallback(
    async (codeOverride?: string) => {
      const code = codeOverride || discountCode
      if (!code.trim() || !plan || !initialCalculatedPrice) return

      setDiscountStatus('checking')
      setDiscountError('')

      try {
        const result = await authenticatedFetch('/api/pricing', {
          method: 'POST',
          body: JSON.stringify({
            action: PRICING_ACTION.VALIDATE_COUPON,
            coupon: code.trim(),
          }),
        })

        if (result.success && result.validatedCoupon) {
          setValidatedCoupon(result.validatedCoupon)
          setDiscountStatus('valid')

          const { includedOrders, overageFeePerOrder, extraOrderFee } = initialCalculatedPrice
          // Calculate order count from initial price
          const orderCount = includedOrders + (overageFeePerOrder > 0 ? extraOrderFee / overageFeePerOrder : 0)

          // Recalculate price with discount
          const newCalculatedPrice = calculatePlanPrice(plan, orderCount, result.validatedCoupon)
          setCalculatedPrice(newCalculatedPrice)

          trackEvent(EVENTS_TRACKING.PRICING_DISCOUNT_CODE_APPLIED, {
            [EVENTS_PARAMETERS_NAME.DISCOUNT_CODE]: code,
            [EVENTS_PARAMETERS_NAME.DISCOUNT_STATUS]: 'valid',
            [EVENTS_PARAMETERS_NAME.DISCOUNT_AMOUNT]: newCalculatedPrice.discount,
            [EVENTS_PARAMETERS_NAME.PLAN_NAME]: plan.name || '',
            [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'modal',
          })
        } else {
          setDiscountStatus('invalid')
          setDiscountError(t('invalid-discount-code'))
          setValidatedCoupon(null)
          setCalculatedPrice(initialCalculatedPrice)

          trackEvent(EVENTS_TRACKING.PRICING_DISCOUNT_CODE_APPLIED, {
            [EVENTS_PARAMETERS_NAME.DISCOUNT_CODE]: code,
            [EVENTS_PARAMETERS_NAME.DISCOUNT_STATUS]: 'invalid',
            [EVENTS_PARAMETERS_NAME.PLAN_NAME]: plan.name || '',
            [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'modal',
          })
        }
      } catch {
        setDiscountStatus('invalid')
        setDiscountError(t('failed-to-validate-discount-code'))
        setValidatedCoupon(null)
        setCalculatedPrice(initialCalculatedPrice)
      }
    },
    [discountCode, plan, initialCalculatedPrice, t, trackEvent]
  )

  // Auto-apply migration coupon when modal opens for migration users
  useEffect(() => {
    const isMigrationCouponValid = migrationCouponCode && plan && initialCalculatedPrice
    if (open && isOldPricingMigration && isMigrationCouponValid && !migrationCouponApplied.current) {
      migrationCouponApplied.current = true
      setDiscountCode(migrationCouponCode)
      // Auto-validate after a short delay to let state settle
      setTimeout(() => {
        handleCheckDiscount(migrationCouponCode)
      }, 100)
    }
  }, [open, isOldPricingMigration, migrationCouponCode, plan, initialCalculatedPrice, handleCheckDiscount])

  // Handle confirm with discount code
  const handleConfirmWithDiscount = useCallback(() => {
    onConfirm(validatedCoupon?.code || discountCode)
  }, [onConfirm, validatedCoupon, discountCode])

  const { openChat } = useLiveChat()

  if (!plan || !calculatedPrice) {
    return null
  }

  const planName = getPlanDisplayName(plan)
  // const includedOrders = getFreeOrdersCount(plan)
  const planAiCredits = plan.aiCreditsPerMonth || 0
  // const overageFeePerOrder = getOverageFeePerOrder(plan)

  // Determine if we should show usage warning banners
  // const showOrderWarning = isOldPricingMigration && currentOrderUsage > includedOrders
  // const excessOrders = Math.max(0, currentOrderUsage - includedOrders)
  const showAiCreditWarning = isOldPricingMigration && planAiCredits > 0 && currentAiCreditUsage > planAiCredits

  // Show $1 deal banner when: deal is active, shop is eligible, plan is paid
  const showDealBanner = !!isDealActive && !!isDealEligible && (plan.price ?? 0) > 0

  // Handle contact us button
  const handleContactUs = () => {
    trackEvent(EVENTS_TRACKING.PRICING_CONTACT_SUPPORT, {
      [EVENTS_PARAMETERS_NAME.PLAN_NAME]: planName,
      [EVENTS_PARAMETERS_NAME.PLAN_ALIAS]: plan.alias || '',
      [EVENTS_PARAMETERS_NAME.PLAN_PRICE]: plan.price || 0,
    })

    // Close modal
    onClose()

    // Open Crisp chat or email support
    if (typeof window !== 'undefined' && (window as any).$crisp) {
      setTimeout(() => {
        // Open Crisp chat and pre-define a message for user to ask for help
        openChat(t('need-help-with-plan-name', { planName }))
      }, 100)
    } else {
      // Fallback to email
      window.location.href = 'mailto:support@ecomate.co'
    }
  }

  const isCouponChecked = discountStatus === 'valid' && validatedCoupon

  // Determine actual trial days to display
  const displayTrialDays = remainingTrialDays ?? plan.trialDays
  const showTrialBanner = !isOldPricingMigration && displayTrialDays > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('select-plan')}
      primaryAction={{
        content: t('continue'),
        onAction: handleConfirmWithDiscount,
        loading: isLoading,
      }}
      secondaryActions={[
        {
          content: t('contact-us'),
          onAction: handleContactUs,
          disabled: isLoading,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {/* Trial banner - only for non-migration users with remaining trial */}
          {showTrialBanner && (
            <Banner tone="info" onDismiss={() => {}}>
              <p>{t('charge-after-days-free-trial', { trialDaysFree: displayTrialDays })}</p>
            </Banner>
          )}

          {/* Order usage warning for migration users */}
          {/* {showOrderWarning && (
            <Banner tone="info">
              <p>
                {t('youve-processed-orders-this-billing-cycle', {
                  processedOrders: currentOrderUsage,
                  extraOrders: excessOrders,
                  price: formatCurrency(overageFeePerOrder),
                })}
              </p>
            </Banner>
          )} */}

          {/* AI credit usage warning for migration users */}
          {showAiCreditWarning && (
            <Banner tone="info">
              <p>
                {t('youve-used-ai-credits-this-billing-cycle', {
                  usedAIcredits: currentAiCreditUsage,
                  freeAIcredits: planAiCredits,
                })}
              </p>
            </Banner>
          )}

          {/* Instructional Text */}
          <Text as="p" variant="bodyMd">
            {t('review-your-plan-and-enter-a-discount-code-if-available-then-click')}{' '}
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {t('continue')}
            </Text>
            .
          </Text>

          {/* Plan Name */}
          <InlineStack gap="300" align="space-between" blockAlign="center">
            <Text as="span" variant="bodyMd">
              {t('plan')}:
            </Text>
            <Badge tone={planName.toLowerCase().includes('growth') ? 'attention' : 'success'}>{planName}</Badge>
          </InlineStack>

          {/* Free orders per month */}
          <InlineStack gap="300" align="space-between" blockAlign="center">
            <Text as="span" variant="bodyMd">
              {t('free-orders-per-month')}:
            </Text>
            <Text as="span" variant="bodyMd" alignment="end">
              {calculatedPrice.includedOrders}
            </Text>
          </InlineStack>

          {/* Free AI credits per month */}
          {planAiCredits > 0 && (
            <InlineStack gap="300" align="space-between" blockAlign="center">
              <Text as="span" variant="bodyMd">
                {t('free-ai-credits-per-month')}:
              </Text>
              <Text as="span" variant="bodyMd" alignment="end">
                {planAiCredits}
              </Text>
            </InlineStack>
          )}

          <Divider />

          {/* Discount Code Section */}
          <BlockStack gap="200">
            <InlineStack gap="200" blockAlign="center">
              <div style={{ flex: 1 }}>
                <TextField
                  label={t('discount-code')}
                  labelHidden
                  value={discountCode}
                  onChange={handleDiscountCodeChange}
                  placeholder={t('discount-code')}
                  autoComplete="off"
                  disabled={isLoading || showDealBanner || (isOldPricingMigration && !!isCouponChecked)}
                  error={discountStatus === 'invalid' ? discountError : undefined}
                />
              </div>
              {isCouponChecked ? (
                <Button disabled icon={<Icon source={CheckIcon} />}>
                  {t('checked')}
                </Button>
              ) : (
                <Button
                  onClick={() => handleCheckDiscount()}
                  disabled={!discountCode.trim() || discountStatus === 'checking' || isLoading || showDealBanner}
                  loading={discountStatus === 'checking'}
                >
                  {t('check')}
                </Button>
              )}
            </InlineStack>
            {isCouponChecked && validatedCoupon && (
              <Text as="p" variant="bodySm" tone="success">
                {getCouponAppliedMessage(t, validatedCoupon)}
              </Text>
            )}
          </BlockStack>

          <Divider />

          {/* Subscription Fee */}
          <InlineStack gap="300" align="space-between" blockAlign="center">
            <Text as="span" variant="bodyMd">
              {t('subscription-fee')}:
            </Text>
            {showDealBanner ? (
              // Deal: strikethrough original price + $1 first month
              <InlineStack gap="100" blockAlign="center">
                <Text as="span" variant="bodyMd" tone="subdued">
                  <s>{formatCurrency(calculatedPrice.subscriptionFee)}</s>
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold" alignment="end">
                  {formatCurrency(1)}
                </Text>
              </InlineStack>
            ) : (
              <Text as="span" variant="bodyMd" fontWeight="semibold" alignment="end">
                {formatCurrency(calculatedPrice.subscriptionFee)}
              </Text>
            )}
          </InlineStack>

          {/* Renewal note when deal active: clarify month-2 price */}
          {showDealBanner && (
            <Text as="p" variant="bodySm" tone="subdued" alignment="end">
              {t('then-amount-mo-from-month-2', { amount: plan.price?.toFixed(2) })}
            </Text>
          )}

          {/* Discount (hidden when deal active — deal is reflected in subscription fee above) */}
          {!showDealBanner && (
            <InlineStack gap="300" align="space-between" blockAlign="center">
              <Text as="span" variant="bodyMd">
                {t('discount')}:
              </Text>
              <Text as="span" variant="bodyMd" fontWeight="semibold" alignment="end">
                {calculatedPrice.discount > 0
                  ? `−${formatCurrency(calculatedPrice.discount)}`
                  : `— ${formatCurrency(0)}`}
              </Text>
            </InlineStack>
          )}

          {/* Total */}
          <InlineStack gap="300" align="space-between" blockAlign="center">
            <Text as="span" variant="headingLg" fontWeight="bold">
              {t('total')}:
            </Text>
            <Text as="span" variant="headingLg" fontWeight="bold" alignment="end">
              {showDealBanner
                ? formatCurrency(1)
                : formatCurrency(Math.max(0, calculatedPrice.subscriptionFee - calculatedPrice.discount))}
            </Text>
          </InlineStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
