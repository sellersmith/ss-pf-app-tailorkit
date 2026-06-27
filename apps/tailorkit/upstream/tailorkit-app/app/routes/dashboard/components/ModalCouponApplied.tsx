import { BlockStack, Box, Image, List, Modal, Text } from '@shopify/polaris'
import type { Dispatch, ReactNode } from 'react'
import { useCallback, useMemo, memo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ILLUSTRATORS } from '~/constants/assets-url'
import type { TFunction } from 'i18next'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

interface ModalCouponAppliedProps {
  title?: string
  active: boolean
  setActive: Dispatch<boolean>
  couponDiscount: number
  /** Whether to show the coupon code. Default is true. */
  shouldShowCouponCode?: boolean
  customMessage?: ReactNode
}

type CouponTranslationKey = 'issuance' | 'application-method' | 'usage-rules' | 'complaints'

const SECTIONS: Array<{ title: CouponTranslationKey; items: number }> = [
  { title: 'issuance', items: 2 },
  { title: 'application-method', items: 3 },
  { title: 'usage-rules', items: 4 },
  { title: 'complaints', items: 2 },
]

const CouponSection = memo(
  ({ index, title, items, t }: { index: number; title: CouponTranslationKey; items: number; t: TFunction }) => (
    <>
      <Text as="h4" fontWeight="bold">
        {index + 1}. {t(title)}
      </Text>
      <List type="bullet">
        {[...Array(items)].map((_, i) => {
          const key = `${title}-description-${i + 1}` as const
          return (
            <List.Item key={key}>
              {title === 'application-method' && i < 2 ? (
                <Trans t={t} components={{ b: <strong /> }}>
                  {t(key)}
                </Trans>
              ) : (
                t(key)
              )}
            </List.Item>
          )
        })}
      </List>
    </>
  )
)
CouponSection.displayName = 'CouponSection'

export const ModalCouponApplied = (props: ModalCouponAppliedProps) => {
  const { active, setActive, couponDiscount, shouldShowCouponCode = true, title, customMessage } = props
  const { t } = useTranslation()

  const handleChange = useCallback(() => setActive(!active), [active, setActive])

  // Prevent page scroll when modal is open
  usePreventPageScroll(active)

  const primaryAction = useMemo(
    () => ({
      content: t('close'),
      onAction: handleChange,
    }),
    [handleChange, t]
  )

  return (
    <Modal open={active} onClose={handleChange} title={title || t('coupon-applied')} primaryAction={primaryAction}>
      <Modal.Section>
        <BlockStack gap={'200'}>
          {shouldShowCouponCode && (
            <Image
              source={couponDiscount === 5 ? ILLUSTRATORS.COUPON_5_PERCENT_LARGE : ILLUSTRATORS.COUPON_20_PERCENT_LARGE}
              style={{ width: '100%' }}
              alt={t('coupon-applied')}
            />
          )}
          {customMessage || (
            <Box>
              {SECTIONS.map((section, index) => (
                <CouponSection key={section.title} index={index} title={section.title} items={section.items} t={t} />
              ))}
            </Box>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
