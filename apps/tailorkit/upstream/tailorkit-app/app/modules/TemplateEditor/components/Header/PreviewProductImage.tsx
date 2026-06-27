import { BlockStack, Button, InlineStack, Popover, Text, Thumbnail, Tooltip } from '@shopify/polaris'
import { ReplaceIcon, UploadIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useStore } from '~/libs/external-store'
import ImageSelector from '~/modules/modals/ImageSelector'
import { TemplateEditorStore } from '~/stores/modules/template'
import type { IImageQuery } from '~/types/shopify-files'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { loadImage } from '~/utils/loadImage'
import { uuid } from '~/utils/uuid'
import Switch from '~/components/common/Switch'

export function PreviewProductImage() {
  const [activeModal, setActiveModal] = useState(false)
  const [activePopover, setActivePopover] = useState(false)
  const dimension = useStore(TemplateEditorStore, state => state.dimension)
  const previewProductImage = useStore(TemplateEditorStore, state => state.previewProductImage)
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()

  const canvasPixel = useMemo(() => {
    const width = lengthUnitToPixels(dimension.width, dimension.measurementUnit, dimension.resolution)
    const height = lengthUnitToPixels(dimension.height, dimension.measurementUnit, dimension.resolution)
    return { width, height }
  }, [dimension])

  const placeInitial = useCallback(
    (imgW: number, imgH: number) => {
      const { width: cw, height: ch } = canvasPixel
      // Scale to cover 100% of canvas (like CSS background-size: cover)
      const scale = Math.max((cw * 1) / imgW, (ch * 1) / imgH)
      const width = imgW * scale
      const height = imgH * scale
      const left = (cw - width) / 2
      const top = (ch - height) / 2
      return { left, top, width, height, rotation: 0 }
    },
    [canvasPixel]
  )

  const onSelectImage = useCallback(
    async (images: IImageQuery[] | null) => {
      try {
        const image = images?.[0]
        if (!image) return
        const src = image.image?.originalSrc || ''
        const altText = image.alt || ''

        const htmlImg = await loadImage(src)
        const natW = htmlImg.naturalWidth || htmlImg.width
        const natH = htmlImg.naturalHeight || htmlImg.height

        const placement = placeInitial(natW, natH)

        TemplateEditorStore.dispatch({
          type: 'SET_PREVIEW_PRODUCT_IMAGE',
          payload: {
            previewProductImage: {
              _id: uuid(),
              src,
              altText,
              naturalWidth: natW,
              naturalHeight: natH,
              ...placement,
              visible: true,
            },
          },
        })

        trackEvent(EVENTS_TRACKING.CLICK_PREVIEW_PRODUCT_IMAGE)
      } finally {
        setActiveModal(false)
      }
    },
    [placeInitial, trackEvent]
  )

  const isPreviewProductImageVisible = useMemo(() => {
    return !!(previewProductImage && previewProductImage.visible !== false)
  }, [previewProductImage])

  const activator = (
    <Tooltip content={t('upload-preview-product-image-content')}>
      <Button
        id="preview-product-image-btn"
        fullWidth
        icon={UploadIcon}
        variant="tertiary"
        onClick={() => {
          if (previewProductImage?.src) {
            setActivePopover(v => !v)
          } else {
            setActiveModal(true)
          }
        }}
        textAlign="start"
      >
        {t('add-preview-image')}
      </Button>
    </Tooltip>
  )

  return (
    <>
      {previewProductImage?.src && (
        <Popover active={activePopover} activator={activator} onClose={() => setActivePopover(false)}>
          <Popover.Pane height="auto" maxHeight="300px">
            <Popover.Section>
              <BlockStack gap="300">
                <Switch
                  label={t('display-preview-product-image')}
                  checked={isPreviewProductImageVisible}
                  onInput={() => {
                    if (isPreviewProductImageVisible) {
                      trackEvent(EVENTS_TRACKING.HIDE_PREVIEW_PRODUCT_IMAGE)
                    }

                    TemplateEditorStore.dispatch({
                      type: 'SET_PREVIEW_PRODUCT_IMAGE',
                      payload: {
                        previewProductImage: {
                          visible: !(previewProductImage && previewProductImage.visible !== false),
                        },
                        merge: true,
                      },
                    })
                  }}
                />

                <InlineStack gap="200" blockAlign="center">
                  <Thumbnail
                    source={previewProductImage.src}
                    alt={previewProductImage.altText || 'preview'}
                    size="large"
                  />
                  <div style={{ maxWidth: '65%' }}>
                    <Text as="span" truncate>
                      {previewProductImage.altText || 'Image'}
                    </Text>
                  </div>
                </InlineStack>

                <Button
                  icon={ReplaceIcon}
                  onClick={() => {
                    setActiveModal(true)
                    setActivePopover(false)
                  }}
                >
                  {t('replace-image')}
                </Button>

                <Button
                  variant="plain"
                  tone="critical"
                  onClick={() =>
                    TemplateEditorStore.dispatch({
                      type: 'SET_PREVIEW_PRODUCT_IMAGE',
                      payload: { previewProductImage: null },
                    })
                  }
                  accessibilityLabel={t('remove-image')}
                >
                  {t('remove-image')}
                </Button>
              </BlockStack>
            </Popover.Section>
          </Popover.Pane>
        </Popover>
      )}

      {!previewProductImage?.src && activator}

      <ImageSelector
        active={activeModal}
        onSelectImage={onSelectImage}
        onClose={() => setActiveModal(false)}
        allowMultiple={false}
      />
    </>
  )
}
