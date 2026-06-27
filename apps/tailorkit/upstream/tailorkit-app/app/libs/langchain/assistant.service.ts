import { ChatOpenAI } from '@langchain/openai'
import type { BaseMessage } from '@langchain/core/messages'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ChatModel, ImageEditParams, ImageGenerateParams } from 'openai/resources/index.mjs'
import { ConversationRole, MessageClassification } from '~/enums/conversationMessage'
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_MAX_TOKENS,
  OPTIMIZED_IMAGE_PROMPT_GENERATOR,
  SYSTEM_MESSAGE,
} from '~/libs/openai/constants'
import { context as supportContext } from '~/utils/openai-client.server'
import type { ContentListUnion } from '@google/genai'
import { GoogleGenAI } from '@google/genai'
import { TranslationService } from '~/libs/translation/translate.service'
import { downloadImageFromUrl } from '~/utils/image-tools'
import type { AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'
import { AI_IMAGE_EDIT_LIMITS } from '~/routes/api.ai-assistant.suggestion/constants'
import { buildImageGenerationPrompt, isEngravingRequest } from '~/modules/PromptPresets/fns'
import { removeSolidBackgrounds } from '~/utils/image-processing/core/solid-bg-removal.server'
import { withRetry } from '~/utils/retry'

export interface KeywordAnalysis {
  keywords: string[]
  summary: string
}

/**
 * A minimal LangChain-based replacement for the existing AssistantService.
 * Only the functionality required by the `api.ai-assistant` route is
 * implemented for the initial migration: generating a response (non-stream),
 * classifying a prompt, and optimising an image prompt.
 */
export interface AssistantConfig {
  apiKey: string
  model?: ChatModel
  temperature?: number
  maxTokens?: number
  systemMessage?: string
  user?: string
  shopDomain?: string
}

export interface AssistantResponse {
  content: string
  role: ConversationRole | 'assistant' | 'system' | 'user'
  timestamp: Date
}

export class AssistantService {
  private chat: ChatOpenAI
  private model: ChatModel
  private temperature: number
  private maxTokens: number
  private systemMessage: string
  private user?: string

  constructor(config: AssistantConfig) {
    this.model = config.model || DEFAULT_OPENAI_MODEL
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
    this.systemMessage = config.systemMessage || SYSTEM_MESSAGE
    this.user = config.user

    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      streaming: false,
    })
  }

  /**
   * Generate a single, non-streaming assistant response using LangChain.
   * The implementation mirrors the previous generateAIResponse logic but
   * relies on LangChain to execute the chat completion.
   */
  async generateResponse(args: {
    userQuery: string
    documentContext: string
    conversationHistory: AssistantResponse[]
    nickname?: string
    isCrisp?: boolean
    shopDomain?: string
    userId?: string
  }): Promise<string> {
    const { userQuery, documentContext, conversationHistory = [], nickname, isCrisp = false } = args

    // Build messages array
    const messages: BaseMessage[] = []

    // System context
    messages.push(new SystemMessage(supportContext(isCrisp)))

    if (nickname) {
      messages.push(new SystemMessage(`User's nickname: ${nickname}.`))
    }

    // Conversation history (truncate or transform as needed)
    if (conversationHistory.length) {
      conversationHistory.forEach(m => {
        if (m.role === ConversationRole.USER) {
          messages.push(new HumanMessage(m.content))
        } else if (m.role === ConversationRole.ASSISTANT) {
          messages.push(new AIMessage(m.content))
        } else {
          messages.push(new SystemMessage(m.content))
        }
      })
    }

    // Current user query
    messages.push(new HumanMessage(userQuery))

    // Documentation context message
    if (documentContext) {
      messages.push(new SystemMessage(`Relevant documentation:\n\n${documentContext}`))
    }

    const result: any = await this.chat.invoke(messages)
    return result.content as string
  }

  /**
   * Classify a prompt as image or text.
   */
  async classifyPrompt(prompt: string): Promise<MessageClassification> {
    const classifier = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: this.model,
      temperature: 0.2,
      maxTokens: 1,
    })

    const response: any = await classifier.invoke([
      new SystemMessage(CLASSIFICATION_SYSTEM_PROMPT),
      new AIMessage(prompt),
    ])
    const classification = (response.content as string).trim().toLowerCase()
    return classification === 'image' ? MessageClassification.IMAGE : MessageClassification.TEXT
  }

  /**
   * Optimise an image prompt.
   */
  async optimizeImagePrompt(prompt: string): Promise<string> {
    const optimiser = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: this.model,
      temperature: 1,
      maxTokens: DEFAULT_MAX_TOKENS,
      streaming: false,
    })

    const response: any = await optimiser.invoke([
      new SystemMessage(OPTIMIZED_IMAGE_PROMPT_GENERATOR),
      new HumanMessage(prompt),
    ])
    return response.content as string
  }

  /**
   * Stub for function-calling parity (not yet migrated).
   */
  async callWithFunctions(
    messages: BaseMessage[],
    tools: ChatCompletionTool[],
    options: { temperature?: number; max_tokens?: number } = {}
  ) {
    const specialisedChat = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: this.model,
      temperature: options.temperature ?? this.temperature,
      maxTokens: options.max_tokens ?? this.maxTokens,
    })

    return (specialisedChat as any).invoke(messages, { tools } as any)
  }

  /**
   * Generate a conversational title – simplified version.
   */
  async generateTitle(messages: AssistantResponse[], currentTitle: string): Promise<string> {
    try {
      const prompt = [
        `Analyze the conversation's content. If the discussion still revolves around '${currentTitle}', return this title.`,
        `Otherwise, generate a new short, meaningful title (max 50 chars) based on the updated context.`,
        `Current conversation:`,
        ...messages.map(m => `${m.role}: ${m.content}`),
      ].join('\n')

      const result: any = await this.chat.invoke([
        new SystemMessage(
          'You are a conversation title generator. Create concise, meaningful titles that capture the main topic.'
        ),
        new HumanMessage(prompt),
      ])

      const title = (result.content as string).trim() || 'New Conversation'
      return title.length > 50 ? `${title.substring(0, 47)}...` : title
    } catch (error) {
      console.error('AssistantService.generateTitle error', error)
      return 'New Conversation'
    }
  }

  /**
   * Extract keywords and summary (basic).
   */
  async getKeywordsAndSummary(messages: AssistantResponse[]): Promise<KeywordAnalysis> {
    try {
      const prompt = [
        'Extract the 5-10 most important keywords or key phrases from this conversation.',
        'Focus on technical terms, main topics, and specific concepts discussed.',
        'Avoid generic stopwords and common conversational phrases. Do not include words like "hello," "thank you," or filler words.',
        'Then, generate a concise summary of the conversation, capturing the main points discussed.',
        'Respond in JSON with keys "keywords" and "summary" without extra formatting.',
        'Current conversation:',
        ...messages.map(m => `${m.role}: ${m.content}`),
      ].join('\n')

      const result: any = await this.chat.invoke([
        new SystemMessage('You are a conversation analyzer.'),
        new HumanMessage(prompt),
      ])

      const text = (result.content as string).trim()
      return JSON.parse(text) as KeywordAnalysis
    } catch (error) {
      console.error('AssistantService.getKeywordsAndSummary error', error)
      return { keywords: [], summary: '' }
    }
  }

  /**
   * Generates multiple images using the OpenAI API
   * @param prompt - The prompt to generate images from
   * @param numberGeneratedImages - The number of images to generate
   * @param size - The size of the generated images
   * @param aspectRatio - Aspect ratio of the generated images. Supported values are "1:1", "3:4", "4:3", "9:16", and "16:9".
   * @returns Promise<string[] | Buffer[]> - The URLs of the generated images
   */
  async generateImages(args: {
    prompt: string
    numberGeneratedImages?: number
    size?: ImageGenerateParams['size'] | ImageEditParams['size']
    aspectRatio?: AllowedAspectRatio | (string & {})
    imagesString?: string[]
    imagesBuffer?: Buffer[]
    model?: ChatModel
    templateType?: string
    visualStyle?: string
    contentTheme?: string

    /**
     * If true, the solid background will be removed from the generated images
     */
    solidWhiteBackgroundRemoval?: boolean
  }): Promise<string[] | Buffer[]> {
    const {
      prompt,
      numberGeneratedImages = 1,
      aspectRatio,
      //size,
      imagesString = [],
      imagesBuffer = [],
      templateType,
      visualStyle,
      contentTheme,
      solidWhiteBackgroundRemoval = true,
    } = args

    try {
      // Translate prompt to English before generating images
      const translationService = new TranslationService()
      let translatedPrompt
      try {
        translatedPrompt = await translationService.translateToEnglish(prompt)
      } catch (e) {
        // Do nothing
      }
      const sanitizedAspectRatio = AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS.includes(
        aspectRatio as AllowedAspectRatio
      )
        ? aspectRatio
        : AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS[0]

      // Finalize prompt
      const result = buildImageGenerationPrompt({
        aspectRatio: sanitizedAspectRatio,
        styleName: visualStyle,
        themeName: contentTheme,
        templateName: templateType,
        userPrompt: translatedPrompt || prompt,
      })

      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

      // Prepend explicit user-override and reference handling to reinforce intent
      // Enhanced with hard constraints based on ChatGPT analysis for Gemini Nano Banana
      // Prevents product replacement, pattern outputs, and creative override issues
      const hasRefs = (imagesString && imagesString.length > 0) || (imagesBuffer && imagesBuffer.length > 0)
      const referenceNote = hasRefs
        ? [
            'CRITICAL: Use the reference image as the ONLY product.',
            'Reproduce its exact shape, material, proportions, edges, and surface details without changing or simplifying them.',
            'Do NOT replace it with any other type of item. No redesigning, no guessing, no substituting.',
            'Keep the product design, colors, patterns, and all visual elements identical to the reference.',
            'Only modify the background/scene environment, NOT the product itself.',
            'Allow subtle human interaction ONLY if it does NOT alter the size, angle, or shape of the product.',
          ].join(' ')
        : ''

      const overrideRule = [
        'When the user explicitly specifies style, realism, medium, a conversion (e.g., turn this image into cartoon),',
        'or the target context (e.g., for screen/web), strictly follow the user and override any reference-image or',
        'system guidance. Interpret natural-language intent directly.',
      ].join(' ')

      const overrideLead = ['REFERENCE HANDLING:', referenceNote, 'USER OVERRIDE RULE:', overrideRule, '']
        .filter(Boolean)
        .join('\n')

      const leadAndPrompt = `${overrideLead}${result?.finalPrompt || translatedPrompt}`
      const contents: ContentListUnion = [
        {
          text: leadAndPrompt,
        },
      ]

      // If reference images are provided, use Gemini generateContent with inlineData.
      // Handle buffers first (from base64 data URLs), then URLs
      if (imagesBuffer && imagesBuffer.length > 0) {
        const refs = imagesBuffer.slice(0, AI_IMAGE_EDIT_LIMITS.MAX_INPUT_IMAGES)
        for (const buf of refs) {
          try {
            // Enforce per-image size limit
            if (buf.byteLength > AI_IMAGE_EDIT_LIMITS.MAX_IMAGE_SIZE_BYTES) {
              console.warn('assistant.generateImages: skip reference buffer over size limit', {
                bytes: buf.byteLength,
              })
              throw new Error(
                `The reference image is too large. Only images up to ${AI_IMAGE_EDIT_LIMITS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB are supported.`
              )
            }

            // Canvas exports are always webp
            const mimeType = 'image/webp'

            contents.push({ inlineData: { mimeType, data: buf.toString('base64') } })
          } catch (e) {
            console.warn('generateImages: skip invalid reference buffer', e)
            throw new Error(e instanceof Error ? e.message : 'The reference image is invalid.')
          }
        }
      }

      // Handle URLs (existing behavior)
      if (imagesString && imagesString.length > 0) {
        const refs = imagesString.slice(0, AI_IMAGE_EDIT_LIMITS.MAX_INPUT_IMAGES)
        for (const url of refs) {
          try {
            const buf = await downloadImageFromUrl(url)
            // Enforce per-image size limit
            if (buf.byteLength > AI_IMAGE_EDIT_LIMITS.MAX_IMAGE_SIZE_BYTES) {
              console.warn('assistant.generateImages: skip reference over size limit', {
                url: url.substring(0, 64),
                bytes: buf.byteLength,
              })
              throw new Error(
                `The reference image is too large. Only images up to ${AI_IMAGE_EDIT_LIMITS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB are supported.`
              )
            }
            const lower = url.toLowerCase()
            const mimeType
              = lower.endsWith('.jpg') || lower.endsWith('.jpeg')
                ? 'image/jpeg'
                : lower.endsWith('.webp')
                  ? 'image/webp'
                  : 'image/png'
            if (!AI_IMAGE_EDIT_LIMITS.ALLOWED_MIME_TYPES.includes(mimeType as any)) {
              console.warn('assistant.generateImages: skip reference unsupported mime', { url })
              throw new Error(
                `The reference image is not supported. Only images in ${AI_IMAGE_EDIT_LIMITS.ALLOWED_MIME_TYPES.join(', ')} formats are supported.`
              )
            }
            contents.push({ inlineData: { mimeType, data: buf.toString('base64') } })
          } catch (e) {
            console.warn('generateImages: skip invalid reference', url, e)
            throw new Error(e instanceof Error ? e.message : 'The reference image is invalid.')
          }
        }
      }

      const resp = await withRetry(
        () =>
          ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents,
            config: {
              // @ts-ignore
              imageConfig: {
                ...(sanitizedAspectRatio ? { aspectRatio: sanitizedAspectRatio } : {}),
              },
            },
          }),
        { operationName: 'generateImages' }
      )

      const out: Buffer[] = []
      const parts = resp?.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        const inlineData = (part as any)?.inlineData
        if (!inlineData?.data) continue
        out.push(Buffer.from(inlineData.data, 'base64'))
      }

      if (solidWhiteBackgroundRemoval) {
        // Automatically remove solid-white background with intelligent detection
        // Analyze the final prompt to determine if this is an engraving request
        const engravingAnalysis = isEngravingRequest(result?.finalPrompt || translatedPrompt || prompt)

        for (let i = 0; i < out.length; i++) {
          if (engravingAnalysis.isEngraving && engravingAnalysis.confidence !== 'low') {
            // Use enhanced settings for engraving images with better edge smoothing
            out[i] = await removeSolidBackgrounds(out[i], {
              replaceGlobally: true,
              targetColor: { r: 255, g: 255, b: 255 },
            })
          } else {
            // Keep existing logic for regular images
            out[i] = await removeSolidBackgrounds(out[i], {
              removeEnclosed: true,
              targetColor: [255, 255, 255],
            })
          }
        }
      }

      return out.slice(0, Math.min(numberGeneratedImages, AI_IMAGE_EDIT_LIMITS.MAX_OUTPUT_IMAGES))
    } catch (error) {
      console.error('Error in OpenAI image generation:', error)

      throw error
    }
  }

  /**
   * Generates content using the OpenAI API
   * @param prompt - The prompt to generate content from
   * @returns Promise<string> - The generated content
   */
  async generateContent(prompt: string): Promise<string | null> {
    const response: any = await this.chat.invoke([
      new SystemMessage(this.systemMessage),
      new HumanMessage(`${prompt}\n`),
    ])

    // Only return the first choice
    return response.content as string
  }

  /**
   * Analyzes an image content via Vision API
   * @param url - The URL of the image to analyze
   * @returns Promise<string> - The analyzed content
   */
  async analyzeImageContent(url: string): Promise<string> {
    const visionChat = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini', // Vision capable model
    })

    const response: any = await visionChat.invoke([
      new HumanMessage({
        content: [
          {
            type: 'text',
            text: 'What is in this image? What is the product type, theme, and style if relevant?',
          },
          {
            type: 'image_url',
            image_url: {
              url,
            },
          },
        ],
      }),
    ])

    return (response.content as string) || ''
  }

  /**
   * Analyzes a pre-made prompt
   * @param previewUrls - The preview urls to analyze
   * @returns Promise<string> - The analyzed prompt
   */
  async generatePreMadePrompt(previewUrls: string[]): Promise<string> {
    const visionChat = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
    })

    const imageContent = previewUrls.map(url => ({
      type: 'image_url' as const,
      image_url: {
        url,
      },
    }))

    const response: any = await visionChat.invoke([
      new SystemMessage(this.systemMessage),
      new HumanMessage({
        content: imageContent,
      }),
    ])

    return (response.content as string) || ''
  }

  /**
   * Streams a message response (simplified implementation)
   * @param message - The message to process
   * @param conversationHistory - Previous messages
   * @param onChunk - Callback for each chunk
   */
  async streamMessage(
    message: string | { content: string; role: string },
    conversationHistory: AssistantResponse[] = [],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      const _message = typeof message === 'string' ? { content: message, role: 'user' } : message

      if (!_message.content?.trim()) {
        throw new Error('Message content cannot be empty')
      }

      // Build messages
      const messages: BaseMessage[] = [new SystemMessage(this.systemMessage)]

      conversationHistory.forEach(msg => {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content))
        } else if (msg.role === 'assistant') {
          messages.push(new AIMessage(msg.content))
        }
      })

      messages.push(new HumanMessage(_message.content))

      // For now, get full response and simulate streaming
      const result: any = await this.chat.invoke(messages)
      const content = (result.content as string) || ''

      // Simulate streaming by chunking the response
      const chunkSize = 20
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize)
        onChunk(chunk)
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    } catch (error) {
      console.error('Error in streamMessage:', error)
      throw error
    }
  }

  /**
   * Summarizes a conversation
   * @param messages - The messages to summarize
   * @returns Promise<string> - The summary
   */
  async summarizeConversation(messages: BaseMessage[]): Promise<string> {
    const response: any = await this.chat.invoke(messages)
    return `\n\n${(response.content as string) || ''}`
  }
}
