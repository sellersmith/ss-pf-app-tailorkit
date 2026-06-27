import { BlockStack, Button, InlineGrid, InlineStack, Text } from '@shopify/polaris'
import { ChevronLeftIcon, ChevronRightIcon, UploadIcon, WandIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { TemplateEditorStore } from '~/stores/modules/template'
import withMockup, { type WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import ImageSelector from '~/modules/modals/ImageSelector'
import { type IImageQuery } from '~/types/shopify-files'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { MediaItem } from '~/modules/modals/ImageSelector/components/MediaItem'
import { ImagePreview } from '../../shared/ImagePreview'
import { useStore } from '~/libs/external-store'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import MockupWizard from '~/modules/MockupWizard'

interface IBackgroundImageUploaderProps extends WithVariantsProps {
  viewId: string
}

const premadeOverlaysPerPage = 4 // 2 rows × 2 items per row

function MaskLayerUploader(props: IBackgroundImageUploaderProps) {
  const { mockupId, variants, viewId } = props
  const { t } = useTranslation()
  const [imageModalActive, setImageModalActive] = useState(false)

  const { trackEvent } = useEventsTracking()

  const firstVariant = useMemo(() => variants[0], [variants])

  const mockup = firstVariant.mockup
  const layers = mockup.layers as TLayerIntegrationStore[]

  // Resolve layers strictly from current view when viewId is provided
  const viewLayerIdsRaw = viewId ? (mockup.views || []).find((v: any) => v._id === viewId)?.layers || [] : undefined
  const viewLayerIds = Array.isArray(viewLayerIdsRaw)
    ? viewLayerIdsRaw.map((it: any) => (typeof it === 'string' ? it : it?._id)).filter(Boolean)
    : undefined
  const resolvedLayers: TLayerIntegrationStore[] = useMemo(() => {
    return viewId
      ? (viewLayerIds || [])
          .map(id => (layers || []).find((ls: any) => ls.getState()._id === id))
          .filter((ls): ls is TLayerIntegrationStore => Boolean(ls))
      : layers || []
  }, [layers, viewId, viewLayerIds])

  const layerImageStores = (resolvedLayers || []).filter(l => l.getState().type === 'image')
  const layerTemplateStores = (resolvedLayers || []).filter(l => l.getState().type === 'template')

  const maskGeometryLayer = useMemo(
    () => (resolvedLayers || []).find((l: any) => l.getState().type === 'mask') || null,
    [resolvedLayers]
  )
  const layerImages = layerImageStores.map(ls => {
    const { data, width = 0, height = 0 } = ls.getState()
    const { src = '', alt = '' } = data || {}

    return { url: src, width, height, altText: alt }
  })
  const templateImages = layerTemplateStores
    .map(ls => {
      const { data } = ls.getState()
      // Template image URL can be in multiple locations
      // @ts-ignore
      const templateSrc = data?.src || data?.template?.previewUrl || data?.templateId?.previewUrl || ''
      return templateSrc
    })
    .filter(Boolean) // Filter out empty strings
  const maskLayerImage = viewId ? (mockup.views || []).find((v: any) => v._id === viewId)?.maskImage || null : null
  const maskLayerStore = layerImageStores[0]

  const clickedLayerStore = useStore(LayerIntegrationStoreSelection, state => state.clickedLayerStore)

  const selecting = clickedLayerStore?.getState()?._id === maskLayerStore?.getState()?._id

  // Compute mask dimensions fitted to the current product/base image bounds
  const fitMaskToBaseImage = useCallback(
    (input: { width: number; height: number }) => {
      let { width, height } = input

      const productFeaturedImage = firstVariant.product?.featuredImage
      const mockupProductVariantImage = variants.find(v => !!v.image)
      const mockupBaseImage = variants.find(v => !!v.mockup.baseImage?.url)

      const productBaseImage = mockupBaseImage ? mockupBaseImage?.mockup?.baseImage : mockupProductVariantImage?.image

      const { width: baseImageWidth = 0, height: baseImageHeight = 0 } = productBaseImage || productFeaturedImage || {}

      if (baseImageWidth > 0 && baseImageHeight > 0 && (width > baseImageWidth || height > baseImageHeight)) {
        const maskRatio = width / height
        const baseRatio = baseImageWidth / baseImageHeight

        if (maskRatio < baseRatio) {
          height = baseImageHeight
          width = height * maskRatio
        } else {
          width = baseImageWidth
          height = width / maskRatio
        }
      }

      return { width, height }
    },
    [firstVariant.product?.featuredImage, variants]
  )

  const openImageSelectorModal = () => {
    setImageModalActive(true)
  }

  const onSelectImage = (imagesSelected: IImageQuery[] | null) => {
    if (imagesSelected) {
      const {
        alt: altText,
        image: { originalSrc, width, height },
      } = imagesSelected[0]

      // Fit mask to base image bounds (per view)
      const fitted = fitMaskToBaseImage({ width, height })

      // 1) Save mask asset on the view (per-view src)
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_ASSETS',
        payload: {
          mockupId,
          viewId,
          maskImage: { url: originalSrc, width: fitted.width, height: fitted.height, altText },
        },
      })

      // 2) Ensure a single global geometry layer for mask exists (type: 'mask')
      let resolvedLayerId = maskGeometryLayer?.getState()._id as string | undefined
      if (!resolvedLayerId) {
        IntegrationStore.dispatch({
          type: 'CREATE_MASK_LAYER',
          payload: {
            mockupId,
            layer: {
              type: 'mask',
              width: fitted.width,
              height: fitted.height,
              x: 0,
              y: 0,
              rotation: 0,
              name: '',
            } as any,
          },
        })
        const stateAfter = IntegrationStore.getState()
        const freshVariantAfter = stateAfter.variants.find(v => v.mockup._id === mockupId)
        const freshLayersAfter = freshVariantAfter?.mockup?.layers || []
        const maskLayer = freshLayersAfter.find((ls: any) => ls.getState().type === 'mask')
        resolvedLayerId = maskLayer?.getState()._id
      }

      if (resolvedLayerId) {
        IntegrationStore.dispatch({
          type: 'ADD_LAYER_TO_VIEW',
          payload: { mockupId, viewId, layerId: resolvedLayerId },
        })
      }

      // Send event to MixPanel
      trackEvent(EVENTS_TRACKING.UPLOAD_MASK_LAYERS, { [EVENTS_PARAMETERS_NAME.NUM_FILES]: 1 })
    }

    onClose()
  }

  const onClose = () => {
    setImageModalActive(false)
  }

  const onClearImage = useCallback(() => {
    // Clear selection if selecting
    if (selecting) {
      LayerIntegrationStoreSelection.dispatch({
        type: 'RESET_STATE',
      })
    }

    // Per-view clear: remove mask asset and detach layer from this view only
    if (viewId) {
      // 1) Clear the view mask asset
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_ASSETS',
        payload: { mockupId, viewId, maskImage: null },
      })

      // 2) Detach the mask geometry layer from this view (if present)
      const maskLayer = (resolvedLayers || []).find((ls: any) => ls.getState().type === 'mask')
      const maskLayerId = (maskLayer as TLayerIntegrationStore | undefined)?.getState()._id as string | undefined
      if (maskLayerId) {
        IntegrationStore.dispatch({
          type: 'REMOVE_LAYER_FROM_VIEW',
          payload: { mockupId, viewId, layerId: maskLayerId },
        })
      }
    }
  }, [mockupId, resolvedLayers, selecting, viewId])

  // Define some states for premade overlay lookup
  const [premadeOverlays, setPremadeOverlays] = useState<any[]>()
  const [premadeOverlayNotFound, setPremadeOverlayNotFound] = useState(false)

  // Check if the specified premade overlay is in use
  const isPremadeOverlayInUse = useCallback(
    (overlay: any) => {
      // Per-view selection state: considered in use if current view.maskImage matches this overlay
      if (!viewId) return false
      const v = (mockup.views || []).find((vw: any) => vw._id === viewId)
      return Boolean(v?.maskImage?.url === overlay.previewUrl)
    },
    [mockup.views, viewId]
  )

  const addMaskToView = useCallback(
    (mask: any) => {
      // Fit mask to base image bounds (per view)
      const fitted = fitMaskToBaseImage({ width: mask.width, height: mask.height })

      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_ASSETS',
        payload: {
          mockupId,
          viewId,
          maskImage: {
            url: mask.previewUrl,
            width: fitted.width,
            height: fitted.height,
            altText: mask.name,
          },
        },
      })

      // Ensure view references the mask geometry layer for geometry/order
      let maskLayer: any = maskGeometryLayer
      let resolvedLayerId = maskGeometryLayer?.getState()._id as string | undefined

      if (!resolvedLayerId) {
        IntegrationStore.dispatch({
          type: 'CREATE_MASK_LAYER',
          payload: {
            mockupId,
            layer: {
              type: 'mask',
              width: fitted.width,
              height: fitted.height,
              x: 0,
              y: 0,
              rotation: 0,
              name: mask.name,
            } as any,
          },
        })

        const stateAfter = IntegrationStore.getState()
        const freshVariantAfter = stateAfter.variants.find(v => v.mockup._id === mockupId)
        const freshLayersAfter = freshVariantAfter?.mockup?.layers || []

        maskLayer = freshLayersAfter.find((ls: any) => ls.getState().type === 'mask')
        resolvedLayerId = maskLayer?.getState()._id
      }

      if (resolvedLayerId) {
        IntegrationStore.dispatch({
          type: 'ADD_LAYER_TO_VIEW',
          payload: { mockupId, viewId, layerId: resolvedLayerId },
        })

        if (viewId) {
          IntegrationStore.dispatch({
            type: 'UPDATE_VIEW_OVERRIDES',
            payload: {
              mockupId,
              viewId,
              layerId: resolvedLayerId,
              patch: { width: fitted.width, height: fitted.height },
            },
          })
        } else {
          maskLayer.dispatch({
            type: 'UPDATE_DIMENSION',
            payload: { width: fitted.width, height: fitted.height },
          })
        }
      }
    },
    [fitMaskToBaseImage, maskGeometryLayer, mockupId, viewId]
  )

  // Apply the specified overlay to create a mockup
  const applyPremadeOverlay = useCallback(
    (selected: boolean, media: IImageQuery) => {
      const overlay = premadeOverlays?.find(o => o.previewUrl === media.image.originalSrc)

      if (!overlay) {
        return
      }

      if (selected) {
        addMaskToView(overlay)

        // Send event to MixPanel
        trackEvent(EVENTS_TRACKING.APPLY_PREMADE_MASK_LAYER, {
          [EVENTS_PARAMETERS_NAME.PREMADE_MASK_LAYER_ALIAS]: overlay.alias,
        })
      } else {
        // Check if the premade overlay is in use (per view)
        const inUse = isPremadeOverlayInUse(overlay)

        // Remove the applied mask (per view) and detach geometry layer
        if (inUse && viewId) {
          // 1) Clear the view mask asset
          IntegrationStore.dispatch({
            type: 'UPDATE_VIEW_ASSETS',
            payload: { mockupId, viewId, maskImage: null },
          })

          // 2) Detach the unnamed image layer from this view (geometry only)
          const resolvedLayerId = maskGeometryLayer?.getState()._id as string | undefined
          if (resolvedLayerId) {
            IntegrationStore.dispatch({
              type: 'REMOVE_LAYER_FROM_VIEW',
              payload: { mockupId, viewId, layerId: resolvedLayerId },
            })
          }

          // 3) Optionally remove template layers in this view that were mocked with this overlay (via UI button ids)
          ;(resolvedLayers || [])
            .filter(
              l => l.getState().type === 'template' && l.getState().data?.metadata?.mockedWith === overlay.previewUrl
            )
            .forEach(l => document.getElementById(`delete-layer-${l.getState()._id}`)?.click())

          // Send event to MixPanel
          trackEvent(EVENTS_TRACKING.REMOVE_PREMADE_MASK_LAYER, {
            [EVENTS_PARAMETERS_NAME.PREMADE_MASK_LAYER_ALIAS]: overlay.alias,
          })
        }
      }
    },
    [
      premadeOverlays,
      addMaskToView,
      trackEvent,
      isPremadeOverlayInUse,
      viewId,
      mockupId,
      maskGeometryLayer,
      resolvedLayers,
    ]
  )

  // Look up premade overlays
  const lookupPremadeOverlays = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        // eslint-disable-next-line max-len
        `/api/overlay-lookup?product_title=${encodeURIComponent(firstVariant.displayName || `${firstVariant.product?.title} | ${firstVariant.title}`)}`,
        { preferCache: true }
      )

      if (res?.success && res?.overlays?.length) {
        if (premadeOverlayNotFound) {
          setPremadeOverlayNotFound(false)
        }

        // Preload overlays
        await Promise.all(
          res.overlays.map(
            (overlay: any, idx: number) =>
              new Promise(resolve => {
                // Preload only overlays missing width and height
                if (res.overlays[idx].width && res.overlays[idx].height) {
                  return resolve(true)
                }

                // Load the image to get its width and height
                const img = document.createElement('img')
                img.src = overlay.previewUrl

                img.onload = () => {
                  res.overlays[idx].width = img.width
                  res.overlays[idx].height = img.height

                  resolve(true)
                }
              })
          )
        )

        setPremadeOverlays(res.overlays)
      } else {
        setPremadeOverlayNotFound(true)
      }
    } catch (e: any) {
      showGenericErrorToast()
      setPremadeOverlayNotFound(true)
    }
  }, [firstVariant.displayName, firstVariant.product?.title, firstVariant.title, premadeOverlayNotFound])

  // Automatically look up for premade overlays
  useEffect(() => {
    setPremadeOverlays([])

    const timer = setTimeout(lookupPremadeOverlays, 500)

    return () => timer && clearTimeout(timer)
  }, [lookupPremadeOverlays])

  // Create pagination support for premade overlays
  const [premadeOverlayPage, setPremadeOverlayPage] = useState(1)

  const hasPagination = useMemo(() => (premadeOverlays?.length || 0) > premadeOverlaysPerPage, [premadeOverlays])

  const maxPremadeOverlayPage = useMemo(
    () => Math.ceil(premadeOverlays?.length || 0) / premadeOverlaysPerPage,
    [premadeOverlays?.length]
  )

  const pagedPremadeOverlays = useMemo(() => {
    if (hasPagination) {
      return premadeOverlays?.slice(
        (premadeOverlayPage - 1) * premadeOverlaysPerPage,
        premadeOverlayPage * premadeOverlaysPerPage
      )
    }

    return premadeOverlays
  }, [hasPagination, premadeOverlayPage, premadeOverlays])

  const nextPremadeOverlayPage = useCallback(() => setPremadeOverlayPage(premadeOverlayPage + 1), [premadeOverlayPage])
  const prevPremadeOverlayPage = useCallback(() => setPremadeOverlayPage(premadeOverlayPage - 1), [premadeOverlayPage])

  // Implement mockup wizard
  const [showMockupWizard, setShowMockupWizard] = useState(false)
  const toggleMockupWizard = useCallback(() => setShowMockupWizard(!showMockupWizard), [showMockupWizard])

  const baseProductImage = useMemo(() => {
    // Get the current view's base image
    const currentView = (mockup.views || []).find((v: any) => v._id === viewId)
    const viewBaseImage = currentView?.baseImage

    // Get product featured image as fallback
    const productFeaturedImage = firstVariant.product?.featuredImage

    // Get variant image as another fallback
    const mockupProductVariantImage = variants.find(v => !!v.image)
    const variantImage = mockupProductVariantImage?.image

    // Return the first available image with the full fallback hierarchy
    return viewBaseImage || variantImage || productFeaturedImage
  }, [mockup.views, viewId, firstVariant.product?.featuredImage, variants])

  const onApplyGeneratedMockupMask = useCallback(
    (
      processedImageUrl: string,
      templatePositions?: { x: number; y: number; width: number; height: number; rotation?: number }[],
      processedDimensions?: { width: number; height: number }
    ) => {
      // The mask is always rendered at original image dimensions for proper compositing
      // Template positions need to be upscaled from processed space to original space
      const { width: baseWidth = 0, height: baseHeight = 0 } = baseProductImage || {}

      // Calculate upscale factor from processed to original dimensions
      const upscaleFactor
        = processedDimensions && processedDimensions.width > 0 ? baseWidth / processedDimensions.width : 1

      if (baseWidth > 0 && baseHeight > 0) {
        addMaskToView({
          width: baseWidth,
          height: baseHeight,
          name: t('generated-mask'),
          previewUrl: processedImageUrl,
        })

        // Update template layers with pre-calculated positioning data from MockupWizard
        // Positions are in processed space, so we need to upscale them to original dimensions
        if (templatePositions?.length && layerTemplateStores.length) {
          for (let index = 0; index < Math.min(templatePositions.length, layerTemplateStores.length); index++) {
            const position = templatePositions[index]
            const templateLayerStore = layerTemplateStores[index]

            if (position && templateLayerStore) {
              // Upscale position from processed space to original space
              // IMPORTANT: MockupWizard rotates templates around their CENTER point,
              // but Konva/TemplateEditor rotates around the TOP-LEFT corner (x, y).
              // We need to calculate the correct top-left position for Konva
              // such that the visual CENTER ends up at the same location.

              // 1. Calculate center point in processed space
              const centerX = position.x + position.width / 2
              const centerY = position.y + position.height / 2

              // 2. Upscale center point and dimensions
              const scaledCenterX = centerX * upscaleFactor
              const scaledCenterY = centerY * upscaleFactor
              const scaledWidth = position.width * upscaleFactor
              const scaledHeight = position.height * upscaleFactor

              // 3. Calculate top-left position for Konva's top-left rotation pivot
              // In Konva, when rotating around top-left (x, y), the center moves to:
              //   newCenterX = x + (w/2)*cos(θ) - (h/2)*sin(θ)
              //   newCenterY = y + (w/2)*sin(θ) + (h/2)*cos(θ)
              // We want the center to be at scaledCenter, so we solve for x, y:
              //   x = scaledCenterX - (w/2)*cos(θ) + (h/2)*sin(θ)
              //   y = scaledCenterY - (w/2)*sin(θ) - (h/2)*cos(θ)
              const rotation = position.rotation || 0
              const radians = (rotation * Math.PI) / 180
              const cos = Math.cos(radians)
              const sin = Math.sin(radians)
              const halfWidth = scaledWidth / 2
              const halfHeight = scaledHeight / 2

              const scaledX = scaledCenterX - halfWidth * cos + halfHeight * sin
              const scaledY = scaledCenterY - halfWidth * sin - halfHeight * cos

              if (viewId) {
                IntegrationStore.dispatch({
                  type: 'UPDATE_VIEW_OVERRIDES',
                  payload: {
                    mockupId,
                    viewId,
                    layerId: templateLayerStore.getState()._id,
                    patch: { rotation, y: scaledY, x: scaledX },
                  },
                })
              } else {
                templateLayerStore.dispatch({
                  type: 'UPDATE_TRANSFORMATION',
                  payload: {
                    rotation,
                    y: scaledY,
                    x: scaledX,
                  },
                })
              }

              // Resize the affected layer to cover the entire transparent area
              if (viewId) {
                IntegrationStore.dispatch({
                  type: 'UPDATE_VIEW_OVERRIDES',
                  payload: {
                    mockupId,
                    viewId,
                    layerId: templateLayerStore.getState()._id,
                    patch: { width: scaledWidth, height: scaledHeight },
                  },
                })
              } else {
                templateLayerStore.dispatch({
                  type: 'UPDATE_DIMENSION',
                  payload: { width: scaledWidth, height: scaledHeight },
                })
              }
            }
          }
        }

        if (templatePositions?.length && layerTemplateStores.length) {
          for (let i = 0; i < Math.min(templatePositions.length, layerTemplateStores.length); i++) {
            const tPos = templatePositions[i]
            const tStore = layerTemplateStores[i]
            const pAreaId = tStore?.getState()?.printAreaId
            const printArea = pAreaId ? firstVariant.printAreas?.find((pa: any) => pa._id === pAreaId) : null
            const preview = printArea?.previewProductImage ?? null

            if (!printArea || !pAreaId || !tPos || !baseProductImage?.url) continue
            if (preview && preview.src !== baseProductImage.url) continue
            if (preview) {
              const atDefaultPosition = preview.left === 0 && preview.top === 0
              const atDefaultRotation = preview.rotation === 0
              const atDefaultSize
                = preview.naturalWidth && preview.naturalHeight
                  ? preview.width === preview.naturalWidth && preview.height === preview.naturalHeight
                  : preview.width === baseWidth && preview.height === baseHeight
              if (!atDefaultPosition || !atDefaultRotation || !atDefaultSize) continue
            }

            const paWidth = printArea.width || 500
            const paHeight = printArea.height || 500
            const scaledW = tPos.width * upscaleFactor
            const scaledH = tPos.height * upscaleFactor
            if (scaledW === 0 || scaledH === 0) continue

            // Template center in product-image pixel space
            const scaledCx = (tPos.x + tPos.width / 2) * upscaleFactor
            const scaledCy = (tPos.y + tPos.height / 2) * upscaleFactor
            const sx = paWidth / scaledW
            const sy = paHeight / scaledH

            // Template center in print-area space
            const cxPa = scaledCx * sx
            const cyPa = scaledCy * sy

            // MockupWizard rotates the template around its center (cx, cy).
            // Konva rotates the image around its top-left (no offsetX/Y).
            // To place point (cxPa, cyPa) at print-area center (paWidth/2, paHeight/2)
            // after Konva applies rotation=-r around top-left:
            //   left = paWidth/2 - cxPa·cos(r) - cyPa·sin(r)
            //   top  = paHeight/2 + cxPa·sin(r) - cyPa·cos(r)
            const rotDeg = tPos.rotation || 0
            const rotRad = (rotDeg * Math.PI) / 180
            const cosR = Math.cos(rotRad)
            const sinR = Math.sin(rotRad)

            const payload = {
              src: baseProductImage.url,
              naturalWidth: baseWidth,
              naturalHeight: baseHeight,
              left: Math.round(paWidth / 2 - cxPa * cosR - cyPa * sinR),
              top: Math.round(paHeight / 2 + cxPa * sinR - cyPa * cosR),
              width: Math.round(baseWidth * sx),
              height: Math.round(baseHeight * sy),
              rotation: -rotDeg,
            }
            const mergedPreview = { ...(preview || {}), ...payload }
            IntegrationStore.dispatch({
              type: 'UPDATE_PRINT_AREA_PREVIEW_PRODUCT_IMAGE',
              payload: { mockupId, printAreaId: pAreaId, previewProductImage: mergedPreview },
            })
            // Also sync to TemplateEditorStore so the canvas reflects the new position immediately
            TemplateEditorStore.dispatch({
              type: 'SET_PREVIEW_PRODUCT_IMAGE',
              payload: { previewProductImage: mergedPreview, merge: false },
              skipTrace: true,
            })
          }
        }

        // Show success message
        showToast(t(TOAST.PRODUCT_EDITOR.MASK_LAYER_CREATED))
      } else {
        showGenericErrorToast()
      }

      // Close the modal after processing
      toggleMockupWizard()
    },
    [addMaskToView, baseProductImage, firstVariant, layerTemplateStores, mockupId, t, toggleMockupWizard, viewId]
  )

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodySm" tone="subdued">
        {t('mask-layer-description')}
      </Text>

      <InlineStack gap="200">
        <Button tone="success" icon={WandIcon} onClick={toggleMockupWizard} fullWidth>
          {t('mask-wizard')}
        </Button>
        <Button icon={UploadIcon} fullWidth onClick={openImageSelectorModal}>
          {t('upload-mask')}
        </Button>
      </InlineStack>

      {maskLayerImage && (
        <ImagePreview imageUrl={maskLayerImage.url} altText={maskLayerImage.altText} onClear={onClearImage} />
      )}

      {(premadeOverlays?.length || 0) > 0 && (
        <>
          <Text as="h3" variant="bodySm" fontWeight="medium">
            {t('pre-made-masks')}
          </Text>
          <InlineGrid gap="100" columns={2} alignItems="start">
            {pagedPremadeOverlays?.map((overlay: any) => {
              const selected = Boolean(isPremadeOverlayInUse(overlay))

              return (
                <MediaItem
                  key={overlay._id}
                  selected={selected}
                  style={{ padding: 0 }}
                  id={`overlay-${overlay._id}`}
                  showFilenameInTooltip={false}
                  setImageSelected={applyPremadeOverlay}
                  tooltip={
                    (selected
                      ? t('Remove the mockup for {{name}}', overlay)
                      : t('Create a mockup for {{name}}', overlay)) as string
                  }
                  media={{
                    id: overlay._id,
                    alt: overlay.name,
                    image: {
                      originalSrc: overlay.previewUrl,
                      width: overlay.width,
                      height: overlay.height,
                    },
                  }}
                  customImageWidth={197}
                />
              )
            })}
          </InlineGrid>
          {hasPagination && (
            <InlineStack gap="300" align="center">
              <Button icon={ChevronLeftIcon} onClick={prevPremadeOverlayPage} disabled={premadeOverlayPage <= 1} />
              <Button
                icon={ChevronRightIcon}
                onClick={nextPremadeOverlayPage}
                disabled={premadeOverlayPage >= maxPremadeOverlayPage}
              />
            </InlineStack>
          )}
        </>
      )}

      {imageModalActive && (
        <ImageSelector
          active={imageModalActive}
          baseImage={layerImages}
          onSelectImage={onSelectImage}
          allowMultiple={false}
          onClose={onClose}
        />
      )}

      {showMockupWizard && (
        <MockupWizard
          isModal={true}
          modalOpen={showMockupWizard}
          modalTitle={t('mockup-creator')}
          hideInstructions
          templateImages={templateImages}
          onModalClose={toggleMockupWizard}
          imageUrl={baseProductImage?.url || ''}
          canvasHeight="max(60vh, 400px)"
          originalImageDimensions={{
            width: baseProductImage?.width || 0,
            height: baseProductImage?.height || 0,
          }}
          onApply={onApplyGeneratedMockupMask}
          onError={error => {
            console.error('Mockup Wizard error:', error)
            showGenericErrorToast()
          }}
        />
      )}
    </BlockStack>
  )
}

export default withMockup(MaskLayerUploader)
