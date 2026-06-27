import { Badge, Button, Icon, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { ExitIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useLocation } from '@remix-run/react'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { EMPTY_OBJECT } from '~/constants'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { IntegrationStatus } from '~/types/integration'
import type { WithVariantsProps } from '../../withMockup'
import withMockup from '../../withMockup'
import { useMemo } from 'react'
import withTooltip from '~/bootstrap/hoc/withTooltip'
import { getSaveBarStatus, isOnboardingRoute } from '~/utils/shopify'
import { useSaveIntegration } from '../../hooks'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { UnpublishButton } from '../UnifiedHeader/ActionButtons'
import useDevices from '~/utils/hooks/useDevice'

interface IProductTitleProps extends WithVariantsProps {
  republishPending?: boolean
}

const ProductTitle = ({ variants, republishPending = false }: IProductTitleProps) => {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  const location = useLocation()
  const { isSmallDesktopView } = useDevices()
  const i = useSaveIntegration()
  const { unpublishing } = i
  const { openModal } = useModal()
  const isOnboarding = isOnboardingRoute(location.search)

  const product: any = variants[0].product || EMPTY_OBJECT
  const publishedAt = useStore(IntegrationStore, state => state.publishedAt)

  const status = republishPending && publishedAt
  const shouldShowUnpublish = Boolean(publishedAt) && !republishPending && !isSmallDesktopView

  // Determine status following Shopify badge guidelines: past tense, single word
  const productStatus = status
    ? IntegrationStatus.OUTDATED
    : publishedAt
      ? IntegrationStatus.PUBLISHED
      : IntegrationStatus.UNPUBLISHED

  const isOutdated = productStatus === IntegrationStatus.OUTDATED
  const isPublished = productStatus === IntegrationStatus.PUBLISHED
  // Badge tone mapping
  const badgeTone = isOutdated ? 'warning' : isPublished ? 'success' : undefined

  // Tooltip content for republish pending
  const badgeTooltip = republishPending ? t('template-updated-republish-to-show-on-storefront') : undefined
  const BadgeWithTooltip = useMemo(() => withTooltip(Badge), [])

  return (
    <InlineStack gap={'200'} blockAlign="center" wrap={false}>
      <Button
        icon={<Icon source={ExitIcon} tone="subdued" />}
        variant="monochromePlain"
        onClick={() => navigate(NavMenuItems.PERSONALIZED_PRODUCTS)}
        accessibilityLabel="Back"
        disabled={isOnboarding}
      />
      <Tooltip content={product?.title} activatorWrapper="span">
        <div style={{ maxWidth: '64px' }}>
          <Text as="h2" variant="bodyMd" fontWeight="medium" truncate>
            {product?.title}
          </Text>
        </div>
      </Tooltip>
      <BadgeWithTooltip
        tooltipContent={badgeTooltip}
        tooltipEnabled={!!badgeTooltip}
        tooltipProps={{ preferredPosition: 'above' }}
        progress={badgeTooltip ? 'partiallyComplete' : isPublished ? 'complete' : 'incomplete'}
        tone={badgeTone}
      >
        {t(productStatus)}
      </BadgeWithTooltip>

      {shouldShowUnpublish && (
        <Text as="span" variant="bodyMd" fontWeight="medium">
          -
        </Text>
      )}

      <UnpublishButton
        visible={shouldShowUnpublish}
        loading={Boolean(unpublishing)}
        onOpenConfirm={async () => {
          // Check if save bar is showing - if yes, trigger navigation to show native save bar animation
          if (getSaveBarStatus()) {
            await navigate('/')
            return
          }
          openModal(MODAL_ID.CONFIRM_UNPUBLISH_MODAL)
        }}
        t={t}
      />
    </InlineStack>
  )
}

export default withMockup(ProductTitle)
