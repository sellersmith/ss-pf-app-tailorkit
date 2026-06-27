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
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { ImagePreview } from '../../shared/ImagePreview'

interface IBaseImageUploaderProps extends WithVariantsProps {
  viewId?: string
}

function BaseImageUploader(props: IBaseImageUploaderProps) {
  const { mockupId, variants, viewId } = props
  const firstVariant = variants[0]
  const { t } = useTranslation()
  const { tourId, active: tourActive } = useTourStatus()
  const isInTour = !!tourId && tourActive

  const [imageModalActive, setImageModalActive] = useState(false)
  const baseImage = (firstVariant?.mockup?.views || []).find((v: any) => v._id === viewId)?.baseImage
  const featureImage = firstVariant?.product?.featuredImage?.url
  const shouldShowUploadBaseImageInTour = isInTour && !featureImage

  const { trackEvent } = useEventsTracking()

  const openImageSelectorModal = () => {
    setImageModalActive(true)
  }

  const onSelectImage = (imageSelected: IImageQuery[] | null) => {
    if (imageSelected?.length) {
      const {
        alt: altText,
        image: { originalSrc, width, height },
      } = imageSelected[0]

      const baseImage = {
        url: originalSrc,
        width,
        height,
        altText,
      }
      if (!viewId) return
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_ASSETS',
        payload: { mockupId, viewId, baseImage },
      })

      // Send event to MixPanel
      trackEvent(EVENTS_TRACKING.UPLOAD_BASE_IMAGE)
    } else {
      if (!viewId) return
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_ASSETS',
        payload: { mockupId, viewId, baseImage: null },
      })
    }
    onClose()
  }

  const onClose = () => {
    setImageModalActive(false)
  }

  const onIndicateClose = () => {
    if (isInTour) return
    onClose()
  }

  const onClearImage = () => {
    if (!viewId) return
    IntegrationStore.dispatch({ type: 'UPDATE_VIEW_ASSETS', payload: { mockupId, viewId, baseImage: null } })
  }

  return (
    <BlockStack
      gap={'100'}
      id="integration-upload-base-image"
      data-tour-skip={shouldShowUploadBaseImageInTour ? 'false' : 'true'}
    >
      <InlineStack gap={'100'}>
        <Text as="h3" variant="bodyMd" fontWeight="medium">
          {t('blank-product-base-image')}
        </Text>
        <Tooltip content={t('base-image-tooltip')}>
          <Button icon={InfoIcon} variant="plain" />
        </Tooltip>
      </InlineStack>
      <Button
        id="integration-upload-base-image-btn"
        icon={UploadIcon}
        fullWidth
        variant="secondary"
        onClick={openImageSelectorModal}
      >
        {t('upload-image')}
      </Button>
      {/* <div id={'integration-upload-base-image-btn'} onClick={openImageSelectorModal}>
        <TextField
          label={t('upload-image')}
          labelHidden
          autoComplete="off"
          placeholder={t('upload-base-image')}
          suffix={<Icon source={UploadIcon} />}
        />
      </div> */}
      {baseImage && <ImagePreview imageUrl={baseImage.url} altText={baseImage.altText} onClear={onClearImage} />}
      {imageModalActive && (
        <ImageSelector
          active={imageModalActive}
          baseImage={baseImage ? [baseImage] : []}
          onSelectImage={onSelectImage}
          onClose={onClose}
          onIndicateClose={onIndicateClose}
        />
      )}
    </BlockStack>
  )
}

export default withMockup(BaseImageUploader)
