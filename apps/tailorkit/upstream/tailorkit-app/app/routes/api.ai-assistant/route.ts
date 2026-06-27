import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import type { AssistantResponse } from '~/libs/langchain/assistant.service'
import { AssistantService } from '~/libs/langchain/assistant.service'
import { json } from '~/bootstrap/fns/fetch.server'
import Conversation from '~/models/Conversation.server'
import { catchAsync } from '~/utils/catchAsync'
import {
  cleanupConversationMessage,
  saveMessagesToConversation,
  saveAiMessageToConversation,
  updateShopAIAssistantUsage,
} from './fns.server'
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_OPENAI_MODEL, SYSTEM_MESSAGE } from '~/libs/openai/constants'
import { getShopData } from '~/models/Shop.server'
import { CREDIT_USAGE } from './constants'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import type { ChatModel } from 'openai/resources/index.mjs'
import { checkAiCreditPerMonthExceeded } from '~/models/helpers/ai-credit-helpers.server'
import { RAGAgent } from '~/libs/langchain/agents/rag.agent'
import { runAgenticLoop } from '~/libs/langchain/openai-agentic-loop.server'
import { JsonToSseTransformStream } from 'ai'
import type { SkillContext } from '~/libs/langchain/skills/types'
import { uploadPrintImagesToS3 } from '~/utils/amazon-s3'
import { validateImageFile } from '~/utils/image-validation'

/**
 * Parse a /command message into command name + spec text.
 * Used as a hint for the agentic loop (not a bypass trigger).
 */
function parseCommandMessage(message: string): { command: string; spec: string } | null {
  if (!message?.startsWith('/')) return null
  const match = message.match(/^\/(\S+)\s*([\s\S]*)/)
  if (!match) return null
  return { command: match[1], spec: match[2].trim() }
}

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId')
  const query = searchParams.get('query') || ''
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || 10

  if (conversationId) {
    const conversation = await Conversation.findByIdAndShopDomain(conversationId, shop)
    return json({ success: true, conversation })
  }

  const { conversations, pagination } = await Conversation.findByShopDomainWithMessages({
    shopDomain: shop,
    query,
    page,
    limit,
  })
  return json({ success: true, conversations, pagination })
})

/**
 * Unified action handler — all messages (natural language + /commands)
 * go through the OpenAI agentic loop. No dual-path, no skill bypass.
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  try {
    const {
      session: { shop, accessToken },
      admin,
    } = await authenticate.admin(request)

    // Multipart branch — Elva chat image upload. Returns CDN URLs only;
    // the client then sends them as attachments in the streaming chat POST.
    const contentType = request.headers.get('content-type') || ''
    if (contentType.startsWith('multipart/form-data')) {
      const formData = await request.formData()
      const files = formData.getAll('files').filter((f): f is File => f instanceof File)
      if (files.length === 0) {
        return json({ success: false, error: 'No files provided' }, { status: 400 })
      }
      for (const f of files) {
        const v = validateImageFile(f)
        if (!v.valid) return json({ success: false, error: v.errorMessage }, { status: 400 })
      }
      const { uploadedFiles, errorFiles, errors } = await uploadPrintImagesToS3(files, shop)
      if (errors) return json({ success: false, error: errors }, { status: 500 })
      if (errorFiles.length > 0) {
        return json({ success: false, error: errorFiles.map(e => `${e.name}: ${e.error}`).join('; ') }, { status: 500 })
      }
      return json({ success: true, urls: uploadedFiles.map(u => u.image.originalSrc) })
    }

    const payload = await request.json()

    // Handle save AI message requests (unchanged)
    if (payload.action === 'save-message') {
      const { conversationId, message, messageId, metadata, isNewMessage = true } = payload

      if (!conversationId || !message || !messageId) {
        return json(
          { success: false, error: 'Missing required fields: conversationId, message, messageId' },
          { status: 400 }
        )
      }

      try {
        const savedMessage = await saveAiMessageToConversation({
          conversationId,
          shop,
          message,
          messageId,
          metadata,
          isNewMessage,
        })
        return json({ success: true, message: savedMessage })
      } catch (error: any) {
        console.error('Error saving AI message:', error)
        return json({ success: false, error: error.message || 'Failed to save AI message' }, { status: 500 })
      }
    }

    // Shop data + credit validation
    const shopData = await getShopData(shop)
    if (!shopData) {
      return json({ success: false, error: 'Shop data not found' }, { status: 400 })
    }

    const isAiCreditValid = checkAiCreditPerMonthExceeded(shopData, CREDIT_USAGE.TEXT)
    if (!isAiCreditValid) {
      return json({ success: false, error: 'AI credits exhausted.' }, { status: 402 })
    }

    const {
      message,
      userMessageId,
      assistantMessageId,
      conversationHistory,
      conversationId,
      suggestionId,
      context: incomingContext,
      userMetadata,
      stream = false,
    } = payload

    if (!message && !suggestionId) {
      return json({ success: false, error: 'Message is required' }, { status: 400 })
    }

    // Build skill context (tools need this for execution)
    const skillContext: SkillContext = {
      shopDomain: shop,
      shopData,
      accessToken,
      shopifyAdmin: admin,
      templateId: incomingContext?.templates?.[0]?.id || incomingContext?.editorTemplate?._id,
      editorTemplate: incomingContext?.editorTemplate,
      mentions: payload.mentions,
      conversationId: payload.conversationId,
    }

    // RAG preprocessing — retrieve relevant docs (skip for /commands)
    let documentContext = ''
    if (!message?.startsWith('/')) {
      try {
        const ragAgent = new RAGAgent()
        const cleanedHistory = ((conversationHistory as AssistantResponse[]) || []).map(msg => ({
          ...msg,
          content: cleanupConversationMessage(msg.content),
        }))
        const { shouldRetrieve, searchQuery } = await ragAgent.shouldRetrieve({
          query: message,
          conversationHistory: cleanedHistory,
          context: { shopData, shopDomain: shop, ...incomingContext },
        })
        if (shouldRetrieve && searchQuery) {
          documentContext
            = (await ragAgent.retrieveDocumentation({
              searchQuery,
              context: { shopData, shopDomain: shop },
            })) || ''
        }
      } catch (ragError) {
        console.error('[AI Assistant] RAG preprocessing failed:', ragError)
        // Non-blocking — continue without RAG context
      }
    }

    // Pluck image attachments for this turn (Phase C — native vision).
    const turnAttachments = Array.isArray(userMetadata?.attachments?.files)
      ? (userMetadata.attachments.files as { url?: string; mediaType?: string }[])
          .filter((f): f is { url: string; mediaType: string } => Boolean(f?.url && f?.mediaType))
          .map(f => ({ url: f.url, mediaType: f.mediaType }))
      : undefined

    // Build loop context
    const loopContext = {
      shopData,
      shopDomain: shop,
      documentContext,
      commandHint: parseCommandMessage(message),
      attachments: turnAttachments,
    }

    // AssistantService needed by saveMessagesToConversation for title generation
    const assistant = new AssistantService({
      apiKey: process.env.OPENAI_API_KEY || '',
      model: (process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL) as ChatModel,
      temperature: Number(process.env.OPENAI_TEMPERATURE) || DEFAULT_TEMPERATURE,
      maxTokens: Number(process.env.OPENAI_MAX_TOKENS) || DEFAULT_MAX_TOKENS,
      systemMessage: SYSTEM_MESSAGE,
      user: shopData._id,
      shopDomain: shop,
    })

    const cleanedConversationHistory = ((conversationHistory as AssistantResponse[]) || []).map(msg => ({
      ...msg,
      content: cleanupConversationMessage(msg.content),
    }))

    if (stream) {
      const { stream: uiStream, done } = runAgenticLoop({
        message,
        conversationHistory: cleanedConversationHistory,
        context: loopContext,
        skillContext,
        abortSignal: request.signal,
      })

      // Persist + bill after stream completes (non-blocking; fires from inside loop's onFinish).
      done
        .then(accumulatedContent => {
          saveMessagesToConversation({
            conversationId,
            shop,
            conversationHistory: conversationHistory || [],
            assistant,
            userMessage: message,
            assistantMessage: accumulatedContent,
            userMessageId,
            assistantMessageId,
            metadata: { user: userMetadata || undefined },
          }).catch(err => console.error('Error saving messages to conversation:', err))

          updateShopAIAssistantUsage(
            shop,
            CREDIT_USAGE.TEXT,
            (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
          ).catch(err => console.error('[AI Assistant] Credit consumption failed:', err))
        })
        .catch(err => console.error('[AI Assistant] done promise failed:', err))

      // AI SDK v6: pipe object stream → SSE bytes via JsonToSseTransformStream.
      // Compression middleware downstream requires Buffer/string chunks, not objects.
      const sseStream = uiStream.pipeThrough(new JsonToSseTransformStream())
      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'x-vercel-ai-ui-message-stream': 'v1',
        },
      })
    }

    // Non-streaming path — collect full response by draining the stream.
    let fullResponse = ''
    try {
      const { stream: uiStream, done } = runAgenticLoop({
        message,
        conversationHistory: cleanedConversationHistory,
        context: loopContext,
        skillContext,
        abortSignal: request.signal,
      })
      // Drain stream so onFinish fires
      const reader = uiStream.getReader()
      while (true) {
        const { done: streamDone } = await reader.read()
        if (streamDone) break
      }
      fullResponse = await done
    } catch (error) {
      throw new Error(formatErrorMessage(error))
    }

    // Post-processing
    saveMessagesToConversation({
      conversationId,
      shop,
      conversationHistory: conversationHistory || [],
      assistant,
      userMessage: message,
      assistantMessage: fullResponse,
      userMessageId,
      assistantMessageId,
      metadata: { user: userMetadata || undefined },
    }).catch(error => {
      console.error('Error saving messages to conversation:', error)
    })

    try {
      await updateShopAIAssistantUsage(
        shop,
        CREDIT_USAGE.TEXT,
        (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
      )
    } catch (creditError: any) {
      console.error('[AI Assistant] Credit consumption failed:', creditError)
      if (creditError.message?.includes('Insufficient AI credits')) {
        return json(
          { success: false, error: 'Insufficient AI credits. Please purchase more credits to continue.' },
          { status: 402 }
        )
      }
      return json({ success: false, error: 'Failed to process credit usage. Please try again.' }, { status: 500 })
    }

    return json({ success: true, response: fullResponse })
  } catch (error: any) {
    console.error('Error in OpenAI API route:', error)
    return json({ success: false, error: error?.message || 'Failed to process request' }, { status: 500 })
  }
})
