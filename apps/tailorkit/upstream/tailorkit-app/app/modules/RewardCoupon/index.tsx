import dateFormat from 'dateformat'
import useRewardCoupon from './useRewardCoupon'
import { useTranslation } from 'react-i18next'
import { BlockStack, Modal, Text } from '@shopify/polaris'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { useCallback } from 'react'
import { useRootLoaderData } from '~/root'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

export default function RewardCoupon() {
  const { t } = useTranslation()
  const { liveChatOpened } = useLiveChat()
  const { rewardedCoupon, setRewardedCoupon } = useRewardCoupon()

  const {
    shopData: { shopDomain },
    PUBLIC_ENV: { APP_HANDLE },
  } = useRootLoaderData()

  const seeDetails = useCallback(() => {
    if (rewardedCoupon?.code) {
      window.open(
        `https://${shopDomain}/admin/apps/${APP_HANDLE}/settings/billing?redeemCouponCode=${rewardedCoupon.code}`,
        '_blank'
      )
    }

    setRewardedCoupon(null)
  }, [APP_HANDLE, rewardedCoupon?.code, setRewardedCoupon, shopDomain])

  return (
    usePreventPageScroll(!!rewardedCoupon),
    rewardedCoupon && !liveChatOpened && (
      <Modal
        open={!!rewardedCoupon}
        title={t('couppn-applied')}
        onClose={() => setRewardedCoupon(null)}
        secondaryActions={[{ content: t('close'), onAction: () => setRewardedCoupon(null) }]}
        primaryAction={{
          content: t('see-details'),
          onAction: seeDetails,
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="headingXl" alignment="center">
              {rewardedCoupon.code}
            </Text>
            {rewardedCoupon.limit.expiresAt
              || (rewardedCoupon.limit.discountEndsAfter && (
                <Text as="p" variant="bodyLg" alignment="center">
                  {rewardedCoupon.limit.expiresAt
                    ? t('amount-off-until-date', {
                        date: dateFormat(rewardedCoupon.limit.expiresAt, 'mmm d, yyyy'),
                        amount:
                          rewardedCoupon.discount.type === 'percent'
                            ? `${rewardedCoupon.discount.amount}%`
                            : `$${rewardedCoupon.discount.amount}`,
                      })
                    : t('amount-off-after-num-billing-cycles', {
                        num: rewardedCoupon.limit.discountEndsAfter,
                        amount:
                          rewardedCoupon.discount.type === 'percent'
                            ? `${rewardedCoupon.discount.amount}%`
                            : `$${rewardedCoupon.discount.amount}`,
                      })}
                </Text>
              ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    )
  )
}
