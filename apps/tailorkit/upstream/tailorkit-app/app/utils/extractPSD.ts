import { CanvasErrors } from '~/constants/errors'
import { ProgressStoreActions } from '~/stores/canvas/progress'
import { createLayerStore } from '~/stores/modules/layer'
import { PSDsStoreActions } from '~/stores/modules/psd'
import {
  DEFAULT_TEMPLATE_DIMENSION,
  DEFAULT_TEMPLATE_EDITOR_STORE,
  TemplateEditorStore,
  TemplateEditorStoreActions,
} from '~/stores/modules/template'
import type { NodeText, Layer, PSD } from '~/types/psd'
import { chunkArray } from './chunkArray'
import { copyObjectProperties } from './copyObjectProperties'
import { getEssentialImageProperties, getEssentialLayerProperties } from './getEssentialProperties'
import { sleep } from './sleep'
import { showGenericErrorToast } from './toastEvents'
import { uuid } from './uuid'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { FILE_UPLOAD_EVENTS } from '~/modules/TemplateEditor/constants'
import { dataURLtoFile, getFileNameWithoutExtension, sanitizeFileName } from './file-types'
import { useCallback } from 'react'
import { MAX_ZOOM_SPEED, TEMPLATE_EDITOR_CANVAS_CONTAINER } from '~/constants/canvas'
import { calculateOnInitTemplate } from './canvas/zoom'
import { calculateEffectiveDimension } from './canvas/calculateEffectiveDimension'
import { lengthUnitToPixels } from './lengthUnitToPixels'
import { getWidthHeightNumberOfDom } from './canvas/getWidthHeightNumberOfDom'
import { authenticatedFetch } from '~/shopify/fns.client'
import { getFlagImageNameOfLayerImage } from './file-types/prepare-files-to-upload'
import { useSearchParams } from '@remix-run/react'

const { addExtractedLayerStores, setLoading, setOptionSetLists } = TemplateEditorStoreActions
const { addPSD } = PSDsStoreActions

const DEFAULT_NUMBER_TO_EVALUATE = 5
//const DEFAULT_TIME_SLEEP = 200
// const STANDARD_FILE_SIZE = 262144000

export function useExtractPSD() {
  const [searchParams] = useSearchParams()
  const shopDomain = searchParams.get('shop') || ''
  /**
   *
   * @param _dropFiles
   * @param progressActions
   * @returns Promise<{ psd: PSD | null; layers: Layer[] }>
   * @description This function is only served for extracting data of psd file,
   * no external process should handle on this function
   */
  async function extractPSD(
    _dropFiles: File[] | string[],
    progressActions: typeof ProgressStoreActions
  ): Promise<{ psd: PSD | null; layers: Layer[]; resolution: number }> {
    /* @ts-ignore*/
    const PSD = (await import('psd-vanilla-js')).default
    if (!PSD) return { psd: null, layers: [], resolution: DEFAULT_TEMPLATE_DIMENSION.resolution }

    const { setProgress, clearProgress } = progressActions
    const timesEvaluating = []

    let layerMapping: Layer[] = []

    const dropFile = _dropFiles[0]
    const fileName = dropFile instanceof File ? getFileNameWithoutExtension(dropFile.name) : ''

    const fileURL = typeof dropFile === 'string' ? dropFile : window.URL.createObjectURL(dropFile)

    const psd = await PSD.fromURL(fileURL)

    const resolution = (Object.values(psd.resources.resources)[0] as any)?.h_res

    const psdId = uuid()
    const tree = psd.tree()

    const rawLayers = await getAllCompositeLayers(tree)

    const layersLength = rawLayers.length

    const chunkExtractedLayers: Layer[][] = chunkArray(rawLayers)

    for (const extractedLayers of chunkExtractedLayers) {
      for (const extractedLayer of extractedLayers) {
        const { width, height, type, node } = extractedLayer as Layer

        // Init the rotate layer equal to zero due to pixelData has already calculated the rotation
        extractedLayer.rotate = 0
        const { name, parent } = node

        const parentName = parent?.name

        const imageName = `${fileName ? `${fileName}_` : ''}${parentName ? `${parentName}_` : ''}${name}`

        if (!['group', 'text'].includes(type)) {
          const s1 = performance.now()

          let base64Src = ''

          if (width > 0 && height > 0) {
            // @ts-ignore
            base64Src = await extractedLayer.image.toBase64()
          }

          const timeOffset = performance.now() - s1
          timesEvaluating.length < DEFAULT_NUMBER_TO_EVALUATE && timesEvaluating.push(timeOffset)

          const _extractedLayer: Layer = {
            ...extractedLayer,
            image: { ...copyObjectProperties(extractedLayer.image), _id: uuid(), imageName, src: base64Src },
            mask: { ...copyObjectProperties(extractedLayer.mask), _id: uuid() },
            psdId: psdId,
            optionSet: [],
          }

          layerMapping.push(_extractedLayer)
        } else {
          layerMapping.push({
            ...extractedLayer,
            image: { ...copyObjectProperties(extractedLayer.image), _id: uuid(), imageName },
            mask: { ...copyObjectProperties(extractedLayer.mask), _id: uuid() },
            psdId,
            optionSet: undefined,
          })
        }

        // Render progress
        setProgress({ index: layerMapping.length, total: layersLength })

        // Sleep to render progress
        await sleep(50)
      }
    }

    /* @ts-ignore */
    layerMapping = layerMapping.map(l => {
      const _layer = getEssentialLayerProperties(l)
      const layerImage = getEssentialImageProperties(_layer.image)

      _layer.image = layerImage
      return _layer
    })

    const _layerMapping = layerMapping.filter((l: any) => !!l && !!l._id)

    clearProgress()

    return {
      psd: {
        ...psd,
        _id: psdId,
        name: fileName || DEFAULT_TEMPLATE_EDITOR_STORE.name,
        image: {
          ...copyObjectProperties(psd.image),
          width: psd.image.width(),
          height: psd.image.height(),
        },
      },
      layers: _layerMapping,
      resolution,
    }
  }

  /**
   *
   * @param _dropFiles File[]
   * @param acceptedFiles File[]
   * @param _rejectedFiles File[]
   * @description This function handles the process after uploading psd file
   */
  const processLayersForRenderingAfterUploadingPSDFile = useCallback(
    async function processLayersForRenderingAfterUploadingPSDFile(
      _dropFiles: File[] | string[],
      acceptedFiles: File[] | string[],
      _rejectedFiles: File[],
      newTemplate: boolean = false
    ) {
      try {
        if (_rejectedFiles.length > 0) {
          throw new Error(CanvasErrors.INVALID_FILE)
        }

        setLoading(true)

        const s1 = performance.now()

        const { psd, layers, resolution } = await extractPSD(acceptedFiles, ProgressStoreActions)

        if (!psd) {
          // Early return - ensure loading is reset
          setLoading(false)
          return
        }

        const { dimension, allOptionSetList } = TemplateEditorStore.getState()

        TemplateEditorStore.dispatch({
          type: 'SET_INTERACTIVE',
          payload: {
            interactive: true,
          },
          skipTrace: true,
        })

        TemplateEditorStore.dispatch({
          type: 'SET_NAME',
          payload: {
            name: psd.name || DEFAULT_TEMPLATE_EDITOR_STORE.name,
          },
        })

        const templateDimension = newTemplate
          ? {
              width: psd.image.width,
              height: psd.image.height,
              resolution: resolution,

              // By default when extracting, the unit will be 'px'
              measurementUnit: DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
            }
          : dimension

        TemplateEditorStore.dispatch({
          type: 'SET_DIMENSION',
          payload: {
            dimension: templateDimension,
          },
        })

        // Calculate the viewport of the template after extract PSD file
        let { width: canvasWidth, height: canvasHeight } = DEFAULT_TEMPLATE_DIMENSION

        const canvasContainerElement = document.querySelector(`.${TEMPLATE_EDITOR_CANVAS_CONTAINER}`) as HTMLElement
        const { width = 0, height = 0 } = getWidthHeightNumberOfDom(canvasContainerElement) || {}

        canvasWidth = width - MAX_ZOOM_SPEED * 2
        canvasHeight = height - MAX_ZOOM_SPEED * 2

        if (dimension) {
          const {
            width: dimensionWidth,
            height: dimensionHeight,
            measurementUnit = DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
            resolution = DEFAULT_TEMPLATE_DIMENSION.resolution,
          } = dimension
          const dimensionWidthPixels = lengthUnitToPixels(dimensionWidth, measurementUnit, resolution)
          const dimensionHeightPixels = lengthUnitToPixels(dimensionHeight, measurementUnit, resolution)

          canvasWidth = Math.min(canvasWidth, dimensionWidthPixels)
          canvasHeight = Math.min(canvasHeight, dimensionHeightPixels)
        }

        // Calculate effective dimension accounting for preview product image
        const preview = TemplateEditorStore.getState().previewProductImage
        const { effectiveDimension, contentOffset } = calculateEffectiveDimension(psd.image, preview)

        const { scale, left, top } = calculateOnInitTemplate(
          canvasWidth,
          canvasHeight,
          effectiveDimension,
          false,
          contentOffset
        )
        TemplateEditorStore.dispatch({
          type: 'SET_VIEW_PORT',
          payload: {
            viewport: {
              scale,
              left,
              top,
            },
          },
          skipTrace: true,
        })

        // Reverse layers because PSD file is reversing the order of layer array
        ;[...layers].reverse().forEach(layer => {
          // Upload layer image immediately in the background
          const {
            width,
            height,
            image: { src, imageName },
          } = layer

          if (width > 0 && height > 0 && src && !src.includes('https://')) {
            const imageNameToUpload = getFlagImageNameOfLayerImage({
              layer,
              baseImageName: imageName as string,
              image: layer.image,
            })
            if (imageNameToUpload) {
              Transmitter.trigger(FILE_UPLOAD_EVENTS.SELECT, {
                files: [
                  {
                    _id: layer._id,
                    file: dataURLtoFile(src, imageName as string),
                  },
                ],
              })
              layer.image.imageName = sanitizeFileName(imageNameToUpload)
            }
          }

          const layerStore = createLayerStore({ ...(layer as any), shopDomain })
          addExtractedLayerStores([layerStore])
        })

        addPSD({ _id: psd?._id, psdData: psd })

        const s2 = performance.now()

        console.log(`Took: ${s2 - s1} to extract layers`)

        if (!Object.values(allOptionSetList)?.flat()?.length) {
          // Fetch all the options sets list data
          await authenticatedFetch(`/api/option-sets`).then(data => {
            if (data) {
              const optionSetList = data.items || []
              setOptionSetLists(optionSetList, true)
            }
          })
        }

        return { psd, layers, resolution }
      } catch (e) {
        console.error(e)

        showGenericErrorToast()
      } finally {
        // CRITICAL: Always reset extracting state, even on error or early return
        // This prevents ProgressProcessPSD from being stuck on screen
        setLoading(false)
      }
    },
    [shopDomain]
  )

  return {
    extractPSD,
    processLayersForRenderingAfterUploadingPSDFile,
  }
}

/*
   Each machine has different CPU performance so we can't set a hard time sleep.
   The solution is evaluate the time sleep by measuring the process of extracting at five first layers
   then we get the MAX number to process accordingly
*/

/* function evaluateSleepingTime(timesEvaluating: number[]) {
  if (timesEvaluating.length === DEFAULT_NUMBER_TO_EVALUATE) {
    return Math.max(...timesEvaluating)
  }

  return DEFAULT_TIME_SLEEP
} */

async function getAllCompositeLayers(tree: any) {
  const layers: any[] = []

  /**
   * Recursive function to traverse the tree and collect layers.
   * @param child - Current tree node being processed.
   * @param parentId - ID of the parent layer, if any.
   */
  async function recursiveLayers(child: any, parentId?: string) {
    const layer = child.layer
    const { _id, node } = layer

    if (child._children && child._children.length > 0) {
      layers.push({
        ...layer,
        type: 'group',
        legacyName: node.name,
        image: null,
        parent: parentId || null,
      })

      for (const subChild of child._children) {
        await recursiveLayers(subChild, _id)
      }
    } else if (Object.prototype.hasOwnProperty.call(child.layer, 'typeTool')) {
      const textLayer = await getSettingsOfTextLayerProperties(layer, parentId)
      if (textLayer) {
        layers.push(textLayer)
      }
    } else {
      layers.push({
        ...layer,
        type: 'image',
        legacyName: node.name,
        parent: parentId || null,
      })
    }
  }

  const sanitizedTree = {
    ...tree,
    _children: tree._children?.map((child: any) => ({
      ...child,
      parent: null,
      layer: { ...child.layer, node: { ...child.layer.node, parent: null } },
    })),
  }

  await recursiveLayers(sanitizedTree)
  return layers
}

/**
 * Extract settings for text layers.
 * @param layer - Layer object containing text properties.
 * @param parentId - ID of the parent layer, if any.
 * @returns Processed text layer settings or null if extraction fails.
 */
export async function getSettingsOfTextLayerProperties(layer: Layer & { typeTool: () => any }, parentId?: string) {
  try {
    const typeTool = layer.typeTool?.()
    const text: NodeText = typeTool.export()
    const {
      value: content,
      font: {
        alignment,
        colors,
        styles,
        sizes,
        // names
      },
      transform: { xx },
    } = text

    // Get default font family by getting the first font name
    // const fontName = names[0]
    const color = colors[0]
    const actualFontSize = sizes[0] * xx

    // TODO: Currently, we can't get the exactly font name from the psd file
    // So we mark as Arial as default font and warning user to change the font or upload their fonts.

    // Query font from Shopify files collection and query font from Google Fonts
    // It returns the font src and family name

    // 1. Query font from Shopify files collection
    // const { fontFiles } = await queryFonts(1, fontName, true)

    // let font = fontFiles.find((f: any) => f.nameWithoutExtension === fontName)

    // if (!font) {
    //   // 2. Query font from Google Fonts
    //   const googleFonts = await fetchAllGoogleFonts()

    //   font = googleFonts?.find((f: any) => f.family.toLowerCase() === fontName.toLowerCase())
    // }

    return {
      ...layer,
      type: 'text',
      legacyName: layer.node.name,
      parent: parentId || null,
      image: null,
      settings: {
        content,
        textAlign: alignment[0],
        textColor: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`,
        textStyle: styles,
        fontSize: actualFontSize,
        fontFamily: {
          family: '',
          src: '',
        },
      },
    }
  } catch (err) {
    console.error('Error processing text layer properties:', err)
    return null
  }
}
