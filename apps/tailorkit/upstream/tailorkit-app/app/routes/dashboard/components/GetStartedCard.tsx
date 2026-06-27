import type { ComplexAction } from '@shopify/polaris'
import { LogoYoutubeIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ELink } from '~/constants/enum'
import { openInNewTab } from '~/utils/openInNewTab'
import ModalVideoTutorial from './ModalVideoTutorial'

interface ModalVideoTutorialProps {
  open: boolean
  onClose: () => void
  primaryAction?: ComplexAction
  secondaryActions?: ComplexAction[]
}

export function ModalVideoTutorialComponent(props: ModalVideoTutorialProps) {
  const { open, onClose, primaryAction, secondaryActions } = props
  const { t } = useTranslation()

  const onOpenYoutube = useCallback(() => {
    openInNewTab(ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS_YOUTUBE)
  }, [])

  return (
    <ModalVideoTutorial
      size="large"
      videoUrl={ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS_VIDEO}
      radius={true}
      socialAction={{
        icon: LogoYoutubeIcon,
        label: t('youtube'),
        onClick: onOpenYoutube,
      }}
      autoPlay={true}
      videoLength={106}
      thumbnailUrl={ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS}
      open={open}
      title={t('start-creating-a-personalizable-product')}
      onClose={onClose}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    />
  )
}
