/* eslint-disable max-len */
import OpenAI from 'openai'
import { DEFAULT_OPENAI_MODEL } from '~/libs/openai/constants'
import { getApiLogger } from '~/services/ApiLogger.server'
import { initializeLoggerWithEnv } from '~/libs/openai/logger.config.server'
import supabaseClient from './supabase-client.server'

// Initialize OpenAI with new SDK
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const needHumanSupportRuleForCrisp = `[HUMAN SUPPORT NEEDED] + a polite message letting them know a human will be with them shortly`
const needHumanSupportRuleForAppAssistant = `[HUMAN SUPPORT NEEDED] + politely direct them to close the current chat and open Crisp chat to connect with support team.`

// Define the context for the OpenAI client
export const context = (
  isCrisp: boolean
) => `You are the AI support assistant for TailorKit, a Shopify product personalizer. Your name is ${process.env.CRISP_OPERATOR_NICKNAME || 'Elva'}. Reply in the user's language and tone (1-3 sentences unless giving steps). Use emojis appropriately and refer to the user by first name if detected.

## TailorKit Product Knowledge

Core workflow: Install app → Create Template → Integrate with Product → Publish → Receive Orders → Fulfill
Pricing: Starter $19/mo (50 free orders/mo, $0.50/extra), Growth $49/mo (500 free orders/mo, $0.10/extra), 14-day free trial on both plans. // NOTE: Update pricing values here when plans change
Key features: text customization, image personalization, AI design tools, live preview, multi-view mockups, SVG/PNG export (high-res PNG on Growth plan only).
App block setup: OS 2.0 themes (e.g. Dawn) support native app blocks added via Shopify theme editor. OS 1.0 themes require manual liquid code injection into product page template.

## Diagnostic Troubleshooting Chains

Use these when a merchant reports an issue. Ask the relevant diagnostic question rather than escalating immediately.

**Product not showing customizer on storefront:**
- Is the product published and visible in the Shopify store?
- Is a TailorKit template linked to this product (via Integrations)?
- Has the TailorKit app block been added to the product page in the theme editor?
- Is the theme OS 2.0 (supports native app blocks) or OS 1.0 (needs manual code)?

**Preview / live preview not rendering correctly:**
- Which element types are affected (text, image, shape)?
- Is a base/background image set for the print area?
- What is the layer order — is the element hidden behind another layer?
- What font color is set — could it match the background?

**Template not displaying correctly or elements missing:**
- What element types are in the template (text, image, clipart)?
- Was the template created from a PSD upload? Any errors during upload?
- Have any layer transforms (resize, rotate) been applied recently?

**App block not appearing in theme editor:**
- Which Shopify theme and version is the merchant using?
- Is the TailorKit app listed under "App embeds" in the theme editor?
- For OS 1.0 themes: has the snippet code been added to the product-template.liquid file?

**Order or print file issues:**
- Can the merchant see the order in the TailorKit Orders tab?
- Is the print file showing the correct customized design?
- Was the product published with a template that has all required elements?
- For fulfillment providers: is the provider connection active and synced?

## Rules

1. If casual (e.g., "hi", "thanks"), greet warmly.
2. If replying to your insight question, thank them and note it'll be shared with the dev team.
3. If it's a question you can answer from your knowledge or context, give clear, concise steps.
4. If user gave feedback after testing, thank them and note it'll be shared with the dev team for improvement.
5. If you are unsure what the user means, or the question is vague/unclear, ask a clarifying question to understand their intent. You may ask up to 3 clarifying questions maximum across the conversation — after 3 questions, you must either resolve or escalate.
6. If a user reports an issue or says they can't see/find/understand something, ask targeted diagnostic questions from the relevant troubleshooting chain above. Ask up to 3 clarifying/diagnostic questions across the conversation before escalating — do NOT escalate before asking at least one question.
7. If the user explicitly asks for a human agent (e.g., "talk to a person", "human please", "real person"), escalate immediately with ${isCrisp ? needHumanSupportRuleForCrisp : needHumanSupportRuleForAppAssistant}. Do not try to help first.
8. Only use ${isCrisp ? needHumanSupportRuleForCrisp : needHumanSupportRuleForAppAssistant} after you have asked up to 3 clarifying or diagnostic questions and the issue still cannot be resolved.
9. If the question is not about TailorKit (e.g., general Shopify questions, unrelated topics), politely redirect: you specialize in TailorKit product personalization and can best help with that.

## Always

- Mention your name and that you're the TailorKit AI assistant in your first reply only.
- Format your response using Crisp Messages format.
- Never mention docs (TailorKit is docless).
- Avoid repeating greetings already sent.
- Use documentation context when available, but always try to help even when context is thin — use your product knowledge above.
- If you cannot resolve from context or knowledge, ask a targeted clarifying or diagnostic question first (up to 3 before escalating).
- If resolved, end with a thoughtful insight-gathering question about their experience.`

// Function to generate embeddings
export async function generateEmbedding(text: string, shopDomain?: string, userId?: string) {
  let requestId = ''
  let logger = getApiLogger()

  // Initialize logger if not already initialized
  if (!logger && shopDomain) {
    initializeLoggerWithEnv(shopDomain)
    logger = getApiLogger()
  }

  try {
    // Start logging
    if (logger) {
      requestId = await logger.startLog({
        requestMethod: 'generateEmbedding',
        model: 'text-embedding-3-small',
        apiEndpoint: 'embeddings',
        userId: userId || '',
        shopDomain: shopDomain,
        requestPayload: {
          textLength: text.length,
          textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        },
      })
    }

    const response = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      ...(userId ? { user: userId } : {}),
    })

    const usage = response.usage

    // Complete logging
    if (logger && requestId) {
      await logger.completeLog({
        requestId,
        responseStatus: 200,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: 0, // Embeddings don't have completion tokens
        status: 'success',
        metadata: {
          embeddingDimensions: response.data[0].embedding.length,
        },
      })
    }

    return response.data[0].embedding
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error generating embedding with OpenAI:', errorMessage)

    // Log error
    if (logger && requestId) {
      await logger.logError({
        requestId,
        errorMessage,
        responseStatus: 500,
      })
    }

    throw error
  }
}

// Function to generate AI responses
export async function generateAIResponse(args: {
  systemPrompt?: string
  userQuery: string
  documentContext: string
  conversationHistory: any[]
  nickname?: string
  isCrisp?: boolean
  shopDomain?: string
  userId?: string
}) {
  const {
    systemPrompt,
    userQuery,
    documentContext,
    conversationHistory = [],
    nickname,
    isCrisp = false,
    shopDomain,
    userId,
  } = args
  let requestId = ''
  let logger = getApiLogger()

  // Initialize logger if not already initialized
  if (!logger && shopDomain) {
    initializeLoggerWithEnv(shopDomain)
    logger = getApiLogger()
  }

  try {
    // Start logging
    if (logger) {
      requestId = await logger.startLog({
        requestMethod: 'generateAIResponse',
        model: DEFAULT_OPENAI_MODEL,
        apiEndpoint: 'chat/completions',
        userId: userId || '',
        shopDomain: shopDomain,
        requestPayload: {
          userQuery: userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''), // Truncate for logging
          conversationHistoryLength: conversationHistory.length,
          hasDocumentContext: !!documentContext,
          isCrisp,
          hasNickname: !!nickname,
        },
      })
    }

    // Prepare messages array with conversation history
    const messages = [
      {
        role: 'system',
        content: systemPrompt || context(isCrisp),
      },
    ]

    if (nickname) {
      messages.push({ role: 'system', content: `User's nickname: ${nickname}.` })
    }

    // Add limited conversation history
    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory)
    }

    // Add current query and context
    messages.push({
      role: 'user',
      content: userQuery,
    })

    messages.push({
      role: 'system',
      content: `Relevant documentation:\n\n${documentContext}`,
    })

    const response = await openaiClient.chat.completions.create({
      // @ts-ignore
      messages,
      max_tokens: 500,
      temperature: 0.5,
      model: DEFAULT_OPENAI_MODEL,
      ...(userId ? { user: userId } : {}),
    })

    const responseContent = response.choices[0].message.content
    const usage = response.usage

    // Complete logging
    if (logger && requestId) {
      await logger.completeLog({
        requestId,
        responseStatus: 200,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        status: 'success',
        metadata: {
          responseLength: responseContent?.length || 0,
          messagesCount: messages.length,
        },
      })
    }

    return responseContent
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error generating welcome response with OpenAI:', errorMessage)

    // Log error
    if (logger && requestId) {
      await logger.logError({
        requestId,
        errorMessage,
        responseStatus: 500,
      })
    }

    // Fallback to templated response if OpenAI fails
    return fallbackWelcomeResponse(userQuery)
  }
}

// Fallback welcome response generator
function fallbackWelcomeResponse(message: string) {
  const lowerMessage = message.toLowerCase()

  // Check what type of greeting it is and respond accordingly
  if (
    lowerMessage.includes('hello')
    || lowerMessage.includes('hi')
    || lowerMessage.includes('hey')
    || lowerMessage.includes('greetings')
  ) {
    return "Hello there! 👋 Welcome to TailorKit support. I'm your AI assistant and I'm here to help with technical questions about TailorKit. Could you please tell me what you need help with regarding templates, product integration, Printify importing, or any other TailorKit features?"
  }

  if (lowerMessage.includes('help') || lowerMessage.includes('support') || lowerMessage.includes('question')) {
    return "I'd be happy to help you with TailorKit! 😊 To provide the best assistance, could you please share more details about what you're trying to do or what specific feature you need help with? For example, are you creating templates, working with product integrations, or setting up your store?"
  }

  if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
    return "You're welcome! 😊 I'm here to help with any technical questions about TailorKit. Is there something specific I can assist you with today?"
  }

  return "Thanks for reaching out to TailorKit support! 👋 I'm your AI assistant and I can help with technical questions about creating templates, product integration, importing from Printify, and more. Could you please share more details about what you need help with today?"
}

type FunctionName = 'match_documents' | 'match_clipart_documents'
/**
 * Find relevant documentation in the vector database
 * @param functionName - The name of the function to use
 * @param query - The query to search for
 * @param shop - The shop domain
 * @param shopData - The shop data
 * @param options - The options for the search
 * @param options.matchThreshold - The threshold for the search
 * @param options.matchCount - The number of documents to return
 */
export async function findRelevantDocumentation(
  functionName: FunctionName = 'match_documents',
  query: string,
  shop?: string,
  shopData?: any,
  options?: {
    match_threshold?: number
    match_count?: number
  }
) {
  // Generate embedding for the message
  const embedding = await generateEmbedding(query, shop, shopData._id)

  // Search for relevant documentation in vector database
  const { data: documents, error: searchError } = await supabaseClient.rpc(functionName, {
    query_embedding: embedding,
    ...(options || {
      match_threshold: 0.2,
      match_count: 5,
    }),
  })

  return {
    documents,
    searchError,
  }
}

export default openaiClient
