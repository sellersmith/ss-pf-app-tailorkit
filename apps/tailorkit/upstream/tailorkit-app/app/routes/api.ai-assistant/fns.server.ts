import { ConversationRole } from '~/enums/conversationMessage'
import type { AssistantConfig } from '~/libs/langchain/assistant.service'
import { AssistantService } from '~/libs/langchain/assistant.service'
import Conversation from '~/models/Conversation.server'
import { type ConversationMessageDocument } from '~/models/ConversationMessage'
import ConversationMessage from '~/models/ConversationMessage.server'
import { CREDIT_USAGE, CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT, DEFAULT_CONVERSATION } from './constants'
import type { AIRequestPayload } from './types'
import { DEFAULT_OPENAI_MODEL, SYSTEM_MESSAGE, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from '~/libs/openai/constants'
import { SUGGESTION_PROMPTS } from './constants.sever'
import { ONE_SECOND_IN_MILLISECONDS } from '~/constants'
import { sleep } from '~/utils/sleep'
import { isImageUrl } from '~/utils/file-types'
import { uuid } from '~/utils/uuid'
import type { TFileToUpload } from '~/shopify/graphql/files/types'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import { uploadFiles } from '~/shopify/graphql/files/fns.server'
import Shop from '~/models/Shop.server'
import { increaseAiCreditPerMonth } from '~/models/helpers/ai-credit-helpers.server'

/**
 * Saves messages to a conversation
 * @param args - The arguments for saving messages to a conversation
 * @param args.conversationId - The ID of the conversation
 * @param args.shop - The shop domain
 * @param args.conversationHistory - The conversation history
 * @param args.assistant - The assistant service
 * @param args.userMessage - The user message
 * @param args.assistantMessage - The assistant message
 * @param args.userMessageId - The ID of the user message
 * @param args.assistantMessageId - The ID of the assistant message
 * @param args.classification - The classification of the message
 */
export const saveMessagesToConversation = async (args: {
  conversationId: string
  shop: string
  conversationHistory: any[]
  assistant: AssistantService
  userMessage: string
  assistantMessage: string
  userMessageId: string
  assistantMessageId: string
  metadata?: Record<string, any>
}) => {
  try {
    const {
      conversationId,
      shop,
      userMessage,
      conversationHistory,
      assistantMessage,
      userMessageId,
      assistantMessageId,
      assistant,
      metadata = {},
    } = args

    // Validate required parameters
    if (!conversationId || !shop || !assistant) {
      throw new Error('Missing required parameters: conversationId, shop, or assistant')
    }

    // Validate conversation history structure
    if (!Array.isArray(conversationHistory)) {
      throw new Error('Conversation history must be an array')
    }

    // Validate each message in the history, skipping messages with empty content
    // (tool call messages from OpenAI have null content which is valid for the API but not for storage)
    const _conversationHistory = conversationHistory
      .filter(
        (message: Record<string, unknown>) =>
          message && typeof message === 'object' && message.content && typeof message.content === 'string'
      )
      .map((message: Record<string, unknown>, index: number) => {
        if (!message.role || !['assistant', 'user', 'system'].includes(message.role)) {
          throw new Error(`Invalid message role at index ${index}`)
        }

        if (!message.timestamp || !(message.timestamp instanceof Date)) {
          // Try to parse the timestamp if it's a string
          const timestamp = new Date(message.timestamp)
          if (isNaN(timestamp.getTime())) {
            throw new Error(`Invalid timestamp at index ${index}`)
          }
          message.timestamp = timestamp
        }

        return {
          content: message.content,
          role: message.role,
          timestamp: message.timestamp,
        }
      })

    let conversation = await Conversation.findByIdAndShopDomain(conversationId, shop)

    if (!conversation) {
      conversation = {
        ...DEFAULT_CONVERSATION,
        id: conversationId,
        shopDomain: shop,
      }
    }

    const newConversationHistory = [
      ..._conversationHistory,
      { role: ConversationRole.USER, content: userMessage, timestamp: new Date() },
    ].slice(-5)
    // Generate title for new conversations
    const title = await assistant.generateTitle(newConversationHistory, conversation.title)

    const { keywords, summary } = await assistant.getKeywordsAndSummary(newConversationHistory)

    const newMessages: ConversationMessageDocument[] = [
      {
        id: userMessageId,
        content: userMessage,
        role: ConversationRole.USER,
        conversationId,
        shopDomain: shop,
        timestamp: new Date(),
        lastUpdated: new Date(),
        feedback: null,
        // Persist user attachments/metadata (e.g., selected templates)
        metadata: metadata && metadata.user ? (metadata.user as Record<string, any>) : undefined,
      },
      {
        id: assistantMessageId,
        content: assistantMessage,
        role: ConversationRole.ASSISTANT,
        conversationId,
        shopDomain: shop,
        timestamp: new Date(),
        lastUpdated: new Date(),
        feedback: null,
        metadata,
      },
    ]

    await ConversationMessage.insertMany({
      shopDomain: shop,
      conversationId: conversation.id,
      messages: newMessages,
    })
    const newMessageIds = newMessages.map(message => message.id)
    const existingMessages = conversation.messages.map((message: any) =>
      typeof message === 'string' ? message : message.id
    )
    conversation = {
      ...conversation,
      title,
      metadata: {
        keywords,
        summary,
      },
      messages: [...existingMessages, ...newMessageIds],
    }

    await Conversation.upsert(shop, conversation)
  } catch (error) {
    console.error('Failed to save messages to conversation', error)
    throw error
  }
}

/**
 * Saves a single AI message to the database (useful for welcome messages, auto-generated content, etc.)
 * @param args - The arguments for saving an AI message
 * @param args.conversationId - The ID of the conversation
 * @param args.shop - The shop domain
 * @param args.message - The AI message to save
 * @param args.metadata - Optional metadata for the message
 */
export const saveAiMessageToConversation = async (args: {
  conversationId: string
  shop: string
  message: string
  messageId: string
  metadata?: Record<string, any>
  isNewMessage?: boolean
}) => {
  try {
    const { conversationId, shop, message, messageId, metadata = {}, isNewMessage = true } = args

    // Validate required parameters
    if (!conversationId || !shop || !message || !messageId) {
      throw new Error('Missing required parameters: conversationId, shop, message, or messageId')
    }

    // Check if conversation exists, if not create it
    let conversation = await Conversation.findByIdAndShopDomain(conversationId, shop)

    if (!conversation) {
      conversation = {
        ...DEFAULT_CONVERSATION,
        id: conversationId,
        shopDomain: shop,
        title: 'New Conversation',
        messages: [],
        metadata: {
          keywords: [],
          summary: '',
        },
        lastUpdated: new Date(),
      }
    }

    // Create the AI message
    const aiMessage: ConversationMessageDocument = {
      id: messageId,
      content: message,
      role: ConversationRole.ASSISTANT,
      conversationId,
      shopDomain: shop,
      timestamp: new Date(),
      lastUpdated: new Date(),
      feedback: null,
      metadata,
    }

    // Save the message to database
    await ConversationMessage.insertMany({
      shopDomain: shop,
      conversationId: conversation.id,
      messages: [aiMessage],
    })

    if (isNewMessage) {
      // Update conversation with new message ID
      const existingMessages = conversation.messages.map((message: any) =>
        typeof message === 'string' ? message : message.id
      )

      const updatedConversation = {
        ...conversation,
        messages: [...existingMessages, messageId],
        lastUpdated: new Date(),
      }

      await Conversation.upsert(shop, updatedConversation)
    }
    return aiMessage
  } catch (error) {
    console.error('Failed to save AI message to conversation', error)
    throw error
  }
}

/**
 * Consider the credit usage based on the classification
 * @param classification - The classification of the message
 * @returns The credit usage
 */
export const considerCreditUsage = (classification: 'text' | 'text_generation' | 'image') => {
  if (classification === 'image') {
    return CREDIT_USAGE.IMAGE
  }
  if (classification === 'text_generation') {
    return CREDIT_USAGE.TEXT_GENERATION
  }

  return CREDIT_USAGE.TEXT
}

/**
 * Validates the request payload for the message.
 * @param payload - The payload containing the message and optional suggestion ID.
 * @throws {Error} If both message and suggestionId are missing.
 * @returns {AIRequestPayload} The validated payload.
 */
export function validateMessagePayload(payload: AIRequestPayload) {
  const { message, suggestionId } = payload
  if (!message && !suggestionId) {
    throw new Error('Message is required')
  }
  return payload
}

interface InitializeAssistantArgs extends Omit<AssistantConfig, 'apiKey'> {
  shopId?: string
  suggestionId?: string
  systemMessage?: string
}
/**
 * Initializes the OpenAI assistant with the specified configuration.
 * @param shopId - The ID of the shop for which the assistant is being initialized.
 * @param suggestionId - An optional ID for a suggestion to extend the system message.
 *
 * @returns {AssistantService} An instance of the AssistantService configured for the shop.
 */
export function initializeAssistant(args: InitializeAssistantArgs) {
  const { shopId, suggestionId, model, temperature, maxTokens } = args
  const extraContext = SUGGESTION_PROMPTS.find(prompt => prompt.id === suggestionId)
  const isExtend = extraContext?.type === 'extend'
  const _systemMessage = isExtend ? `${SYSTEM_MESSAGE}\n\n${extraContext?.prompt}` : extraContext?.prompt

  return new AssistantService({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: model || DEFAULT_OPENAI_MODEL,
    temperature: temperature || DEFAULT_TEMPERATURE,
    maxTokens: maxTokens || DEFAULT_MAX_TOKENS,
    systemMessage: _systemMessage,
    ...(shopId
      ? {
          user: shopId,
        }
      : {}),
  })
}

/**
 * Cleans up the conversation message
 * We need to remove the custom markdown format and any URLs in between to avoid AI hallucination
 *
 * @param message - The message to clean up
 * @returns The cleaned up message
 */
export function cleanupConversationMessage(message: string) {
  // Remove the custom markdown format and any URLs in between
  const { GENERATING_IMAGE, GENERATED_IMAGE, IMAGE_GENERATION_START } = CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT
  const pattern = `${[GENERATING_IMAGE, GENERATED_IMAGE, IMAGE_GENERATION_START].join('')}\n`

  const cleanedMessage = message
    // First pattern: Remove the opening markdown with the message
    .replace(new RegExp(`(.+?)${pattern}`, 'g'), '$1')
    // Remove any URLs and empty lines
    .replace(/\s*https:\/\/[^\s]+\n*/g, '')
    // Remove any ~~~ markers (both standalone and with whitespace)
    .replace(/\s*~~~\s*/g, '')
    // Clean up any extra whitespace
    .replace(/\s+/g, ' ')
    .trim()

  return cleanedMessage
}

/**
 * Retries the image generation
 * @param url - The URL of the image
 * @param callback - The callback to generate the image
 * @returns The URL of the image
 */
export const retryImageGeneration = async (url: string, callback: () => Promise<string>) => {
  let imageUrl = url
  // Sometime the image is not available from AI service, so we need to re-generate about 2-3 time
  let count = 0
  const maxRetries = 3
  const retryDelay = ONE_SECOND_IN_MILLISECONDS
  while (count < maxRetries) {
    // Load the image from AI service
    const isImage = await isImageUrl(url)

    if (isImage) {
      break
    }

    // Delay for 1 second
    await sleep(retryDelay)

    count++
    imageUrl = await callback()
  }

  return imageUrl
}

/**
 * Generates an image using the OpenAI API
 * @param args - The arguments for generating an image
 * @param args.assistant - The assistant service
 * @param args.admin - The admin API context
 * @param args.shop - The shop domain
 * @param args.optimizedPrompt - The optimized prompt
 * @returns The URL of the generated image
 */
export const genImage = async (args: {
  assistant: AssistantService
  admin: AdminApiContext
  shop: string
  optimizedPrompt: string
  imagesString?: string[]
}) => {
  const { assistant, admin, shop, optimizedPrompt, imagesString } = args
  try {
    const generatedImages = await assistant.generateImages({
      prompt: optimizedPrompt,
      numberGeneratedImages: 1,
      size: 'auto',
      imagesString,
    })

    let files: TFileToUpload[] | File[] = []
    // Check type of generatedImages
    if (generatedImages.length > 0) {
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

          return new File([image as any], imageName, { type: 'image/png' })
        })
      }
    }

    const api = new ShopifyApiClient(admin)

    const uploadedImages = await uploadFiles({ api, files, shopDomain: shop })

    const imageUrl = uploadedImages.uploadedFiles[0]?.image?.originalSrc || ''

    return imageUrl
  } catch (error) {
    console.error('Error generating image:', error)
    return ''
  }
}

/**
 * Updates the shop AI assistant usage
 *
 * **BLOCKING OPERATION** - Credit consumption is now blocking with retry logic.
 * If credit consumption fails, the entire operation fails (user receives error).
 *
 * @param shop - The shop domain
 * @param creditUsage - The credit usage
 * @throws {Error} If credit consumption fails after retries
 */
export async function updateShopAIAssistantUsage(shop: string, creditUsage: number, allocation = 5000) {
  if (creditUsage <= 0) return

  // CRITICAL: Blocking credit consumption (no .catch())
  // Failures propagate to caller, who should return 402 Payment Required
  await increaseAiCreditPerMonth(shop, creditUsage, 'ai_assistant', undefined, allocation)

  // Non-blocking flag update (fire-and-forget is OK for non-critical flag)
  Shop.updateOne(
    { shopDomain: shop, 'usages.usedAIAssistant': { $ne: true } },
    { 'usages.usedAIAssistant': true }
  ).catch(error => {
    console.error('[AI Assistant] Failed to update usedAIAssistant flag:', error)
  })
}
