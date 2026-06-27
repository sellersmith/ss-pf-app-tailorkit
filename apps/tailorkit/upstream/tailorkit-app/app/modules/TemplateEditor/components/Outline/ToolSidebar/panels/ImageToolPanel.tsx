import { BlockStack } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { IImageQuery } from '~/types/shopify-files'
import { useImageSelector } from '~/modules/modals/ImageSelector/hooks/useImageSelector'
import ImageSelectorSearch from '~/modules/modals/ImageSelector/components/ImageSelectorSearch'
import ImageSelectorUpload from '~/modules/modals/ImageSelector/components/ImageSelectorUpload'
import ImageSelectorErrors from '~/modules/modals/ImageSelector/components/ImageSelectorErrors'
import { ToolPanelWrapper } from '../components/ToolPanelWrapper'
import { useElementActions } from '../../../Editor/hooks/useElementActions'
import { ELayerType } from '~/types/psd'
import { ClipartGrid, type ClipartGridItem } from '~/routes/dashboard/components/ClipartShowcase'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { TemplateEditorStore } from '~/stores/modules/template'
import { consumePendingImagePostAddActions } from './stores/pending-image-actions-store'
import { applyImagePostAddActions } from './utils/apply-image-post-add-actions'

/**
 * Image tool panel used in the Template Editor sidebar.
 *
 * Provides search, upload and a 3-column grid with infinite scrolling.
 * Uses ClipartGrid for visual consistency with font combinations and AI images
 * (square tiles, gray background, 8px border-radius, label below).
 */
interface IImageToolPanelProps {
  onClose: () => void
}

export default function ImageToolPanel(props: IImageToolPanelProps) {
  const { onClose } = props
  const { t } = useTranslation()
  const { addElements } = useElementActions()

  const {
    textFieldValue,
    imagesProcessing,
    rejectedFiles,
    errorMessage,
    mediaList,
    isFetching,
    fetchNextPage,
    validMediaFiles,
    setTextFieldValue,
    onDropHandler,
    handleFetchMoreMedia,
  } = useImageSelector({
    baseImage: null,
    onSelectImage: () => {},
    onClose,
  })

  // Add image to canvas and apply any pending post-add actions from Elements panel presets.
  // Works for both existing images clicked from the grid and newly uploaded images.
  const addImageWithPendingActions = useCallback(
    (image: IImageQuery) => {
      addElements(ELayerType.IMAGE, [image])

      const pendingActions = consumePendingImagePostAddActions()
      if (!pendingActions) {
        return
      }

      // Get the newly created layer store directly — it's prepended at index 0
      // by addElements (synchronous). This avoids timing races with auto-select
      // (+100ms) by applying personalization data BEFORE the inspector mounts.
      const newLayerStore = TemplateEditorStore.getState().extractedLayerStores[0]
      // Pass image dimensions so mask ratio works on first add (before store is populated).
      applyImagePostAddActions(
        pendingActions,
        newLayerStore,
        image.image.width && image.image.height ? { width: image.image.width, height: image.image.height } : undefined
      )
    },
    [addElements]
  )

  // Convert IImageQuery[] to ClipartGridItem[] for ClipartGrid rendering.
  // Uploading items are shown (blob URL thumbnail is valid during upload)
  // but the click guard below prevents adding them to canvas.
  const clipartItems: ClipartGridItem[] = useMemo(
    () =>
      mediaList.map(image => ({
        _id: image.id,
        // Optimised thumbnail for 3-column layout (≈90px tile → 180px @2x)
        previewUrl: getShopifyThumbnail(image.image.originalSrc, 180),
        alt: image.alt || '',
      })),
    [mediaList]
  )

  // IntersectionObserver sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (entry.isIntersecting && !isFetching && !fetchNextPage) {
          handleFetchMoreMedia()
        }
      },
      { root: null, rootMargin: '300px 0px', threshold: 0.01 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleFetchMoreMedia, isFetching, fetchNextPage])

  return (
    <ToolPanelWrapper
      header={
        <BlockStack gap="300">
          <ImageSelectorSearch value={textFieldValue} onChange={setTextFieldValue} />
          <ImageSelectorUpload
            variant="button"
            accept={validMediaFiles}
            onDrop={onDropHandler}
            isProcessing={imagesProcessing}
          />
          <ImageSelectorErrors
            rejectedFiles={rejectedFiles}
            errorMessage={errorMessage}
            isProcessing={imagesProcessing}
          />
        </BlockStack>
      }
    >
      {/* 3-column ClipartGrid — same square-tile + label style as font combinations */}
      <div style={{ padding: '12px' }}>
        <ClipartGrid
          items={clipartItems}
          onClickItem={(_checked, item) => {
            const image = mediaList.find(img => img.id === item._id)
            if (!image) return
            // Safe to click uploading images — useImageSelector migrates blob→CDN URLs
            // in layer stores before revoking, preventing canvas remount issues.
            addImageWithPendingActions(image)
          }}
          isLoading={isFetching || Boolean(fetchNextPage)}
          columns={3}
          gapPx={8}
          showTitle={true}
          showTitleOnHover={true}
          tileTooltip={t('click-to-add')}
          lazy={true}
          sentinelRef={sentinelRef}
        />
      </div>
    </ToolPanelWrapper>
  )
}
