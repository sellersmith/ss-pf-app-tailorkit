import { BlockStack, Box, Button, Image, InlineStack, Text, useBreakpoints } from '@shopify/polaris'
import { useEffect, useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import ConfettiEffect from '~/components/confetti'
import Timeline from '~/components/TimeLine/Timeline'
import { TLKitTimelineDirection } from '~/components/TimeLine/types'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { saveUserJourneyProgress } from '~/modules/Onboarding/utilities/saveUserJourneyProgress'
import { USER_JOURNEY_STEPS, USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { ModalCouponApplied } from './ModalCouponApplied'
import { useUserMilestone } from '../hooks/useUserMilestone'
import { isInTrial } from '~/routes/api.pricing/utils/fns'
import { useRootLoaderData } from '~/root'

function UserMilestonesCard() {
  const { t } = useTranslation()
  const { shopData } = useRootLoaderData()
  const { achieveFirstSaleEvent } = useUserMilestone()

  const [modalCouponAppliedActive, setModalCouponAppliedActive] = useState(false)
  const data = achieveFirstSaleEvent?.data

  const isInTrialPeriod = useMemo(() => isInTrial(shopData.subscription), [shopData.subscription])
  const achieveFirstSaleStepData = useMemo(
    () =>
      data?.find(
        (item: any) => item.finished && item.step === USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_FIRST_SALE
      ),
    [data]
  )

  const isPublishOnOnlineStoreStepData = useMemo(
    () =>
      data?.find(
        (item: any) => item.finished && item.step === USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PUBLISH_ON_ONLINE_STORE
      ),
    [data]
  )

  const couponDiscount = useMemo(() => {
    if (!isInTrialPeriod) return -1
    if (achieveFirstSaleStepData) return 20
    if (isPublishOnOnlineStoreStepData) return 5

    return 0
  }, [achieveFirstSaleStepData, isInTrialPeriod, isPublishOnOnlineStoreStepData])

  const couponMessages = useMemo(() => {
    return {
      20: {
        title: t('congratulations-on-achieving-your-first-sale'),
        description: t('congratulations-on-achieving-your-first-sale-description'),
        illustrator: null,
      },
      5: {
        title: t('congratulations-on-publishing-for-your-first-product-title'),
        description: t('congratulations-on-publishing-for-your-first-product-description'),
        illustrator: {
          src: ILLUSTRATORS.COUPON_20_PERCENT,
          width: 369,
          height: 73,
        },
      },
      0: {
        title: t('get-ready-to-unlock-a-lifetime-coupon-for-up-to-20-off-title'),
        description: t('get-ready-to-unlock-a-lifetime-coupon-for-up-to-20-off-description'),
        illustrator: {
          src: ILLUSTRATORS.COUPON_5_PERCENT_FOR_PUBLISH_FIRST_PRODUCT,
          width: 206,
          height: 73,
        },
      },
      [-1]: {
        title: t('get-ready-to-design-the-best-product-for-your-store'),
        description: t('get-ready-to-design-the-best-product-for-your-store-description'),
        illustrator: null,
      },
    }
  }, [t])

  const { title, description, illustrator } = couponMessages[couponDiscount]
  const titleModalCouponApplied = title
  const titleMilestoneCard = title
  const descriptionMilestoneCard = description

  return {
    achieveFirstSaleEvent,
    title: (
      <InlineStack gap={'200'} blockAlign="center">
        {couponDiscount > 0 && (
          <Image
            source={achieveFirstSaleStepData ? ILLUSTRATORS.ACHIEVE_FIRST_SALE : ILLUSTRATORS.PUBLISH_FIRST_PRODUCT}
            alt="Achieve first sale"
            width={50}
            height={50}
          />
        )}

        <Text as="span" variant="bodyMd">
          {titleMilestoneCard}
        </Text>
      </InlineStack>
    ),
    description: (
      <BlockStack gap="600" align="start">
        <BlockStack gap="200">
          <Box position="relative">
            <InlineStack align="space-between" wrap={false}>
              <Box maxWidth="calc(100% - 300px)">
                <Text as="p" variant="bodyMd" tone="subdued">
                  <Trans t={t} components={{ b: <strong /> }}>
                    {descriptionMilestoneCard}
                  </Trans>
                </Text>
              </Box>
              {illustrator && (
                <Box>
                  <Image
                    style={{ position: 'relative', display: 'block', right: 0, top: 0, borderRadius: '4px' }}
                    source={illustrator.src}
                    alt="Coupon image"
                    width={illustrator.width}
                    height={illustrator.height}
                  />
                </Box>
              )}
            </InlineStack>
          </Box>
        </BlockStack>

        <BlockStack gap={'200'}>
          <UserMilestonesTimeline isInTrialPeriod={isInTrialPeriod} achieveFirstSaleEvent={achieveFirstSaleEvent} />
          {couponDiscount && isInTrialPeriod ? (
            <InlineStack align="space-between">
              <Text as="p" variant="bodySm">
                {t('don-t-forget-check-condition-for-your-coupon')}
              </Text>

              <Button onClick={() => setModalCouponAppliedActive(true)}>{t('check-coupon')}</Button>

              <ModalCouponApplied
                title={titleModalCouponApplied}
                active={modalCouponAppliedActive}
                setActive={setModalCouponAppliedActive}
                couponDiscount={couponDiscount}
              />
            </InlineStack>
          ) : null}
        </BlockStack>
      </BlockStack>
    ),
  }
}

export default UserMilestonesCard

export function UserMilestonesConfettiEffect() {
  const { mdUp } = useBreakpoints()
  const { achieveFirstSaleEvent } = useUserMilestone()
  const data = achieveFirstSaleEvent?.data

  const achieveFirstSaleStepData = useMemo(
    () => data && data.find((item: any) => item.step === USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_FIRST_SALE),
    [data]
  )

  const { confettiBlasted } = achieveFirstSaleStepData || {}

  const showAchieveFirstSaleConfetti = achieveFirstSaleStepData && !confettiBlasted

  useEffect(() => {
    if (!showAchieveFirstSaleConfetti) {
      return
    }

    // After showing first sale confetti, set confetti blasted to true
    ;(async () => {
      await saveUserJourneyProgress({
        type: USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE,
        currentStep: USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PUBLISH_ON_ONLINE_STORE,
        data: (data || []).map((item: any) =>
          item === achieveFirstSaleStepData ? { ...item, confettiBlasted: true } : item
        ),
      })
    })()
  }, [achieveFirstSaleStepData, data, showAchieveFirstSaleConfetti])

  if (!showAchieveFirstSaleConfetti) {
    return null
  }

  return <ConfettiEffect particleCount={300} duration={mdUp ? 4000 : 3000} spread={25} />
}
const TIMELINE_ORDER = {
  [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.CREATE_TEMPLATE]: 'create-templates',
  [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PREPARE_PRODUCTS]: 'prepare-products',
  [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.INTEGRATE_WITH_PRODUCTS]: 'integrate-with-products',
  [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PUBLISH_ON_ONLINE_STORE]: 'publish-on-store',
  [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_FIRST_SALE]: 'achieve-first-sale',
  // [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_200_DOLLAR]: 'achieve-200',
} as const

interface UserMilestonesTimelineProps {
  achieveFirstSaleEvent: {
    data?: Array<{
      step: string
      finished: boolean
    }>
  }
  isInTrialPeriod: boolean
}

function UserMilestonesTimeline({ isInTrialPeriod, achieveFirstSaleEvent }: UserMilestonesTimelineProps) {
  const { t } = useTranslation()
  const { data = [] } = achieveFirstSaleEvent || {}

  const milestones = useMemo(
    () =>
      Object.entries(TIMELINE_ORDER)
        .filter(([step]) =>
          !isInTrialPeriod ? step !== USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_FIRST_SALE : true
        )
        .map(([step, translationKey]) => ({
          key: step,
          label: t(translationKey),
          progress: data.find(d => d.step === step)?.finished ? 100 : 0,
        })),
    [data, isInTrialPeriod, t]
  )

  return <Timeline items={milestones} direction={TLKitTimelineDirection.horizontal} />
}
