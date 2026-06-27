/* eslint-disable max-lines */
/* eslint-disable max-len */
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ChatModel } from 'openai/resources/index.mjs'
import { ConversationRole, MessageClassification } from '~/enums/conversationMessage'
import { getApiLogger } from '~/services/ApiLogger.server'
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_MODEL,
  OPTIMIZED_IMAGE_PROMPT_GENERATOR,
  PRODUCT_CLASSIFICATION_SYSTEM_PROMPT,
  REQUIRED_JSON_RESPONSE_PROMPT,
  SUGGESTED_PRODUCT_TITLE_SYSTEM_PROMPT,
  SYSTEM_MESSAGE,
} from './constants'
import { initializeLoggerWithEnv } from './logger.config.server'
import { DEFAULT_CATEGORIES } from '~/constants/products'
import { withRetry } from '~/utils/retry'

/**
 * Configuration options for the OpenAI Assistant
 */
export interface AssistantConfig {
  apiKey: string
  model?: ChatModel
  temperature?: number
  maxTokens?: number
  systemMessage?: string
  /**
   * A unique identifier representing your end-user, which can help OpenAI to monitor
   * and detect abuse.
   * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#end-user-ids).
   */
  user?: string
  /**
   * Shopify shop domain associated with the current request. Used for usage logging.
   */
  shopDomain?: string
}

/**
 * Response format for the assistant's messages
 */
export interface AssistantResponse {
  content: string
  role: 'assistant' | 'user' | 'system'
  timestamp: Date
}

export interface KeywordAnalysis {
  keywords: string[]
  summary: string
}

/**
 * Product classification result containing product type and catalog
 */
export interface ProductClassification {
  topLevelTag: string
  subLevelTag: string
  reasoning: {
    topLevelReason: string
    subLevelReason: string
  }
}

export interface ProductTitleClassification {
  suggestedTitles: string[]
  reasoning: string
}

/**
 * TailorKit AI Assistant Service
 * Handles communication with OpenAI's API for the TailorKit chatbot
 */
export class AssistantService {
  private openai: OpenAI
  private model: ChatModel
  private temperature: number
  private maxTokens: number
  private systemMessage: ChatCompletionMessageParam
  private user?: string
  private shopDomain?: string
  private logger = getApiLogger()
  /**
   * Creates a new instance of the TailorKit AI Assistant
   * @param config - Configuration options for the assistant
   */
  constructor(config: AssistantConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    })
    this.model = config.model || DEFAULT_OPENAI_MODEL
    this.temperature = config.temperature || 0.7
    this.maxTokens = config.maxTokens || 1000
    this.systemMessage = {
      role: 'system',
      content: config.systemMessage || SYSTEM_MESSAGE,
    }
    this.user = config.user || ''
    this.shopDomain = config.shopDomain

    // Initialize logger if not already initialized
    if (!this.logger) {
      initializeLoggerWithEnv(this.shopDomain)
      this.logger = getApiLogger()
    }
  }

  /**
   * Sends a message to the OpenAI API and returns the response
   * @param message - The user's message
   * @param conversationHistory - Previous messages in the conversation
   * @returns Promise<AssistantResponse>
   */
  async sendMessage(message: string, conversationHistory: AssistantResponse[] = []): Promise<AssistantResponse> {
    let requestId = ''

    try {
      // Start logging
      if (this.logger) {
        requestId = await this.logger.startLog({
          requestMethod: 'sendMessage',
          model: this.model,
          apiEndpoint: 'chat/completions',
          userId: this.user,
          shopDomain: this.shopDomain,
          requestPayload: { message, conversationHistoryLength: conversationHistory.length },
        })
      }

      // Convert conversation history to OpenAI message format
      const messages: ChatCompletionMessageParam[] = [
        this.systemMessage,
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user', content: message },
      ]

      // Send request to OpenAI
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        stream: false,
        ...(this.user ? { user: this.user } : {}),
      })

      // Extract and format the response
      const responseContent = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      // Complete logging
      if (this.logger && requestId) {
        await this.logger.completeLog({
          requestId,
          responseStatus: 200,
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          status: 'success',
        })
      }

      return {
        content: responseContent,
        role: 'assistant',
        timestamp: new Date(),
      }
    } catch (error) {
      console.error('Error in OpenAI request:', error)

      // Log error
      if (this.logger && requestId) {
        await this.logger.logError({
          requestId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          responseStatus: 500,
        })
      }

      throw new Error('Failed to get response from AI assistant')
    }
  }

  /**
   * Sends a message to the OpenAI API and streams the response
   * @param message - The user's message
   * @param conversationHistory - Previous messages in the conversation
   * @param onChunk - Callback function to handle each chunk of the streamed response
   */
  async streamMessage(
    message:
      | {
          content: string
          role: ConversationRole
        }
      | string,
    conversationHistory: AssistantResponse[] = [],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    let requestId = ''
    let totalContent = ''
    let promptTokens = 0
    let completionTokens = 0

    try {
      // Convert message to OpenAI message format
      const _message = typeof message === 'string' ? { content: message, role: ConversationRole.USER } : message

      // Validate message content
      if (!_message.content?.trim()) {
        throw new Error('Message content cannot be empty')
      }

      // Start logging
      if (this.logger) {
        requestId = await this.logger.startLog({
          requestMethod: 'streamMessage',
          model: this.model,
          apiEndpoint: 'chat/completions',
          userId: this.user,
          shopDomain: this.shopDomain,
          requestPayload: { message: _message.content, conversationHistoryLength: conversationHistory.length },
        })
      }

      // Convert conversation history to OpenAI message format
      const messages: ChatCompletionMessageParam[] = [
        this.systemMessage,
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        _message,
      ]

      // Send streaming request to OpenAI
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        ...(this.user ? { user: this.user } : {}),
        stream: true,
      })

      // Process the stream with enhanced error handling
      for await (const chunk of stream) {
        if (!chunk.choices?.[0]) {
          console.warn('Received malformed chunk from OpenAI API')
          continue
        }

        const content = chunk.choices[0].delta?.content
        if (content !== undefined && content !== null) {
          totalContent += content
          onChunk(content)
        }

        // Extract usage information if available (final chunk)
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens || 0
          completionTokens = chunk.usage.completion_tokens || 0
        }
      }

      // Complete logging for streaming
      if (this.logger && requestId) {
        // For streaming, we need to estimate token usage if not provided
        const estimatedPromptTokens = promptTokens || Math.ceil(_message.content.length / 4)
        const estimatedCompletionTokens = completionTokens || Math.ceil(totalContent.length / 4)

        await this.logger.completeLog({
          requestId,
          responseStatus: 200,
          promptTokens: estimatedPromptTokens,
          completionTokens: estimatedCompletionTokens,
          status: 'success',
          metadata: { streaming: true, estimatedTokens: !promptTokens },
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error in OpenAI streaming request:', errorMessage)

      // Log error
      if (this.logger && requestId) {
        await this.logger.logError({
          requestId,
          errorMessage,
          responseStatus: 500,
        })
      }

      throw new Error(`Failed to stream response from AI assistant: ${errorMessage}`)
    }
  }

  /**
   * Generates a meaningful title for the conversation based on messages
   */
  async generateTitle(messages: AssistantResponse[], currentTitle: string): Promise<string> {
    try {
      const prompt = [
        `Analyze the conversation's content. If the discussion still revolves around '${currentTitle}', return this title.`,
        `Otherwise, generate a new short, meaningful title (max 50 chars) based on the updated context.`,
        `Current conversation:`,
        ...messages.map(m => `${m.role}: ${m.content}`),
      ].join('\n')

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a conversation title generator. Create concise, meaningful titles that capture the main topic.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 200,
        ...(this.user ? { user: this.user } : {}),
      })

      const title = response.choices[0]?.message?.content?.trim() || 'New Conversation'
      return title.length > 50 ? `${title.substring(0, 47)}...` : title
    } catch (error) {
      console.error('Error generating title:', error)
      return 'New Conversation'
    }
  }

  /**
   * Extracts meaningful keywords and generates summary from the conversation
   */
  async getKeywordsAndSummary(messages: AssistantResponse[]): Promise<KeywordAnalysis> {
    try {
      const prompt = [
        'Extract the 5-10 most important keywords or key phrases from this conversation.',
        'Focus on technical terms, main topics, and specific concepts discussed.',
        'Avoid generic stopwords and common conversational phrases. Do not include words like "hello," "thank you," or filler words.',
        'Then, generate a concise summary of the conversation, capturing the main points discussed.',
        `${REQUIRED_JSON_RESPONSE_PROMPT}, like this:`,
        '{',
        '  "keywords": ["keyword1", "keyword2", "keyword3"],',
        '  "summary": "A brief summary of the conversation."',
        '}',
        'Current conversation:',
        ...messages.map(m => `${m.role}: ${m.content}`),
      ].join('\n')

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a conversation analyzer. Extract keywords and generate summaries in JSON format.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        ...(this.user ? { user: this.user } : {}),
      })

      const analysisText = response.choices[0]?.message?.content?.trim() || ''
      try {
        const analysis = JSON.parse(analysisText) as KeywordAnalysis

        return analysis
      } catch (parseError) {
        console.error('Error parsing keywords response:', parseError)
        return { keywords: [], summary: '' }
      }
    } catch (error) {
      console.error('Error generating keywords:', error)
      return { keywords: [], summary: '' }
    }
  }

  /**
   * Classifies a prompt as either "image" or "text"
   * @param prompt - The prompt to classify
   * @returns Promise<string> - The classification result
   */
  async classifyPrompt(prompt: string): Promise<MessageClassification> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
        // Only AI can classify the prompt
        { role: 'assistant', content: prompt },
      ],
      temperature: 0.2,
      ...(this.user ? { user: this.user } : {}),
      max_tokens: 1,
    })

    const choice = response.choices[0]

    // If no choice is returned, return 'text'
    if (!choice) {
      return MessageClassification.TEXT
    }

    const classification = choice.message.content?.trim()?.toLowerCase()
    // Return either "image" or "text"
    return classification === 'image' ? MessageClassification.IMAGE : MessageClassification.TEXT
  }

  /**
   * Analyzes a conversation and returns a structured response
   * @param conversationHistory - The conversation history
   * @returns Promise<T> - The structured response
   */
  async analyzeConversation<T>(prompt: string, conversationHistory: AssistantResponse[]): Promise<T> {
    const _prompt = [prompt, `Current conversation:`, ...conversationHistory.map(m => `${m.role}: ${m.content}`)].join(
      '\n'
    )

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: [
            'You are a conversation analyzer. Analyze the conversation and return a structured response in JSON format.',
            REQUIRED_JSON_RESPONSE_PROMPT,
          ].join('\n'),
        },
        { role: 'user', content: _prompt },
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: false,
    })

    const analysisConversation = response.choices[0]?.message?.content || ''
    try {
      return JSON.parse(analysisConversation) as T
    } catch (error) {
      console.error('Error parsing conversation analysis response:', error)
      return {} as T
    }
  }

  /**
   * Optimizes an image prompt
   * @param prompt - The prompt to optimize
   * @returns Promise<string> - The optimized prompt
   */
  async optimizeImagePrompt(prompt: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: OPTIMIZED_IMAGE_PROMPT_GENERATOR },
        { role: 'user', content: prompt },
      ],
      temperature: 1,
      max_tokens: DEFAULT_MAX_TOKENS,
      ...(this.user ? { user: this.user } : {}),
    })

    return response.choices[0]?.message?.content || ''
  }

  /**
   * Generates content using the OpenAI API
   * @param prompt - The prompt to generate content from
   * @returns Promise<string> - The generated content
   */
  async generateContent(prompt: string): Promise<string | null> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        this.systemMessage,
        {
          role: 'user',
          content: `${prompt}\n`,
        },
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: false,
    })

    // Only return the first choice
    return response.choices[0]?.message?.content
  }

  /**
   * Analyzes an image content via Vision API
   * @param url - The URL of the image to analyze
   * @returns Promise<string> - The analyzed content
   */
  async analyzeImageContent(url: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
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
        },
      ],
    })

    return response?.choices?.[0]?.message?.content || ''
  }

  /**
   * Analyzes a pre-made prompt
   * @param previewUrls - The preview urls to analyze
   * @returns Promise<string> - The analyzed prompt
   */
  async generatePreMadePrompt(previewUrls: string[]): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        this.systemMessage,
        {
          role: 'user',
          content: [
            ...previewUrls.map(url => ({
              type: 'image_url' as const,
              image_url: {
                url,
              },
            })),
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content || ''
  }

  /**
   * Generates multiple images using the OpenAI API
   * @param prompt - The prompt to generate images from
   * @param numberGeneratedImages - The number of images to generate
   * @param size - The size of the generated images
   * @returns Promise<string[] | Buffer[]> - The URLs of the generated images
   */
  async generateImages(args: {
    prompt: string
    numberGeneratedImages?: number
    aspectRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '9:16'
    imagesString?: string[]
    model?: ChatModel
  }): Promise<string[] | Buffer[]> {
    const {
      prompt,
      numberGeneratedImages = 4,
      aspectRatio = '1:1',
      imagesString = [],
      model = DEFAULT_OPENAI_IMAGE_MODEL,
    } = args

    let requestId = ''

    try {
      // Start logging
      if (this.logger) {
        requestId = await this.logger.startLog({
          requestMethod: 'generateImages',
          model,
          apiEndpoint: imagesString.length ? 'images/edits' : 'images/generations',
          userId: this.user,
          shopDomain: this.shopDomain,
          requestPayload: { prompt, numberGeneratedImages, aspectRatio, hasBaseImages: imagesString.length > 0 },
        })
      }

      const options = {
        prompt,
        n: numberGeneratedImages,
        aspectRatio,
        model,
        ...(this.user ? { user: this.user } : {}),
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

      const _model = 'imagen-3.0-generate-002'

      const _prompt = `${prompt}
        Unless specifically mentioned, generate images that follow these guidelines:
          - **Overall:** Original and high-quality.
          - **Background:** Solid white or transparent.
          - **Foreground:** Use suitable colors (excluding white tones and colors used for checkerboard patterns).
          - **Style:** Flat design without highlights and shadows, vector (scalable to 5000x5000 pixels without quality loss).`

      const response = await withRetry(
        () =>
          ai.models.generateImages({
            model: _model,
            prompt: _prompt,
            config: {
              aspectRatio,
              numberOfImages: numberGeneratedImages,
            },
          }),
        { operationName: 'generateImages' }
      )

      const images_bytes = []

      for (const generatedImage of response.generatedImages || []) {
        const imgBytes = generatedImage.image?.imageBytes
        if (!imgBytes) {
          console.warn('No image bytes found in generated image')
          continue
        }

        const buffer = Buffer.from(imgBytes, 'base64')
        images_bytes.push(buffer)
      }

      // Complete logging
      if (this.logger && requestId) {
        await this.logger.completeLog({
          requestId,
          responseStatus: 200,
          imagesGenerated: numberGeneratedImages,
          aspectRatio,
          metadata: {
            options,
          },
          status: 'success',
        })
      }

      return images_bytes
    } catch (error) {
      console.error('Error in OpenAI image generation:', error)

      // Log error
      if (this.logger && requestId) {
        await this.logger.logError({
          requestId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          responseStatus: 500,
        })
      }

      throw error
    }
  }

  async callWithFunctions(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    options: { temperature?: number; max_tokens?: number } = {}
  ) {
    return this.openai.chat.completions.create({
      model: this.model,
      messages: [this.systemMessage, ...messages],
      tools,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.max_tokens ?? this.maxTokens,
      ...(this.user ? { user: this.user } : {}),
    })
  }

  async summarizeConversation(messages: ChatCompletionMessageParam[]): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages,
    })

    return `\n\n${response.choices[0]?.message?.content || ''}`
  }

  /**
   * Extracts both product type and catalog from a product title or prompt
   * @param input - The product title or prompt to analyze
   * @returns Promise<ProductClassification> - Object containing productType and catalog
   */
  async extractProductClassification(input: string): Promise<ProductClassification> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model, // Using consistent model from constants
        messages: [
          {
            role: 'system',
            content: PRODUCT_CLASSIFICATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: input, // Pass the full formatted input with categories
          },
        ],
        temperature: 0.1, // Low temperature for consistent classification
        max_tokens: this.maxTokens || 2000, // Sufficient for JSON response
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'product_classification',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                topLevelTag: {
                  type: 'string',
                  description: 'The main category from the provided list (must match exactly)',
                },
                subLevelTag: {
                  type: 'string',
                  description: 'A specific sub-category that belongs to the chosen top level tag (must match exactly)',
                },
                reasoning: {
                  type: 'object',
                  description: 'Explanation for the classification choices',
                  properties: {
                    topLevelReason: {
                      type: 'string',
                      description: 'Explanation for why this top level tag was chosen',
                    },
                    subLevelReason: {
                      type: 'string',
                      description: 'Explanation for why this sub level tag was chosen',
                    },
                  },
                  required: ['topLevelReason', 'subLevelReason'],
                  additionalProperties: false,
                },
              },
              required: ['topLevelTag', 'subLevelTag', 'reasoning'],
              additionalProperties: false,
            },
          },
        }, // Ensures valid JSON output with strict schema validation
      })

      const content = response.choices[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('No response content received')
      }

      // Parse JSON response
      const classification: ProductClassification = JSON.parse(content)

      // Clean and normalize the values
      return {
        topLevelTag: classification.topLevelTag.trim(),
        subLevelTag: classification.subLevelTag.trim(),
        reasoning: {
          topLevelReason: classification?.reasoning?.topLevelReason?.trim(),
          subLevelReason: classification?.reasoning?.subLevelReason?.trim(),
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Error in extractProductClassification:', errorMessage)

      // Log error if logger is available
      if (this.logger) {
        await this.logger.logError({
          requestId: `product-classification-${Date.now()}`,
          errorMessage: `Product classification failed: ${errorMessage}`,
          responseStatus: 500,
        })
      }

      // Fallback classification with default values
      return {
        topLevelTag: '', // Default to most common category
        subLevelTag: '', // Empty string as required
        reasoning: {
          topLevelReason: 'Fallback classification: Using empty string as required',
          subLevelReason: 'Fallback classification: Using empty string as required',
        },
      }
    }
  }

  /**
   * Extracts both product type and catalog from a product title or prompt
   * @param input - The product title or prompt to analyze
   * @returns Promise<ProductClassification> - Object containing productType and catalog
   */
  async extractProductTitleClassification(input: string): Promise<ProductTitleClassification> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: SUGGESTED_PRODUCT_TITLE_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: input,
          },
        ],
        temperature: 0.3, // Slightly higher for more diverse suggestions
        max_tokens: this.maxTokens || 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'product_title_classification',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                suggestedTitles: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  minItems: 0,
                  maxItems: 5,
                  description: 'Array of 3-5 relevant product types, ordered by relevance',
                },
                reasoning: {
                  type: 'string',
                  description: 'Explanation for the suggested titles',
                },
              },
              required: ['suggestedTitles', 'reasoning'],
              additionalProperties: false,
            },
          },
        },
      })

      const content = response.choices[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('No response content received')
      }

      // Parse JSON response
      const classification: ProductTitleClassification = JSON.parse(content)

      // Clean and normalize the values
      return {
        suggestedTitles: classification.suggestedTitles.map(title => title.trim()),
        reasoning: classification.reasoning.trim(),
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Error in extractProductTitleClassification:', errorMessage)

      // Log error if logger is available
      if (this.logger) {
        await this.logger.logError({
          requestId: `product-title-classification-${Date.now()}`,
          errorMessage: `Product title classification failed: ${errorMessage}`,
          responseStatus: 500,
        })
      }

      // Fallback classification with empty array
      return {
        suggestedTitles: [],
        reasoning: 'Fallback classification: Empty array as required for product title classification',
      }
    }
  }

  /**
   * Calculate personalization compatibility score using AI analysis
   * @param categories - Product categories extracted from shop analysis
   * @param description - Shop description
   * @param topSellingProductTitle - Top selling product title
   * @returns Promise<number> - Score from 0.0 to 1.0 indicating personalization suitability
   */
  async calculatePersonalizationCompatibilityScore(
    categories: string[],
    description: string,
    topSellingProductTitle: string
  ): Promise<number> {
    const scoringPrompt = `You must analyze this shop information and return a JSON object with a personalization compatibility score.

**Shop Description:** "${description}"
**Top Selling Product:** "${topSellingProductTitle}"
**Product Categories:** ${categories.join(', ')}

TASK: Evaluate how suitable this business is for personalization/customization services on a scale of 0.0 to 1.0.

REQUIRED JSON FORMAT:
{
  "personalizationScore": 0.85,
  "reasoning": "Brief explanation of the score"
}

**SCORING GUIDELINES:**
- HIGHEST SCORE (0.85-1.0): Premium personalization verticals
  * Jewelry, custom jewelry, engraved jewelry, personalized necklaces/bracelets/rings
  * Leather goods, wallets, belts, leather accessories
  * Items with engraving, monogramming, or bespoke craftsmanship

- HIGH SCORE (0.7-0.85): Strong personalization products
  * Home decor, wall art, posters, pillows, custom canvases
  * Phone cases, mugs, drinkware with custom designs
  * Pet accessories, personalized gifts, keepsakes

- MEDIUM SCORE (0.4-0.7): Moderate personalization potential
  * Apparel, clothing, t-shirts, hoodies (generic/mass-market)
  * Print-on-demand (POD), custom-printing services
  * Electronics with customizable cases/covers
  * Baby/kids items, toys, sports equipment
  * Kitchen items, automotive accessories

- LOW SCORE (0.0-0.3): Products rarely personalized
  * Food, groceries, consumables
  * Digital products, software, services
  * Medical, financial, insurance services
  * Books, pure service businesses

**POD DE-PRIORITIZATION:**
- Stores primarily offering print-on-demand, bulk custom-printing, or mass-produced apparel should score 0.4-0.6
- POD keywords: print-on-demand, pod, dtg, screen-printing, sublimation, dropship apparel
- Exception: POD stores with unique/artisan designs may score up to 0.7

**ADDITIONAL FACTORS:**
- Look for keywords: custom, personalize, design, engrave, print, monogram, bespoke, tailor, handmade, artisan
- Consider if customers typically want unique/personal versions of these products
- Think about whether the products can physically accommodate personalization
- **Growth store signals** (boost score by 0.05-0.1 when present):
  * Established brand with proven order history
  * Evidence of repeat customers or loyal customer base
  * Professional store presence suggesting maturity
  * Multiple product lines indicating business growth
- **Historical traction**: Stores with track record of sales and engagement score higher than new/unproven stores

**EXAMPLES:**
"Personalized jewelry store" -> {"personalizationScore": 0.95, "reasoning": "Jewelry is a top-tier personalization vertical with engraving and custom design"}
"Custom leather wallet shop" -> {"personalizationScore": 0.90, "reasoning": "Leather goods are premium personalization products with monogramming and embossing"}
"Custom t-shirt printing" -> {"personalizationScore": 0.55, "reasoning": "T-shirt printing is mass-market POD with moderate personalization value"}
"Print-on-demand apparel store" -> {"personalizationScore": 0.45, "reasoning": "Generic POD apparel has limited differentiation in personalization"}
"Grocery delivery service" -> {"personalizationScore": 0.1, "reasoning": "Food delivery has minimal personalization opportunities"}

You MUST return valid JSON only.`

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: scoringPrompt }],
        temperature: this.temperature,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content?.trim() || '{}'
      const scoringResult = JSON.parse(content)

      // Validate and extract score
      let score = scoringResult.personalizationScore || 0.3

      // Ensure score is within valid range
      score = Math.max(0.0, Math.min(1.0, score))

      // Round to 2 decimal places
      return Math.round(score * 100) / 100
    } catch (error) {
      console.error('Error calculating personalization compatibility score:', error)

      // Log error if logger is available
      if (this.logger) {
        await this.logger.logError({
          requestId: `personalization-score-${Date.now()}`,
          errorMessage: `Personalization score calculation failed: ${error instanceof Error ? error.message : String(error)}`,
          responseStatus: 500,
        })
      }

      // Return default medium score on error
      return 0.5
    }
  }

  /**
   * Analyze shop description to extract relevant product categories and calculate personalization compatibility
   * @param description - The shop description from Shopify
   * @param topSellingProductTitle - The top selling product title from Shopify
   * @returns Promise<{categories: string[], description: string, personalizationCompatibilityScore: number}> - Extracted categories, cleaned description, and personalization score
   */
  async analyzeShopDescription(
    description: string,
    topSellingProductTitle: string
  ): Promise<{ categories: string[]; description: string; personalizationCompatibilityScore: number }> {
    const analysisPrompt = `You must analyze this shop description and top selling product title and return a JSON object with product categories.

**Shop Description:** "${description}"
**Top Selling Product Information:** "${topSellingProductTitle}"

TASK: Extract 2-5 most relevant product categories suitable for personalization/customization.

**REQUIRED JSON FORMAT**:
{
  "categories": ["category1", "category2", "category3"],
  "confidence": 0.8
}

**RULES:**
- Extract any relevant product categories that would be suitable for customization/personalization
- Return 2-5 categories ordered by relevance (most relevant first)
- Use semantic and descriptive category names with lowercase and hyphens (e.g., "apparel", "phone-accessories", "home-decor", "drinkware", "jewelry")
- Set confidence: 0.9+ (very clear), 0.5-0.8 (moderate clarity), 0.3-0.4 (unclear)
- You MUST return valid JSON only
`

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: this.temperature,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content?.trim() || '{}'

      // Parse the JSON response (guaranteed to be valid JSON with response_format)
      const analysisResult = JSON.parse(content)

      // Get categories directly from AI response (no filtering here)
      const extractedCategories = (analysisResult.categories || [])
        .filter((cat: string) => cat && typeof cat === 'string' && cat.trim().length > 0)
        .slice(0, 5) // Limit to 5 categories max

      // Only fallback if no categories at all were extracted
      if (extractedCategories.length === 0) {
        return {
          categories: DEFAULT_CATEGORIES,
          description: description.trim(),
          personalizationCompatibilityScore: 0.5,
        }
      }

      // Calculate personalization compatibility score with extracted categories
      const personalizationScore = await this.calculatePersonalizationCompatibilityScore(
        extractedCategories,
        description,
        topSellingProductTitle
      )

      return {
        categories: extractedCategories,
        description: description.trim(),
        personalizationCompatibilityScore: personalizationScore,
      }
    } catch (error) {
      console.error('Error analyzing shop description:', error)
      // Return default categories on error
      return {
        categories: DEFAULT_CATEGORIES,
        description: description.trim(),
        personalizationCompatibilityScore: 0.5,
      }
    }
  }
}
