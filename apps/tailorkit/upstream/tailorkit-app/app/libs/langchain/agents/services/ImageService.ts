import type { ImageEditParams, ImageGenerateParams } from 'openai/resources/images.mjs'
import type { ShopDocument } from '~/models/Shop'
import { generateImages } from '~/routes/api.ai-assistant.suggestion/fns.server'
import { considerCreditUsage } from '~/routes/api.ai-assistant/fns.server'
import type { TFileToUpload } from '~/shopify/graphql/files/types'
import { pickBestImageSize } from '../templates/utils/imagePromptBuilder'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import { ShopifyApiClient, getShopifyApiClient } from '~/shopify/graphql/api.server'
import { uploadFiles } from '~/shopify/graphql/files/fns.server'
import { EmitStatusService } from './EmitStatusService'
import type { ChatInvoker } from './ProductIntentAnalyzer'
import type { SupervisorState } from '../../supervisor'
import type { AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'
import { checkAiCreditPerMonthExceeded, increaseAiCreditPerMonth } from '~/models/helpers/ai-credit-helpers.server'
import Shop from '~/models/Shop.server'

export type UploadedImage = {
  alt: string
  image: {
    originalSrc: string
    width: number
    height: number
  }
}

export class ImageService {
  private emitStatusService: EmitStatusService
  private chatInvoker: ChatInvoker

  constructor(chatInvoker: ChatInvoker) {
    this.emitStatusService = new EmitStatusService(chatInvoker)
    this.chatInvoker = chatInvoker
  }

  /**
   * Map over an array with a bounded concurrency level while preserving order.
   * Errors in individual tasks do not abort the whole batch; the mapper is
   * expected to handle its own errors and return a fallback value (e.g. null).
   *
   * @template T Input item type
   * @template R Result item type
   * @param items The list of items to process
   * @param concurrencyLimit Maximum number of in-flight tasks
   * @param mapper Async function that maps an item to a result
   * @returns A results array in the original order
   */
  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrencyLimit: number,
    mapper: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results = new Array<R>(items.length) as R[]
    if (items.length === 0) return results
    const limit = Math.max(1, Math.min(concurrencyLimit || 1, items.length))
    let nextIndex = 0
    const activePromises = new Set<Promise<void>>()

    const worker = async () => {
      while (true) {
        const current = nextIndex++
        if (current >= items.length) return

        const taskPromise = (async () => {
          try {
            const result = await mapper(items[current], current)
            results[current] = result
          } catch (error) {
            console.error(`Task ${current} failed:`, error)
            results[current] = null as unknown as R

            // Force garbage collection of any potential large objects
            if (global.gc) {
              global.gc()
            }
          }
        })()

        activePromises.add(taskPromise)
        taskPromise.finally(() => activePromises.delete(taskPromise))
      }
    }

    const workers = Array.from({ length: limit }, () => worker())

    try {
      await Promise.all(workers)

      // Wait for any remaining active promises to complete
      if (activePromises.size > 0) {
        await Promise.allSettled(Array.from(activePromises))
      }
    } finally {
      // Ensure cleanup even if workers fail
      activePromises.clear()

      // Force memory cleanup after batch completion
      if (global.gc) {
        global.gc()
      }
    }

    return results
  }

  /**
   * Step 1: Generate images only (no upload). Also handle credit usage.
   */
  private async generateImagesOnly(args: {
    prompt: string
    baseImageUrl?: string
    numberGeneratedImages: number
    aspectRatio: AllowedAspectRatio
    size?: ImageGenerateParams['size'] | ImageEditParams['size']
    removeBackground: 'none' | string
    shopData?: ShopDocument | null
  }): Promise<{ success: boolean; files: (File | TFileToUpload)[]; error?: string }> {
    const { shopData, numberGeneratedImages, ...bodyRequest } = args
    if (!shopData) {
      return { success: false, files: [], error: 'Shop data not found' }
    }

    const creditUsage = considerCreditUsage('image') * numberGeneratedImages
    const isAiCreditValid = checkAiCreditPerMonthExceeded(shopData, creditUsage)

    if (!isAiCreditValid) {
      throw new Error('AI credit per month exceeded')
    }

    const { success, files, error, actualCount } = await generateImages({
      ...bodyRequest,
      shopDomain: shopData.shopDomain,
    })

    if (success && actualCount > 0) {
      const actualCreditUsage = considerCreditUsage('image') * actualCount
      const allocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
      await increaseAiCreditPerMonth(
        shopData.shopDomain,
        actualCreditUsage,
        'image_generation',
        undefined,
        allocation
      ).catch(error => {
        console.error('Error increasing ai credit per month:', error)
      })
    }

    return { success, files: files as any, error }
  }

  /**
   * Step 2: Upload pre-generated files to Shopify in a single batch.
   */
  private async uploadGeneratedFilesToShopify(args: {
    files: (File | TFileToUpload)[]
    shopData?: ShopDocument | null
    admin?: AdminApiContext
    fileUploadType?: string
  }): Promise<{ uploadedImages: any; error?: string }> {
    const { admin, files, shopData, fileUploadType } = args

    if (!shopData) {
      return { uploadedImages: null, error: 'Shop data not found' }
    }
    // Prefer an authenticated API client even if admin context is absent
    const api = admin ? new ShopifyApiClient(admin) : await getShopifyApiClient(shopData.shopDomain)

    let uploadedImages: any
    try {
      uploadedImages = await uploadFiles({ api, files, shopDomain: shopData.shopDomain, fileUploadType })
    } catch (e) {
      // Fallback: use private upload (S3) to avoid staged upload path when GraphQL context is unavailable
      uploadedImages = await uploadFiles({
        api,
        files,
        shopDomain: shopData.shopDomain,
        privateUpload: true,
        fileUploadType,
      })
    }

    // If for any reason nothing was uploaded (e.g., stagedUploadsCreate failed silently), fallback to private upload
    if (!uploadedImages?.uploadedFiles?.length && files?.length) {
      uploadedImages = await uploadFiles({
        api,
        files,
        shopDomain: shopData.shopDomain,
        privateUpload: true,
        fileUploadType,
      })
    }

    await Shop.updateOne(
      { shopDomain: shopData.shopDomain, 'usages.usedGenerativeAI': { $ne: true } },
      { 'usages.usedGenerativeAI': true }
    )

    return { uploadedImages }
  }

  async generateAndApplyImage(args: {
    shopData?: ShopDocument | null
    imageLayers: {
      _id: string
      label: string
      imagePrompt: string
      imageType: string
      aspectRatio?: string
      imageStyle: string
      imageWidth: number
      imageHeight: number
    }[]
    context: SupervisorState['context']
    optimizedPrompts: string[]
    userMessage: string
    onChunk?: (chunk: string) => void
  }) {
    const { onChunk, shopData, imageLayers, optimizedPrompts, context, userMessage } = args
    onChunk && (await this.emitStatusService.emitStatus(onChunk, 'uploading-images-to-shopify'))
    const generatedFilesPerLayer: ((File | TFileToUpload) | null)[] = await this.mapWithConcurrency(
      imageLayers,
      3,
      async (_layer, i) => {
        const singlePrompt = optimizedPrompts[i]
        const isBackgroundLayer = _layer.imageType?.includes('background')

        // Create isolated execution context for each layer
        let tempResult: any = null
        let tempFiles: (File | TFileToUpload)[] = []

        try {
          const { aspectRatio, size } = pickBestImageSize(imageLayers[i].imageWidth, imageLayers[i].imageHeight)

          // Set timeout for individual generation to prevent hanging
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Image generation timeout for layer ${i}`)), 60000)
          })

          imageLayers[i].aspectRatio = aspectRatio

          const generationPromise = this.generateImagesOnly({
            prompt: singlePrompt,
            numberGeneratedImages: 1,
            aspectRatio,
            size,
            removeBackground: isBackgroundLayer ? 'none' : 'surrounding',
            shopData,
          })

          tempResult = await Promise.race([generationPromise, timeoutPromise])
          tempFiles = ((tempResult as any)?.files || []) as (File | TFileToUpload)[]

          if (tempFiles.length === 0) {
            console.warn(`No files generated for layer ${i}`)
            return null
          }

          const file = tempFiles[0]

          // Clear temporary references
          tempResult = null
          tempFiles = []

          return file
        } catch (genErr: any) {
          console.error(`Failed to generate image for layer ${i}:`, {
            error: genErr.message,
            layer: _layer.label,
            prompt: `${singlePrompt.substring(0, 100)}...`,
          })

          // Clean up any partial results on error
          tempResult = null
          tempFiles = []

          return null
        }
      }
    )

    // Build stable mapping for upload & back-mapping
    const filesWithIndex: Array<{ index: number; file: File | TFileToUpload; key: string }> = []
    for (let idx = 0; idx < generatedFilesPerLayer.length; idx++) {
      const file = generatedFilesPerLayer[idx]
      if (file) {
        const key = file instanceof File ? file.name : (file as TFileToUpload).alt || (file as TFileToUpload).filename
        filesWithIndex.push({ index: idx, file, key })
      }
    }

    if (filesWithIndex.length < imageLayers.length) {
      await this.emitStatusService.emitFriendlyError({
        onChunk: onChunk || (() => {}),
        error: new Error('Some images generation was not successful'),
        userMessage,
        operationHint: 'Generate images for template layers',
      })
    }

    const filesToUpload = filesWithIndex.map(f => f.file)
    const filesPerLayer: (UploadedImage | null)[] = new Array(imageLayers.length).fill(null)

    if (filesToUpload.length > 0) {
      // Step 2: Upload all files in one batch
      const { uploadedImages } = await this.uploadGeneratedFilesToShopify({
        files: filesToUpload,
        shopData,
        admin: context?.shopifyAdmin,
      })

      const uploaded = ((uploadedImages as any)?.uploadedFiles || []) as UploadedImage[]
      const altToUploaded = new Map<string, UploadedImage>(uploaded.map(u => [u.alt, u]))

      filesWithIndex.forEach(({ index, key }, i) => {
        let matched = altToUploaded.get(key)
        // Fallback by position to keep progress even if alt doesn't match (e.g., sanitized filenames)
        if (!matched && uploaded.length > i) matched = uploaded[i]
        filesPerLayer[index] = matched || null
      })
    }

    return { filesPerLayer, imageLayers }
  }

  /**
   * Generate and upload images from a list of prompts with bounded concurrency.
   * Returns uploaded images in the same order as prompts.
   */
  async generateAndUploadFromPrompts(args: {
    shopData?: ShopDocument | null
    prompts: string[]
    width: number
    height: number
    removeBackground: 'none' | string
    admin?: AdminApiContext
    fileUploadType?: string
  }): Promise<(UploadedImage | null)[]> {
    const { shopData, prompts, width, height, removeBackground, admin, fileUploadType } = args
    const { aspectRatio, size } = pickBestImageSize(width, height)

    const generatedFiles: (File | TFileToUpload | null)[] = await this.mapWithConcurrency(prompts, 4, async prompt => {
      const { files } = await this.generateImagesOnly({
        prompt,
        numberGeneratedImages: 1,
        aspectRatio,
        size,
        removeBackground,
        shopData,
      })
      return (files && files[0]) || null
    })

    const filesToUpload = generatedFiles.filter(Boolean) as (File | TFileToUpload)[]
    if (filesToUpload.length === 0) return new Array(prompts.length).fill(null)

    const { uploadedImages } = await this.uploadGeneratedFilesToShopify({
      files: filesToUpload,
      shopData,
      admin,
      fileUploadType,
    })

    const uploaded = ((uploadedImages as any)?.uploadedFiles || []) as UploadedImage[]

    // Map back in order (best-effort by index)
    const result: (UploadedImage | null)[] = []
    let uIndex = 0
    for (let i = 0; i < generatedFiles.length; i++) {
      if (generatedFiles[i]) {
        result.push(uploaded[uIndex] || null)
        uIndex++
      } else {
        result.push(null)
      }
    }

    return result
  }
}
