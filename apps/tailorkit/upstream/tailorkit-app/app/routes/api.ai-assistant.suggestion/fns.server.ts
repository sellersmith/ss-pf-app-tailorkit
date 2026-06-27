import { type AssistantService } from '~/libs/openai/assistant.service'
import type { ChatModel } from 'openai/resources/index.mjs'
import { CONVERSATION_ANALYSIS_SYSTEM_MESSAGE, type ConversationAnalysisResponse } from './constants'
import { initializeAssistant } from '../api.ai-assistant/fns.server'
import { isJSON } from 'extensions/tailorkit-src/src/assets/fns/is-json'
import type { TFileToUpload } from '~/shopify/graphql/files/types'
import { uuid } from '~/utils/uuid'
import { downloadImageFromUrl } from '~/utils/image-tools'
import {
  detectBackgroundFromBuffer,
  removeBackgroundFromBuffer,
} from '~/utils/image-processing/core/solid-bg-removal.server'
import { generateVectorFromImage, DEFAULT_VECTOR_PARAMS } from '~/modules/VectorWizard/generateVector.server'
import type { VectorConversionParameters } from '~/modules/VectorWizard/types'
import { applyStyleTransferToSvg } from '~/shared/utils/applyFilterPreset'
import type { PathFilterPresetParams } from '~/modules/VectorEditor/utils/filters/pathFilterPresets'

// Enforce model constraints and sanitize inputs
const ALLOWED_SIZES = new Set(['auto', '256x256', '512x512', '1024x1024'])

/**
 * Validates and sanitizes metadata to prevent sensitive information exposure
 * @param metadata - The metadata object to sanitize
 * @returns Sanitized metadata object with sensitive fields removed
 */
export function sanitizeMetadata(metadata: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!metadata) return undefined

  // Create a new object to avoid modifying the original
  const sanitized: Record<string, any> = {}

  // List of potentially sensitive keys to exclude
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'session',
    'private',
    'personal',
    'api_key',
    'apikey',
    'ssn',
    'social',
    'credit',
    'card',
    'cvv',
    'pin',
    'passport',
    'license',
    'access_token',
    'refresh_token',
  ]

  // Copy only non-sensitive keys
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase()

    // Skip sensitive keys
    if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
      continue
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value)
    } else {
      // For primitive values and arrays, copy as is
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Analyzes a conversation to identify topics and generate redirection if needed
 * @param args - Arguments for the conversation analysis
 * @param args.assistant - The assistant service instance
 * @param args.conversationHistory - Previous messages in the conversation
 * @returns Promise<ConversationAnalysis> - Analysis results and redirection suggestion
 */
export async function analyzeConversationToSuggestion(args: {
  assistant: AssistantService
  conversationHistory: any[]
  suggestionId?: string
}): Promise<ConversationAnalysisResponse> {
  const { assistant, conversationHistory = [] } = args
  // Default analysis result
  const defaultAnalysis: ConversationAnalysisResponse = {
    mainTopic: '',
    suggestionsOptions: [],
    questionGainDeeper: null,
  }

  try {
    // Last conversation message in history
    const conversationAnalysisResponse = await assistant.analyzeConversation(
      CONVERSATION_ANALYSIS_SYSTEM_MESSAGE,
      conversationHistory
    )

    try {
      return conversationAnalysisResponse as ConversationAnalysisResponse
    } catch (parseError) {
      console.error('Error parsing conversation analysis response:', parseError)
      return defaultAnalysis
    }
  } catch (error) {
    console.error('Error analyzing conversation:', error)
    return defaultAnalysis
  }
}

export async function generateTextContent(requestBody: any): Promise<{
  success: boolean
  error?: string
  status?: number
  contents?: string[]
}> {
  const {
    initialContent,
    mainTextLabel,
    optionalTextLabel,
    topic,
    instructions,
    tone,
    maxContentLength,
    metadata: rawMetadata,
    optionResponseQuantity = 5,
    containHTMLTags = false,
    model = 'gpt-4o-mini',
  } = requestBody

  const contentAssistant = initializeAssistant({
    // Use higher model for better suggestion than default model
    model,
    suggestionId: 'generate-content',
  })

  // Sanitize metadata to prevent sensitive data exposure
  const metadata = sanitizeMetadata(rawMetadata)

  const prompt = `
          Generate/refine contents for the following with base on system questions and user's answers:
          **Note:** Remember follow the structured response format in the system prompt.
          ${mainTextLabel ? `System question 1: ${mainTextLabel}\nUser answer 1: ${topic}` : ''}
          ${optionalTextLabel ? `System question 2: ${optionalTextLabel}\nUser answer 2: ${instructions}` : ''}
          Tone: ${tone}
          Contain HTML tags: ${containHTMLTags}
          Option response quantity: ${optionResponseQuantity}
          ${
            maxContentLength
              ? [
                  `max_content_length: ${maxContentLength} characters. This is a strict upper limit, including spaces and punctuation.`,
                  `Remember that each content item must be ≤ ${maxContentLength} characters.`,
                ].join(' ')
              : 'No content length restriction is provided.'
          }
          ${initialContent ? `User provided content: ${initialContent}` : ''}
          ${metadata ? `Metadata: ${JSON.stringify(metadata)}` : ''}
        `

  let data = await contentAssistant.generateContent(prompt)

  if (data?.startsWith('```json')) {
    data = data.replace('```json', '').replace('```', '').trim()
  }

  if (!data) {
    return {
      success: false,
      error: 'No content generated',
      status: 400,
    }
  }

  const isValidJson = isJSON(data)

  if (!isValidJson) {
    return {
      success: false,
      error: 'Invalid JSON',
      status: 400,
    }
  }

  return {
    success: true,
    contents: JSON.parse(data).contents,
  }
}

export async function generateImages(requestBody: any): Promise<{
  success: boolean
  error?: string
  status?: number
  files: TFileToUpload[] | File[]
  actualCount: number
}> {
  try {
    const {
      prompt: userPrompt,
      referenceImageUrls = [],
      referenceImageBuffers = [],
      numberGeneratedImages = 1,
      aspectRatio = '1:1',
      removeBackground = 'none',
      solidWhiteBackgroundRemoval = false,
      model,
      shopDomain,
      size = 'auto',
      templateType,
      visualStyle,
      contentTheme,
    } = requestBody

    const sanitizedNumOutputs = Number(numberGeneratedImages) || 1
    const sanitizedSize = ALLOWED_SIZES.has(size) ? size : 'auto'
    const sanitizedRefs = (Array.isArray(referenceImageUrls) ? referenceImageUrls : []).filter(
      url => typeof url === 'string' && /^https?:\/\//i.test(url)
    )
    const sanitizedBuffers = Array.isArray(referenceImageBuffers)
      ? referenceImageBuffers.filter(buf => Buffer.isBuffer(buf) && buf.length > 0)
      : []

    const assistant = initializeAssistant({
      // Use higher model for better suggestion than default model
      user: shopDomain,
    })
    const prompt = userPrompt.replace(/[\r\n]+/g, ' ')

    const generatedImages = await assistant.generateImages({
      model,
      prompt,
      templateType,
      visualStyle,
      contentTheme,
      numberGeneratedImages: sanitizedNumOutputs,
      aspectRatio,
      size: sanitizedSize as any,
      imagesString: sanitizedRefs.length > 0 ? sanitizedRefs : undefined,
      imagesBuffer: sanitizedBuffers.length > 0 ? sanitizedBuffers : undefined,
      solidWhiteBackgroundRemoval,
    })

    let files: TFileToUpload[] | File[] = []

    // Check type of generatedImages
    if (generatedImages.length > 0) {
      // Check if the image was rendered on a solid white background
      if (removeBackground !== 'none') {
        for (let i = 0; i < generatedImages.length; i++) {
          const image = generatedImages[i]
          const imageBuffer = typeof image === 'string' ? await downloadImageFromUrl(image) : image

          const backgroundDetection = await detectBackgroundFromBuffer(imageBuffer, {
            detectEnclosed: removeBackground === 'surrounding-enclosed',
          })

          if (backgroundDetection?.summary?.hasBackground) {
            generatedImages[i] = await removeBackgroundFromBuffer(imageBuffer, {
              removeEnclosed: removeBackground === 'surrounding-enclosed',
            })
          }
        }
      }

      if (typeof generatedImages[0] === 'string') {
        files = generatedImages.map(image => {
          const id = uuid().split('-')[0]
          const filename = `image-prompt-${id}.png`

          return {
            originalSource: image,
            contentType: 'IMAGE',
            filename,
            alt: `image-prompt-${id}`,
          }
        }) as TFileToUpload[]
      } else {
        files = generatedImages.map(image => {
          const id = uuid().split('-')[0]
          const imageName = `image-prompt-${id}.png`

          // @ts-ignore
          return new File([image], imageName, { type: 'image/png' })
        })
      }
    }

    return {
      success: true,
      files,
      actualCount: files.length,
    }
  } catch (error: any) {
    console.error('Error generating image:', error)
    return {
      success: false,
      error: error.message || 'System errors found. Please try again.',
      status: 400,
      files: [],
      actualCount: 0,
    }
  }
}

/**
 * Suggest the best matching clipart category for a shop based on its metadata.
 * Falls back to empty category when a confident match is not possible.
 */
export async function suggestClipartCategory(args: {
  categories: string[]
  shopDescription?: string
  shopCategories?: string[]
  model?: ChatModel
}): Promise<{ category: string; reason?: string }> {
  const { categories = [], shopDescription = '', shopCategories = [], model } = args
  if (!categories.length) return { category: '' }

  // Use AI ONLY to analyze and suggest the best category
  try {
    const assistant = initializeAssistant(model ? { model } : {})

    const prompt = [
      'You are an expert at analyzing e-commerce stores and matching them to relevant clipart categories for product personalization.',
      '',
      '**TASK:** Analyze the provided Shopify store information and select the SINGLE MOST RELEVANT category from the available list.',
      '',
      '**Available Categories:**',
      categories.map((c, i) => `${i + 1}. "${c}"`).join('\n'),
      '',
      '**Store Information:**',
      shopDescription ? `- Description: ${shopDescription}` : '- Description: (not provided)',
      shopCategories && shopCategories.length > 0
        ? `- Product Categories: ${shopCategories.join(', ')}`
        : '- Product Categories: (not provided)',
      '',
      '**Analysis Steps:**',
      '1. Examine the store description and product categories',
      '2. Determine what types of products this store sells (e.g., apparel, gifts, personalized items)',
      '3. Consider what clipart themes customers would most likely use to personalize these products',
      '4. Match the store context to the MOST RELEVANT category from the list above',
      '5. If uncertain, choose the category with the broadest appeal for personalized products',
      '',
      '**CRITICAL REQUIREMENTS:**',
      '- You MUST select ONE category from the list above',
      '- The "category" value MUST match EXACTLY (case-sensitive) one of the category names listed',
      '- Even if the fit is not perfect, choose the closest/most relevant option',
      '- DO NOT return an empty category - always pick the best available match',
      '',

      '**Response Format (JSON only):**',
      '{',
      '  "category": "exact category name from the list",',
      '  "reason": "brief explanation (1-2 sentences) of why this category best fits the store"',
      '}',
    ].join('\n')

    let data = await assistant.generateContent(prompt)
    if (data?.startsWith('```json')) {
      data = data.replace('```json', '').replace('```', '').trim()
    }

    if (!data || !isJSON(data)) {
      console.error('suggestClipartCategory: Invalid JSON response')
      return { category: '' }
    }

    const parsed = JSON.parse(data)
    const cat = typeof parsed.category === 'string' ? parsed.category.trim() : ''

    // Validate that the returned category is in our list
    if (!categories.includes(cat)) {
      console.error(`suggestClipartCategory: AI returned category "${cat}" which is not in the provided list`)
      return { category: '' }
    }

    return { category: cat, reason: typeof parsed.reason === 'string' ? parsed.reason : undefined }
  } catch (error) {
    console.error('suggestClipartCategory AI failed:', error)
    return { category: '' }
  }
}

/**
 * Vector style prompt suffix to guide AI image generation for vector conversion
 */
const VECTOR_STYLE_PROMPT_SUFFIX
  = 'flat illustration style, clean edges, solid colors, minimal gradients, no shadows, high contrast, suitable for vector conversion, simple shapes'

/**
 * Generate a vector shape from AI image generation
 *
 * Flow:
 * 1. Generate raster image with AI (with vector-style constraints)
 * 2. Auto-detect content boundary
 * 3. Convert to vector SVG using Potrace
 * 4. Upload SVG to Shopify CDN
 *
 * @param requestBody - Request parameters
 * @returns Vector generation result with SVG URL
 */
export async function generateVector(requestBody: {
  prompt: string
  aspectRatio?: string
  shopDomain: string
  conversionParams?: Partial<VectorConversionParameters>
  /** Filter preset ID to apply (e.g., 'debossing', 'embossing') */
  filterPresetId?: string
  /** Filter preset parameters (e.g., { depth: 50, softness: 30 }) */
  filterPresetParams?: PathFilterPresetParams
  /** Fill color to apply to generated paths (e.g., '#000000') */
  fill?: string
  /** Stroke color to apply to generated paths (e.g., '#000000') */
  stroke?: string
  /** Stroke width to apply to generated paths */
  strokeWidth?: number
  /** Optional: URL of an already-generated raster image to vectorize (skips AI generation step) */
  imageUrl?: string
  /** Optional: Reference image URLs for AI to use as style/content reference during generation */
  referenceImageUrls?: string[]
  /** Optional: Pre-authenticated Shopify admin API client for uploading to CDN */
  adminApi?: any
}): Promise<{
  success: boolean
  error?: string
  status?: number
  svgUrl?: string
  svgDataUri?: string
}> {
  try {
    const {
      prompt: userPrompt,
      aspectRatio = '1:1',
      shopDomain,
      conversionParams = {},
      filterPresetId,
      filterPresetParams,
      fill,
      stroke,
      strokeWidth,
      imageUrl,
      referenceImageUrls = [],
      adminApi,
    } = requestBody

    let imageBuffer: Buffer

    // If imageUrl is provided, use the already-generated image instead of generating a new one
    if (imageUrl) {
      // Download the already-generated image
      imageBuffer = await downloadImageFromUrl(imageUrl)
    } else {
      // Step 1: Generate raster image with vector-style prompt
      const vectorPrompt = `${userPrompt.trim()}. ${VECTOR_STYLE_PROMPT_SUFFIX}`

      const assistant = initializeAssistant({
        user: shopDomain,
      })

      // Sanitize reference image URLs (same pattern as generateImages)
      const sanitizedRefs = (Array.isArray(referenceImageUrls) ? referenceImageUrls : []).filter(
        url => typeof url === 'string' && /^https?:\/\//i.test(url)
      )

      const generatedImages = await assistant.generateImages({
        prompt: vectorPrompt,
        numberGeneratedImages: 1,
        aspectRatio,
        size: 'auto',
        solidWhiteBackgroundRemoval: true,
        // Pass reference images for AI to use as style/content reference
        imagesString: sanitizedRefs.length > 0 ? sanitizedRefs : undefined,
      })

      if (!generatedImages || generatedImages.length === 0) {
        return {
          success: false,
          error: 'Failed to generate image',
          status: 400,
        }
      }

      // Get image buffer
      const generatedImage = generatedImages[0]
      imageBuffer = typeof generatedImage === 'string' ? await downloadImageFromUrl(generatedImage) : generatedImage
    }

    // Step 2 & 3: Auto-detect boundary and convert to vector
    // Use pre-authenticated admin API if provided, otherwise SVG will be returned as data URI only
    const shopifyClient = adminApi ? { api: adminApi, shopDomain } : undefined

    if (!shopifyClient) {
      console.warn('No admin API provided for Shopify upload, SVG will be returned as data URI only')
    }

    const vectorResult = await generateVectorFromImage(imageBuffer, {
      autoDetectBoundary: true,
      conversionParams: {
        ...DEFAULT_VECTOR_PARAMS,
        ...conversionParams,
      },
      uploadToShopify: !!shopifyClient,
      fileName: `ai-vector-${uuid().split('-')[0]}`,
      shopifyClient,
    })

    if (vectorResult.error) {
      return {
        success: false,
        error: vectorResult.error,
        status: 400,
      }
    }

    // Step 4: Apply style transfer (filter preset + fill/stroke) if any styles provided
    let finalSvgDataUri = vectorResult.svgDataUri
    let finalSvgUrl = vectorResult.svgUrl

    const hasStylesToApply = filterPresetId || fill || stroke
    if (hasStylesToApply && finalSvgDataUri) {
      // Extract SVG content from data URI
      const svgMatch = finalSvgDataUri.match(/^data:image\/svg\+xml;base64,(.+)$/)
      if (svgMatch) {
        const svgContent = Buffer.from(svgMatch[1], 'base64').toString('utf-8')
        const styledSvg = applyStyleTransferToSvg(svgContent, {
          filterPresetId,
          filterPresetParams,
          fill,
          stroke,
          strokeWidth,
          // If original SVG has stroke but no fill, remove fill from generated SVG
          removeFillIfNoFill: true,
        })
        finalSvgDataUri = `data:image/svg+xml;base64,${Buffer.from(styledSvg).toString('base64')}`

        // If we have a CDN URL and shopify client, re-upload the styled SVG
        if (shopifyClient) {
          try {
            const { ShopifyApiClient } = await import('~/shopify/graphql/api.server')
            const { uploadFiles } = await import('~/shopify/graphql/files/fns.server')

            const api = new ShopifyApiClient(shopifyClient.api)
            const fileName = `ai-vector-styled-${uuid().split('-')[0]}.svg`
            const file = new File([styledSvg], fileName, { type: 'image/svg+xml' })

            const uploadResult = await uploadFiles({
              api,
              files: [file],
              shopDomain: shopifyClient.shopDomain,
              privateUpload: false,
            })

            // uploadFiles returns { uploadedFiles, errorFiles, errors }
            // URL is in uploadedFiles[].image?.originalSrc
            const uploadedFile = uploadResult?.uploadedFiles?.[0]
            const uploadedUrl = uploadedFile?.image?.originalSrc || uploadedFile?.url
            if (uploadedUrl) {
              finalSvgUrl = uploadedUrl
            }
          } catch (uploadError) {
            console.warn('Failed to upload styled SVG, using data URI instead:', uploadError)
          }
        }
      }
    }

    return {
      success: true,
      svgUrl: finalSvgUrl,
      svgDataUri: finalSvgDataUri,
    }
  } catch (error: any) {
    console.error('Error generating vector:', error)
    return {
      success: false,
      error: error.message || 'System error occurred while generating vector. Please try again.',
      status: 500,
    }
  }
}
