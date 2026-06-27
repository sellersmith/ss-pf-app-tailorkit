import { getDesignSnapshot } from '../elements/components/Text/preview-design-snapshot-registry'
import { useLocation, useSearchParams } from '@remix-run/react'
import isInteger from 'lodash/isInteger'
import { useCallback, useMemo, useState } from 'react'
import { CommonError, OptionSetErrors, TemplateErrors } from '~/constants/errors'
import type { LayerDocument } from '~/models/Layer.server'
import { TEMPLATE_ACTIONS } from '~/routes/api.templates.$id/constants'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { TemplatesService } from '~/api/services/templates'
import { getLayerStoreById } from '~/stores/modules/layer'
import { PSDsStore } from '~/stores/modules/psd'
import {
  getExtractedCompositeLayerStores,
  type TemplateEditor,
  TemplateEditorStore,
  TemplateEditorStoreActions,
} from '~/stores/modules/template'
import type { NodeImage, OptionSet } from '~/types/psd'
import { EOptionSet, optionSetDataKeys, optionSetDataKeyValidation, ELayerType } from '~/types/psd'
import type { TemplateDimension } from '~/types/template'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { closeTemplateEditorSaveBarAndUpdateSavedStep, getControllersOfLayer } from '../fns'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { EMPTY_ARRAY, ONE_MINUTE_IN_MILLISECONDS } from '~/constants'
import { compressData } from '~/utils/file-types/zip'
import { deleteFileFromIDB, openIDBDatabase } from '~/bootstrap/db/index-db'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import { uploadedPreviewStoreActions } from '../components/Preview/stores/uploadedPreviewStore'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { useShopDomain } from '~/utils/shopify/useShopParams'

const { setOptionSetLists, resetClipartUsages } = TemplateEditorStoreActions

export function useSaveTemplate() {
  const location = useLocation()

  const [searchParams] = useSearchParams()
  // Removed useUploadFiles import – preview image will be sent directly with the template in one request

  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  const shopDomain = useShopDomain()
  const templateId = useMemo(() => location.pathname.split('/').pop(), [location.pathname])

  const { trackEvent } = useEventsTracking()
  const { trackCompleted: trackCharmCompleted } = useFeatureTracking('charm_builder')
  const { trackCompleted: trackEditorCompleted } = useFeatureTracking('template_editor')

  const onSave = useCallback(
    async (
      layersState: LayerDocument[],
      templateEditor: TemplateEditor,
      _previewImage?: Blob,
      _thumbnailImage?: Blob
    ) => {
      try {
        // Overlay design-time snapshots for layers currently in preview mode.
        // Prevents preview-dragged positions from persisting to the database.
        const correctedLayersState = layersState.map(layer => {
          const snapshot = layer?._id ? getDesignSnapshot(String(layer._id)) : undefined
          return snapshot ? { ...layer, ...snapshot } : layer
        })

        /**
         * Prepare data before saving
         */
        const templateData = prepareDataBeforeSavingTemplate(correctedLayersState, templateEditor)

        /** Validate data before saving
         * It will throw Error if having invalid data
         */

        validateDataBeforeSaving(templateData)

        // We will no longer upload the preview image separately. It will be sent to the server in the same
        // request and the server will handle uploading to S3. Therefore we intentionally do NOT set previewUrl here.

        if (!templateEditor._id) {
          throw new Error(TemplateErrors.MISSING_TEMPLATE_ID)
        }

        if (!shopDomain) {
          throw new Error(TemplateErrors.MISSING_SHOP_DOMAIN)
        }

        const _templateData: any = {
          ...templateData,
          name: templateData.name.trim(),
          shopDomain,
        }

        // Send time users need to complete creating a template
        const startTime = localStorage.getItem('TLK_CREATING_TEMPLATE_START_AT')

        trackEvent(EVENTS_TRACKING.COMPLETE_CREATING_PRODUCT, {
          use_ai_feature: localStorage.getItem('TLK_USE_AI_FEATURE_AT') ? 1 : 0,
          ...(templateEditor?.metadata?.generatedByAIAssistantAt ? { ai_template_saved: true } : {}),
          ...(startTime
            ? {
                [EVENTS_PARAMETERS_NAME.CREATION_MINUTES]: (
                  (Date.now() - Number(startTime))
                  / ONE_MINUTE_IN_MILLISECONDS
                ).toFixed(2),
              }
            : {}),
        })

        localStorage.removeItem('TLK_CREATING_TEMPLATE_START_AT')

        const formData = new FormData()

        // Compress template data
        const compressedData = new Blob([compressData(_templateData)], { type: 'application/octet-stream' })

        formData.append('type', TEMPLATE_ACTIONS.SAVE_TEMPLATE)
        formData.append('templateData', compressedData)
        formData.append('use_ai_feature', `${localStorage.getItem('TLK_USE_AI_FEATURE_AT') ? 1 : 0}`)

        // Attach preview image (Blob) to the same FormData so that the server can upload it to S3.
        if (_previewImage) {
          // Give the file a deterministic name; the server will replace it with its own uuid.
          const extension = _previewImage.type.split('/')[1] || 'webp'
          formData.append('previewImage', _previewImage, `preview.${extension}`)
        }

        // Attach thumbnail image (Blob) to the same FormData if provided.
        if (_thumbnailImage) {
          // Give the file a deterministic name; the server will replace it with its own uuid.
          const extension = _thumbnailImage.type.split('/')[1] || 'webp'
          formData.append('thumbnailImage', _thumbnailImage, `thumbnail.${extension}`)
        }

        const res = await TemplatesService.create(templateEditor._id, formData)

        if (!res?.success) throw new Error((res as any)?.message || CommonError)

        if ((res as any)?.data?.previewUrl || (res as any)?.previewUrl) {
          _templateData.previewUrl = (res as any)?.data?.previewUrl || (res as any)?.previewUrl
        }

        if ((res as any)?.data?.thumbnailUrl || (res as any)?.thumbnailUrl) {
          _templateData.thumbnailUrl = (res as any)?.data?.thumbnailUrl || (res as any)?.thumbnailUrl
        }

        // Delete file in IndexedDB after processing successfully
        const contentStr = searchParams.get('content') || ''
        const decodedContent = decodeURIComponent(contentStr)
        const id = decodedContent
        const storeName = IDB_STORE_NAME.TEMPLATE_DIMENSION
        const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, storeName)

        await deleteFileFromIDB(db, storeName, id)

        return {
          saved: true,
          template: _templateData,
          showConfetti: (res as any)?.data?.showConfetti || (res as any)?.showConfetti,
        }
      } catch (e) {
        console.error('Fail to upload media', e)

        showGenericErrorToast()
        setLoading(false)

        return { saved: false, template: null, showConfetti: false }
      } finally {
        setLoading(false)
      }
    },
    [searchParams, shopDomain, trackEvent]
  )

  const onSaveTemplate = useCallback(
    async (_previewUrl?: string, _thumbnailUrl?: string) => {
      try {
        setLoading(true)

        /** Prepare data before saving template */
        const templateEditor = TemplateEditorStore.getState()

        const layerStores = getExtractedCompositeLayerStores()

        // Reset option set for layer
        layerStores?.forEach(layerStore => {
          const { _id } = layerStore.getState()
          uploadedPreviewStoreActions.resetOptionSetForLayer(_id)
        })

        const layersState = layerStores.map(layerStore => {
          layerStore?.dispatch({ type: 'RESET_OPTION_SET_EDITING_STATE', skipTrace: true })

          return layerStore?.getState()
        })

        let previewBlob: Blob | undefined

        if (_previewUrl) {
          try {
            previewBlob = await fetch(_previewUrl).then(res => res.blob())
          } catch {
            // Ignore conversion errors – server will simply skip preview upload
          }
        }

        let thumbnailBlob: Blob | undefined

        if (_thumbnailUrl) {
          try {
            thumbnailBlob = await fetch(_thumbnailUrl).then(res => res.blob())
          } catch {
            // Ignore conversion errors – server will simply skip thumbnail upload
          }
        }

        const { saved, template, showConfetti } = await onSave(
          layersState,
          { ...templateEditor, _id: templateEditor._id || templateId || '' },
          previewBlob,
          thumbnailBlob
        )

        setSaved(saved)
        if (saved) {
          // Track charm_builder completion when template with charm layers is saved
          const hasCharmLayers = layersState.some(l => l.type === ELayerType.CHARM_NODE)
          trackEditorCompleted('template_saved')
          if (hasCharmLayers) {
            trackCharmCompleted('template_saved')
          }

          // Re-fetch all the options sets list data
          await authenticatedFetch(`/api/option-sets`).then(data => {
            if (data) {
              const optionSetList = data.items || EMPTY_ARRAY
              setOptionSetLists(optionSetList, true)
            }
          })

          resetClipartUsages(EMPTY_ARRAY, true)
        }

        return { saved, template, showConfetti, previewUrl: _previewUrl }
      } catch (e) {
        console.error('Fail to upload media', e)

        showGenericErrorToast()

        return { saved: false, template: null, showConfetti: false, previewUrl: undefined }
      } finally {
        setLoading(false)
        // Close ui-save-bar and grant savedStep
        closeTemplateEditorSaveBarAndUpdateSavedStep()
      }
    },
    [onSave, templateId, trackEditorCompleted, trackCharmCompleted]
  )

  const onSaveClipart = useCallback(
    async (
      layersState: LayerDocument[],
      templateEditor: TemplateEditor,
      _previewUrl?: string,
      _thumbnailUrl?: string
    ) => {
      try {
        setLoading(true)
        let previewBlob: Blob | undefined

        if (_previewUrl) {
          try {
            previewBlob = await fetch(_previewUrl).then(res => res.blob())
          } catch {
            console.error('Fail to fetch preview blob', _previewUrl)
            previewBlob = undefined
          }
        }

        let thumbnailBlob: Blob | undefined

        if (_thumbnailUrl) {
          try {
            thumbnailBlob = await fetch(_thumbnailUrl).then(res => res.blob())
          } catch {
            console.error('Fail to fetch thumbnail blob', _thumbnailUrl)
            thumbnailBlob = undefined
          }
        }

        const { saved, template } = await onSave(layersState, templateEditor, previewBlob, thumbnailBlob)

        setSaved(saved)

        return { saved, template, previewUrl: _previewUrl || previewBlob }
      } catch (e) {
        console.error('Fail to upload media', e)

        showGenericErrorToast()

        return { saved: false, template: null, previewUrl: undefined }
      } finally {
        setLoading(false)
      }
    },
    [onSave]
  )

  return {
    saved,
    loading,
    onSaveTemplate,
    onSaveClipart,
    setSaved,
    setLoading,
  }
}

export function prepareDataBeforeSavingTemplate(layersState: LayerDocument[], templateEditor: TemplateEditor) {
  const { _id, name, dimension, type, clipartsAdded, category, metadata, wizardConfig } = templateEditor

  // Ensure layersState is always an array (handle undefined/null cases)
  const safeLayers = layersState || []
  const psds = preparePSDData(safeLayers)
  const layers = prepareLayerData(safeLayers)
  const images = prepareImages(safeLayers)
  const optionSets = prepareOptionSets(safeLayers)
  // const masks = prepareMasks(compositeLayers)

  return {
    _id,
    psds,
    images,
    optionSets,
    name,
    dimension,
    layers,
    type: type || TEMPLATE_TYPE.TEMPLATE,
    category,
    metadata,
    wizardConfig,
    // NOTE: previewProductImage is NOT included - it's stored per print area, not in template
    ...(type === TEMPLATE_TYPE.TEMPLATE ? { clipartsAdded } : {}),
    // masks,
  }
}

function preparePSDData(layersState: LayerDocument[]) {
  const PSDs = PSDsStore.getState()

  const results = Object.keys(PSDs).map(psdId => {
    const psd = PSDs[psdId]

    if (!psd || typeof PSDs[psdId] !== 'object') return

    const { header, image, name } = psd

    const layers = layersState
      .filter(layer => layer.psdId === psdId)
      .map((layer: LayerDocument) => {
        // Only get essential field
        return layer._id
      })

    const { file, ..._header } = header || {}
    const { width, height } = image || {}

    return {
      header: _header,
      layers: layers,
      image: {
        width,
        height,
      },
      psdId,
      name,
    }
  })

  return results.filter(psd => !!psd)
}

function prepareLayerData(layers: LayerDocument[]) {
  return layers.map(layer => {
    const { _id, node, image, children, conditionalLogic, optionSet: allOptionSetListOfLayer = [], ...others } = layer

    let _children: string[] = []

    if (node) {
      _children = node._children.filter(child => child.node).map(child => child.node.layer._id)
    } else if (children && children.length > 0) {
      _children = children.map(child => {
        return typeof child === 'string' ? child : child.layer._id
      })
    }

    // Do not save data source to server
    delete others.dataSrc

    return {
      ...others,
      _id,
      image: (image as NodeImage)?._id,
      children: _children,
      optionSet: allOptionSetListOfLayer
        .filter(optionSet => {
          if (optionSet.type === EOptionSet.IMAGE_OPTION && optionSet.labelOnStoreFront) {
            return true
          }

          return validateOptionSet(optionSet)
        })
        .map(optionSet => optionSet?._id),
      conditionalLogic: { ...conditionalLogic, isControlledBy: getControllersOfLayer(_id, layers) },
    }
  })
}

function prepareImages(layers: LayerDocument[]) {
  const images = []

  for (const layer of layers) {
    const { image } = layer

    if (image) {
      const {
        opacity,
        channelData,
        channelLength,
        channelsInfo,
        hasMask,
        _width: width,
        _height: height,
        src,
        clipGroup,
        _id,
        generativeOptions,
      } = image as NodeImage

      images.push({
        _id,
        opacity,
        channelData,
        channelLength,
        channelsInfo,
        hasMask,
        width,
        height,
        src,
        clipGroup,
        generativeOptions,
      })
    }
  }

  return images
}

function prepareOptionSets(layerStores: LayerDocument[]) {
  return layerStores
    .map(layer => {
      const { _id } = layer
      const layerState = getLayerStoreById(_id)
      const { optionSet: allOptionSetListOfLayer = [] } = layerState?.getState?.() || {
        optionSet: (layerState as unknown as LayerDocument)?.optionSet || [],
      }
      const validatedOptionSets = allOptionSetListOfLayer
        .map((optionSet: OptionSet) => {
          const type = optionSet.type
          const optType = optionSetDataKeys[type as keyof typeof optionSetDataKeys]
          const isImageOption = type === EOptionSet.IMAGE_OPTION
          const configOption = isImageOption ? { dataSrc: undefined } : {}

          if (optType === 'multi_layout' && optionSet.data) {
            return optionSet
          }

          const isValid = validateOptionSet(optionSet)

          if (isValid) {
            // @ts-ignore
            optionSet.data[optType] = (optionSet.data?.[optType] || [])
              .filter((d: any) => d.src || d.name)
              .filter((d: any) => !d.source) // Exclude preview uploads (source: 'upload' | 'ai')
              .map((item: any) => {
                return {
                  ...item,
                  labelOnStoreFront: item.labelOnStoreFront || layer.settings?.storefrontLabel,
                  selecting: false,
                  ...configOption,
                }
              })
            return optionSet
          }

          if (isImageOption && optionSet.labelOnStoreFront) {
            return optionSet
          }

          return null
        })
        .filter(o => !!o)

      return validatedOptionSets
    })
    .filter(o => !!o)
}

/* function prepareMasks(compositeLayers: Layer[]) {
  const masks = []

  for (const layer of compositeLayers) {
    const mask = {
      ...layer.mask,
      file: {
        ...layer.mask.file,
        data: unit8ArrayToBase64(layer.mask.file?.data),
      },
    }

    masks.push(mask)
  }

  return masks
} */

function validateDataBeforeSaving(templateData: any) {
  const { optionSets, dimension, type } = templateData

  if (type === TEMPLATE_TYPE.TEMPLATE) {
    /** Validate template dimension */
    validateDimension(dimension)
  }

  /** Validate template option set */

  validateOptionSets(optionSets)
}

function validateDimension(dimension: TemplateDimension) {
  const { width, height, resolution, measurementUnit } = dimension
  const isInvalidWidth = width <= 0 || (!isInteger(width) && measurementUnit === 'px')
  const isInvalidHeight = height <= 0 || (!isInteger(height) && measurementUnit === 'px')

  if (isInvalidWidth || isInvalidHeight || resolution < 0) {
    throw new Error(TemplateErrors.INVALID_DIMENSION)
  }
}

function validateOptionSets(optionSets: OptionSet[]) {
  optionSets.forEach((optionSet: OptionSet & { label?: string }) => {
    const { type, label } = optionSet || {}

    switch (type) {
      case EOptionSet.IMAGE_OPTION: {
        if (!label || !label?.trim()?.length) {
          throw new Error(`${OptionSetErrors.MISSING_OPTION_NAME} for image option set`)
        }

        break
      }
      case EOptionSet.MASK_OPTION: {
        if (!label || !label?.trim()?.length) {
          throw new Error(`${OptionSetErrors.MISSING_OPTION_NAME} for mask option set`)
        }

        break
      }
    }
  })
}

/**
 * Validate option set
 * @param optionSet
 * @returns
 */
export function validateOptionSet(optionSet: OptionSet) {
  const type = optionSet.type
  const optType = optionSetDataKeys[type as keyof typeof optionSetDataKeys]
  const optionSetDataValidation = optionSetDataKeyValidation[type as keyof typeof optionSetDataKeyValidation]

  const data: any = optionSet.data
  const dataKey = data?.[optType]

  const optionSetDataValidationKey = optionSetDataValidation?.[optType]
  const isRequired = optionSetDataValidationKey?.required

  let isValid = !!data
  const isArray = Array.isArray(dataKey)

  if (isArray && isRequired) {
    isValid = dataKey?.length > 0
  }

  return isValid
}
