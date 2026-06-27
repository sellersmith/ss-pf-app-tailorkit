/**
 * LayerExecutor handles layer operations with simulation/persistence modes and AI image generation.
 * Supports create, edit, delete operations for both text and image layers.
 */
import { getShopData } from '~/models/Shop.server'
import type { SupervisorState } from '~/libs/langchain/supervisor'
import { uuid } from '~/utils/uuid'
import { ELayerType, type TextSettings } from '~/types/psd'
import type { FontResolution } from '../../templates/services/FontService'
import { FontService } from '../../templates/services/FontService'
import type { UploadedImage } from '../ImageService'
import { ImageService } from '../ImageService'
import type { ChatInvoker } from '../ProductIntentAnalyzer'
import type { SmartEditParameters } from '../../templates/types'
import type { TemplateContext } from '../../templates/context/TemplateContextProvider'

/** Handles layer operations with simulation/persistence modes and image generation. */
export class LayerExecutor {
  private imageService: ImageService
  private fontService: FontService

  constructor(private readonly chatInvoker: ChatInvoker) {
    this.imageService = new ImageService(chatInvoker)
    this.fontService = FontService.getInstance()
  }

  /** Creates a new layer (text/image) with AI processing and font resolution. */
  async createLayer(args: {
    parameters: SmartEditParameters
    context: SupervisorState['context'] & TemplateContext
    onChunk?: (chunk: string) => void
  }): Promise<any> {
    const { parameters, context, onChunk } = args
    const changes: any = parameters?.updatedLayer || {}

    const shopData = context?.shopDomain ? await getShopData(context.shopDomain as string) : null

    switch (changes?.type) {
      case ELayerType.IMAGE: {
        const processedImageLayer = await this.processImageLayer({ layer: changes, onChunk, shopData, context })
        processedImageLayer.isCreatedByAIAssistant = true
        return { success: true, layer: processedImageLayer, simulated: true as const }
      }
      case ELayerType.TEXT: {
        const processedTextLayer = await this.processTextLayer({ layer: changes })
        processedTextLayer.isCreatedByAIAssistant = true
        return { success: true, layer: processedTextLayer, simulated: true as const }
      }
      default: {
        return { success: true, layer: changes, simulated: true as const }
      }
    }
  }

  async processTextLayer(args: { layer: any }): Promise<any> {
    const { layer } = args
    const resolvedFont = await this.resolveGoogleFont(layer.settings)

    if (resolvedFont) {
      layer.settings.fontFamily = resolvedFont
    }
    layer.settings.autoFitToContainer = true

    return layer
  }

  async processImageLayer(args: {
    layer: any
    onChunk?: (chunk: string) => void
    shopData: any
    context: any
  }): Promise<any> {
    const { layer, onChunk, shopData, context } = args

    const providedPrompt = layer.image?.generativeOptions?.prompt

    if (!providedPrompt) {
      return layer
    }

    // Generate AI image using provided prompt and layer configuration
    const { filesPerLayer } = await this.imageService.generateAndApplyImage({
      onChunk,
      shopData,
      imageLayers: [
        {
          _id: layer._id,
          label: layer.label,
          imagePrompt: providedPrompt,
          imageType: layer.imageType,
          imageWidth: layer.image?.width,
          imageHeight: layer.image?.height,
          imageStyle: layer.image?.generativeOptions?.imageStyle || '',
          aspectRatio: layer.image?.generativeOptions?.aspectRatio || '',
        },
      ],
      optimizedPrompts: [providedPrompt],
      context,
      userMessage: '',
    })

    // Process generated image and update layer metadata
    const file = filesPerLayer[0]
    if (file && typeof file === 'object' && 'alt' in file && 'image' in file) {
      const uploadedFile = file as UploadedImage
      const nextGen = {
        ...(layer.image?.generativeOptions || {}),
        prompt: providedPrompt,
      }
      layer.image = {
        _id: uuid(),
        src: uploadedFile.image?.originalSrc || '',
        imageName: uploadedFile.alt || '',
        width: uploadedFile.image?.width || 0,
        height: uploadedFile.image?.height || 0,
        generativeOptions: nextGen,
      }
    }

    return layer
  }

  /** Edits existing layer with auto image generation when imagePrompt is provided. */
  async editLayer(args: {
    parameters: SmartEditParameters
    context: SupervisorState['context'] & TemplateContext
    onChunk?: (chunk: string) => void
  }): Promise<any> {
    const { parameters, context, onChunk } = args
    const changes: any = parameters?.updatedLayer || {}

    const shopData = context?.shopDomain ? await getShopData(context.shopDomain as string) : null

    // Handle image generation when prompt is provided for image layers
    switch (changes?.type) {
      case ELayerType.IMAGE:
        const processedImageLayer = await this.processImageLayer({ layer: changes, onChunk, shopData, context })
        return { success: true, layer: processedImageLayer, simulated: true as const }
      case ELayerType.TEXT:
        const processedTextLayer = await this.processTextLayer({ layer: changes })
        return { success: true, layer: processedTextLayer, simulated: true as const }
      default:
        return { success: true, layer: changes, simulated: true as const }
    }
  }

  /** Deletes layer by marking it as deleted (simulation-friendly). */
  async deleteLayer(parameters: SmartEditParameters): Promise<any> {
    const layerId: string | undefined = parameters?.updatedLayer?._id

    if (!layerId) {
      return { success: false, error: 'Missing layerId for deletion', simulated: true as const }
    }

    // Mark layer as deleted for preview filtering
    const layer = {
      _id: String(layerId),
      visible: false,
      isDeletedOnEditor: true,
    }
    return { success: true, layer, simulated: true as const }
  }

  /** Resolves Google Font using FontService. */
  private async resolveGoogleFont(settings: TextSettings): Promise<FontResolution | null> {
    const requested = String(settings?.fontFamily?.family || '').trim()

    return this.fontService.resolveGoogleFont(requested, {
      variant: 'regular',
      requireLatinSubset: true,
    })
  }
}
