import { Icon, InlineStack, Modal, Text, TextField } from '@shopify/polaris'
import { CheckIcon } from '@shopify/polaris-icons'
import isEmpty from 'lodash/isEmpty'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EModal } from '~/constants/enum'
import { PricingErrors } from '~/constants/errors'
import { APP_CHARGE_CURRENCY } from '~/constants/pricing'
import type { ICouponDiscount } from '~/models/Coupon'
import { PRICING_ACTION } from '~/routes/api.pricing/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { escapeRegExp } from '~/utils/escapeRegex'
import { useModal } from '~/utils/hooks/useModal'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

const MODAL_KEY = EModal.APPLY_COUPON

interface ICoupon {
  couponCode: string
  discount: ICouponDiscount | null
  error: string
}

interface IModalApplyCouponProps {
  // Loading state of calling callback apply coupon
  loading?: boolean
  // Callback after applying coupon
  callback: (couponCode: ICoupon['couponCode']) => any
}

export default function ModalApplyCoupon(props: IModalApplyCouponProps) {
  const { loading, callback } = props

  const { t } = useTranslation()

  const { state, closeModal } = useModal()
  const active = state[MODAL_KEY]?.active

  const [coupon, setCoupon] = useState<ICoupon>({ couponCode: '', discount: null, error: '' })

  const onClose = useCallback(() => {
    closeModal(MODAL_KEY)
  }, [closeModal])

  const onCouponCodeChange = useCallback((value: string) => {
    // Set coupon code with escaping regex
    setCoupon(pre => ({ ...pre, couponCode: escapeRegExp(value) }))
  }, [])

  const onCheckCouponCode = useCallback(async () => {
    try {
      if (!coupon) return

      const response = await authenticatedFetch('/api/pricing', {
        method: 'POST',
        body: JSON.stringify({
          action: PRICING_ACTION.VALIDATE_COUPON,
          coupon: coupon.couponCode,
        }),
      })

      if (!response.success) {
        throw new Error(response.message)
      }

      const { validatedCoupon } = response

      if (!validatedCoupon) {
        setCoupon(pre => ({ ...pre, error: PricingErrors.INVALID_COUPON }))

        return
      }

      // Set coupon code
      setCoupon({ couponCode: validatedCoupon.code, discount: validatedCoupon.discount, error: '' })
    } catch (e) {
      showGenericErrorToast()
    }
  }, [coupon])

  const isValidCoupon = coupon.couponCode && !coupon.error && !isEmpty(coupon.discount)

  // Prevent page scroll when modal is open
  usePreventPageScroll(!!active)

  // Render help text for text field
  const renderHelpText = () => {
    if (isValidCoupon && coupon.discount) {
      const { discount } = coupon
      const { amount, type } = discount

      return (
        <InlineStack gap={'100'}>
          <Text as="span" variant="bodyMd" tone="subdued">
            {t('discount')}:
          </Text>

          <Text as="span" variant="bodyMd" tone="subdued" fontWeight="bold">
            {amount}
            {type === 'percent' ? '%' : APP_CHARGE_CURRENCY}
          </Text>
        </InlineStack>
      )
    }

    return ''
  }

  return (
    <Modal
      open={active}
      onClose={onClose}
      title={t('coupon')}
      primaryAction={{
        content: t('get-plan'),
        loading,
        onAction: async () => {
          // Call the callback function
          await callback(coupon.couponCode)
        },
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <TextField
          autoComplete="off"
          label="Apply coupon"
          labelHidden
          placeholder={t('apply-coupon-code')}
          helpText={renderHelpText()}
          prefix={isValidCoupon && <Icon source={CheckIcon} />}
          value={coupon.couponCode}
          onChange={onCouponCodeChange}
          onBlur={onCheckCouponCode}
          error={coupon.error}
        />
      </Modal.Section>
    </Modal>
  )
}
