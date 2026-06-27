import { useLocation, useNavigate, useSearchParams } from '@remix-run/react'
import { useCallback, useMemo } from 'react'
import { deleteFileFromIDB, getFileFromIDB, getJSONFromIDB, openIDBDatabase } from '~/bootstrap/db/index-db'
import { TEMPLATE_EDITOR_CANVAS_CONTAINER } from '~/constants/canvas'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import { MODAL_ID } from '~/constants/modal'
import type { LayerDocument } from '~/models/Layer.server'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore } from '~/stores/modules/layer'
import { PSDsStoreActions } from '~/stores/modules/psd'
import {
  DEFAULT_TEMPLATE_DIMENSION,
  DEFAULT_TEMPLATE_EDITOR_STORE,
  TemplateEditorStore,
  TemplateEditorStoreActions,
} from '~/stores/modules/template'
import { ELayerType, type Layer, type Template } from '~/types/psd'
import type { Dimension } from '~/types/template'
import { useExtractPSD } from '~/utils/extractPSD'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { checkLayerInsideMultiLayout } from '../elements/fns'
import { getClipartsDetails } from '../components/Inspector/Cliparts/fns'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { evaluateStageViewPort } from '~/utils/canvas/evaluateScale'
import { calculateEffectiveDimension } from '~/utils/canvas/calculateEffectiveDimension'
import { duplicateLayers } from '../fns'
import { notifyUndoRedoListeners } from '~/libs/steps.client'
import { uuid } from '~/utils/uuid'
// import { useTranslation } from 'react-i18next'
import isEmpty from 'lodash/isEmpty'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { useShopDomain } from '~/utils/shopify/useShopParams'
import { EMPTY_ARRAY } from '~/constants'

export interface ITemplate extends Template {
  isCreatingNew?: boolean
  autoOpenChatBot?: boolean
  currentConversationId?: string
  templateActionType?: 'SET_TEMPLATE_GENERATED_DATA'
  autoSelectFirstLayer?: boolean
  addAIImage?: boolean
}

const { setExtractedLayerStores, setOptionSetLists } = TemplateEditorStoreActions

export function useInitTemplate() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const templateId = useMemo(() => location.pathname.split('/').pop(), [location.pathname]) || uuid()
  const shopDomain = useShopDomain()
  // Note: we no longer auto-open or auto-create conversations here

  const navigate = useNavigate()
  const { processLayersForRenderingAfterUploadingPSDFile } = useExtractPSD()

  const sourceStr = searchParams.get('source')
  const contentStr = searchParams.get('content') || ''
  const premadeTemplateId = searchParams.get('premadeTemplateId')

  const evaluateTemplateViewPort = useCallback((dimension: Dimension, scaleUpStageViewPort: boolean = false) => {
    const preview = TemplateEditorStore.getState().previewProductImage
    const { effectiveDimension, contentOffset } = calculateEffectiveDimension(dimension, preview)

    return evaluateStageViewPort(
      TEMPLATE_EDITOR_CANVAS_CONTAINER,
      effectiveDimension,
      scaleUpStageViewPort,
      contentOffset
    )
  }, [])

  const initOptionSetLists = useCallback(async () => {
    const data = await authenticatedFetch(`/api/option-sets`)
    if (data) {
      const optionSetList = data.items || []
      setOptionSetLists(optionSetList, true)
    }
  }, [])

  const getLayerStores = useCallback(
    (args: {
      layers: LayerDocument[]
      shopDomain: string
      shouldDuplicate?: boolean
      shouldUploadImageToShopify?: boolean
    }) => {
      const { layers, shopDomain, shouldDuplicate, shouldUploadImageToShopify } = args
      let layerMapping: LayerDocument[] = layers

      if (shouldDuplicate) {
        layerMapping = duplicateLayers({
          layers,
          shopDomain,
          shouldUploadImageToShopify,
        })
      }

      return layerMapping.map(layer => createLayerStore(layer))
    },
    []
  )

  const initChatBotMessage = useCallback(
    (_args: { autoOpenChatBot: boolean | undefined; currentConversationId?: string }) => {
      // Auto-opening AI chat on template init is disabled
      // Preserve ability to prefill input if needed in the future without opening
      return
    },
    []
  )

  // const getLayerFromIDB = useCallback(async (templateId: string) => {
  //   console.log('🔥 getLayerFromIDB: ', templateId)
  //   const storeName = `${IDB_STORE_NAME.LAYER_SETTINGS}_${templateId}`
  //   const db = await openIDBDatabase(IDB_DATABASE_NAME.LAYER_SETTINGS, storeName)
  //   const jsonObject = (await getJSONFromIDB(db, storeName, templateId)) as LayerDocument[]
  //   return jsonObject
  // }, [])

  const shouldAutoSelectFirstLayer = useCallback((layers: TLayerStore[]) => {
    return layers.length > 0 && layers[0].getState().type !== ELayerType.GROUP
  }, [])

  const initTemplate = useCallback(
    (baseTemplate?: ITemplate) => {
      const { autoOpenChatBot, currentConversationId, autoSelectFirstLayer, addAIImage, metadata, ...template }
        = baseTemplate || ({} as ITemplate)
      if (isEmpty(template)) {
        ;(async () => {
          initChatBotMessage({ autoOpenChatBot, currentConversationId })
          // const layers = await getLayerFromIDB(templateId)
          // console.log('layers', layers)

          if (!sourceStr || !contentStr) {
            // Calculate the viewport of the template when opening the template
            const viewport = evaluateTemplateViewPort(DEFAULT_TEMPLATE_EDITOR_STORE.dimension)

            // Init template from default template
            TemplateEditorStore.dispatch({
              type: template?.templateActionType || 'INIT_DATA',
              payload: {
                state: {
                  ...DEFAULT_TEMPLATE_EDITOR_STORE,
                  viewport,
                  _id: templateId,
                  interactive: true,
                  shopDomain,
                  metadata,
                },
              },
              skipTrace: true,
            })

            // if (layers.length > 0) {
            //   TemplateEditorStore.dispatch({
            //     type: 'INIT_DATA',
            //     payload: {
            //       state: {
            //         ...DEFAULT_TEMPLATE_EDITOR_STORE,
            //         layers,
            //       },
            //     },
            //     skipTrace: true,
            //   })
            // }
            return
          }

          const decodedContent = decodeURIComponent(contentStr)
          switch (sourceStr) {
            case 'form': {
              const id = decodedContent

              const storeName = IDB_STORE_NAME.TEMPLATE_DIMENSION

              const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, storeName)

              const jsonObject = (await getJSONFromIDB(db, storeName, id)) as any

              const { title = 'Untitled', metadata, ...restData } = jsonObject || {}

              const dimension
                = (restData && {
                  width: restData.width,
                  height: restData.height,
                  resolution: restData.resolution,
                  measurementUnit: restData.measurementUnit,
                })
                || DEFAULT_TEMPLATE_DIMENSION
              const { height, width, resolution, measurementUnit } = dimension || DEFAULT_TEMPLATE_DIMENSION

              // Calculate the viewport of the template when opening the template
              const viewport = evaluateTemplateViewPort(dimension)

              TemplateEditorStore.dispatch({
                type: template?.templateActionType || 'INIT_DATA',
                payload: {
                  state: {
                    ...DEFAULT_TEMPLATE_EDITOR_STORE,
                    name: title,
                    _id: templateId,
                    dimension: {
                      width,
                      height,
                      measurementUnit,
                      resolution,
                    },
                    viewport,
                    interactive: true,
                    shopDomain,
                    metadata,
                    // NOTE: previewProductImage is NOT loaded from IDB - it will be resolved from PrintArea/product when template loads
                  },
                },
                skipTrace: true,
              })

              const layers = restData.layers || []
              const layerStores = getLayerStores({ layers, shopDomain })
              const layersState = layerStores.map(layerStore => layerStore.getState()) as Layer[]

              // Do not add layers are inside multi-layout to extracted layer stores
              const extractedLayerStores = layerStores.filter(layerStore => {
                const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(
                  layerStore.getState() as Layer,
                  layersState
                )

                return !isLayerInsideMultiLayout
              })

              // Record this change so the save/discard bar opens for newly created copies
              setExtractedLayerStores(extractedLayerStores, false)

              if (autoSelectFirstLayer && shouldAutoSelectFirstLayer(extractedLayerStores)) {
                LayerStoreSelection.dispatch({
                  type: 'SET_LAYER_STORE_SELECTION',
                  payload: { clickedLayerStore: extractedLayerStores[0] },
                })
              }
              break
            }

            case 'psd': {
              try {
                const fileId = decodeURIComponent(contentStr)

                async function retrieveFile(fileId: string): Promise<void> {
                  const storeName = IDB_STORE_NAME.PSD_FILE

                  try {
                    const db = await openIDBDatabase(IDB_DATABASE_NAME.PSD, storeName)
                    const fileRecord = await getFileFromIDB(db, storeName, fileId)
                    if (fileRecord) {
                      const fileData = fileRecord.data

                      if (!fileData) {
                        throw new Error()
                      }

                      const file = new File([fileData], fileRecord.name, { type: 'application/octet-stream' })

                      // Set the template id for TemplateEditorStore
                      TemplateEditorStore.dispatch({
                        type: template?.templateActionType || 'INIT_DATA',
                        payload: {
                          state: {
                            _id: templateId,
                            interactive: true,
                            shopDomain,
                            metadata,
                          },
                        },
                        skipTrace: true,
                      })

                      // Extract data from PSD file
                      await processLayersForRenderingAfterUploadingPSDFile([file], [file], [], true)

                      // Delete file after processing successfully
                      await deleteFileFromIDB(db, storeName, fileId)

                      return
                    }
                  } catch (error) {
                    showGenericErrorToast()
                    console.error('Error retrieving file:', error)
                  }
                }

                await retrieveFile(fileId)

                return
              } catch (e) {
                console.error(e)
                ;(window.opener?.shopify as any)?.modal?.hide(MODAL_ID.TEMPLATE_EDITOR_MODAL)

                setTimeout(() => {
                  navigate('/templates')
                }, 200)

                return
              }
            }
          }
        })()

        return
      }

      if (!templateId || !shopDomain) {
        return
      }

      ;(async () => {
        const psds = template.psds || []
        const name = template.name
        const dimension = template.dimension
        const category = template.category
        let layerMapping: LayerDocument[] = template.layers || EMPTY_ARRAY
        const isCreatingNew = template.isCreatingNew

        // Calculate the viewport of the template when opening the template
        const viewport = evaluateTemplateViewPort(dimension ?? psds[0]?.image)
        const clipartsAdded = []

        // Check if the template is a premade template
        if (template?.templateActionType !== 'SET_TEMPLATE_GENERATED_DATA' && premadeTemplateId && isCreatingNew) {
          const premadeTemplatesDetails = await getClipartsDetails({
            clipartsSelected: [{ _id: premadeTemplateId, type: TEMPLATE_TYPE.TEMPLATE }],
          })

          layerMapping = duplicateLayers({
            layers: premadeTemplatesDetails[0].layers,
            shopDomain,
            shouldUploadImageToShopify: true,
          })

          clipartsAdded.push(premadeTemplatesDetails[0])
        }

        // If opened from integrations with source=form, prefer any override stored in IDB
        try {
          if (sourceStr === 'form' && contentStr) {
            const idbId = decodeURIComponent(contentStr)
            const storeName = IDB_STORE_NAME.TEMPLATE_DIMENSION
            const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, storeName)
            const jsonObject = (await getJSONFromIDB(db, storeName, idbId)) as any
            const overridePreview = jsonObject?.previewProductImage
            if (overridePreview) {
              // Mutate local template object before dispatch
              template.previewProductImage = overridePreview
            }
          }
        } catch (e) {
          console.warn('[InitTemplate] Failed to read override preview from IDB:', e)
        }

        TemplateEditorStore.dispatch({
          type: template?.templateActionType || 'INIT_DATA',
          payload: {
            state: {
              ...DEFAULT_TEMPLATE_EDITOR_STORE,
              ...template,
              interactive: true,
              _id: (template as any)?._id || templateId,
              shopDomain,
              name,
              category,
              dimension:
                dimension
                ?? (psds[0]?.image
                  ? {
                      width: psds[0].image.width,
                      height: psds[0].image.height,
                      resolution: DEFAULT_TEMPLATE_DIMENSION.resolution,
                      measurementUnit: DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
                    }
                  : DEFAULT_TEMPLATE_DIMENSION),
              viewport: viewport,
              clipartsAdded: clipartsAdded as any[],
              previewUrl: template.previewUrl,
              metadata,
              // Preserve seeded preview image passed in template object if exists (may be overridden from IDB)
              previewProductImage: template.previewProductImage || DEFAULT_TEMPLATE_EDITOR_STORE.previewProductImage,
              createdAt: template.createdAt,
            },
          },
          // Only skip trace if cliparts are not added
          skipTrace: !clipartsAdded.length && !template.templateActionType,
        })

        // CRITICAL: Always reset extracting to false after initializing template
        // This must be done AFTER INIT_DATA dispatch to ensure it's not overridden
        // This prevents ProgressProcessPSD from being stuck when switching print areas
        TemplateEditorStoreActions.setLoading(false)

        psds.forEach((psd: any) => {
          PSDsStoreActions.addPSD({
            _id: psd._id,
            psdData: psd,
          })
        })

        const layerStores = layerMapping.filter(l => !l.isGroupLayer).map(layer => createLayerStore(layer))

        const layersState = layerStores.map(layerStore => layerStore.getState()) as Layer[]
        // Do not add layers are inside multi-layout to extracted layer stores
        const extractedLayerStores = layerStores.filter(layerStore => {
          const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(layerStore.getState() as Layer, layersState)

          return !isLayerInsideMultiLayout
        })

        setExtractedLayerStores(extractedLayerStores, !template.templateActionType)

        if (autoSelectFirstLayer && shouldAutoSelectFirstLayer(extractedLayerStores)) {
          LayerStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { clickedLayerStore: extractedLayerStores[0] },
          })
        }

        // Notify undo/redo listeners
        notifyUndoRedoListeners()
      })()
    },
    [
      templateId,
      shopDomain,
      initChatBotMessage,
      sourceStr,
      contentStr,
      evaluateTemplateViewPort,
      getLayerStores,
      shouldAutoSelectFirstLayer,
      processLayersForRenderingAfterUploadingPSDFile,
      navigate,
      premadeTemplateId,
    ]
  )

  const clearTemplateState = useCallback(() => {
    TemplateEditorStore.dispatch({
      type: 'RESET_STATE',
    })
  }, [])

  return { initTemplate, initOptionSetLists, clearTemplateState, evaluateTemplateViewPort }
}
