import { BlockStack, Button, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { InfoIcon, UploadIcon } from '@shopify/polaris-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import withMockup, { type WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import ImageSelector from '~/modules/modals/ImageSelector'
import { type IImageQuery } from '~/types/shopify-files'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { ImagePreview } from '../../shared/ImagePreview'

interface IBackgroundImageUploaderProps extends WithVariantsProps {
  viewId?: string
}

function BackgroundImageUploader(props: IBackgroundImageUploaderProps) {
  const { mockupId, variants, viewId } = props
  const { t } = useTranslation()
  const [imageModalActive, setImageModalActive] = useState(false)
  const backgroundImage = (variants[0].mockup.views || []).find((v: any) => v._id === viewId)?.backgroundImage

  const { trackEvent } = useEventsTracking()

  const openImageSelectorModal = () => {
    setImageModalActive(true)
  }

  const onSelectImage = (imagesSelected: IImageQuery[] | null) => {
    if (imagesSelected?.length) {
      const {
        alt: altText,
        image: { originalSrc, width, height },
      } = imagesSelected[0]

      const backgroundImage = {
        url: originalSrc,
        width,
        height,
        altText,
      }
      if (!viewId) return
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_ASSETS',
        payload: { mockupId, viewId, backgroundImage },
      })

      // Send event to MixPanel
      trackEvent(EVENTS_TRACKING.UPLOAD_BACKGROUND_IMAGE)
    } else {
      if (!viewId) return
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_ASSETS',
        payload: { mockupId, viewId, backgroundImage: null },
      })
    }
    onClose()
  }

  const onClose = () => {
    setImageModalActive(false)
  }

  const onClearImage = () => {
    if (!viewId) return
    IntegrationStore.dispatch({ type: 'UPDATE_VIEW_ASSETS', payload: { mockupId, viewId, backgroundImage: null } })
  }

  return (
    <BlockStack gap={'100'} id="integration-background-image">
      <InlineStack gap={'100'}>
        <Text as="h3" variant="bodyMd" fontWeight="medium">
          {t('background-image')}
        </Text>
        <Tooltip content={t('background-image-tooltip')}>
          <Button icon={InfoIcon} variant="plain" />
        </Tooltip>
      </InlineStack>
      <Button
        id="integration-background-image-btn"
        icon={UploadIcon}
        variant="secondary"
        fullWidth
        onClick={openImageSelectorModal}
      >
        {t('upload-image')}
      </Button>
      {/* <div id="integration-background-image-btn" onClick={openImageSelectorModal}>
        <TextField
          label={t('upload-image')}
          labelHidden
          autoComplete="off"
          placeholder={t('upload-image')}
          suffix={<Icon source={UploadIcon} />}
        />
      </div> */}
      {backgroundImage && (
        <ImagePreview imageUrl={backgroundImage.url} altText={backgroundImage.altText} onClear={onClearImage} />
      )}
      {imageModalActive && (
        <ImageSelector
          active={imageModalActive}
          baseImage={backgroundImage ? [backgroundImage] : []}
          onSelectImage={onSelectImage}
          onClose={onClose}
        />
      )}
    </BlockStack>
  )
}

export default withMockup(BackgroundImageUploader)
