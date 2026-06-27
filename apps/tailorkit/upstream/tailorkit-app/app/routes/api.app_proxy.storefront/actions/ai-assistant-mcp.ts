import type { TAIAssistantCallPayload } from 'extensions/tailorkit-src/src/assets/types/app-actions'
import type { ChatModel } from 'openai/resources/chat/chat.mjs'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs'
import type { Server as SocketIOServer } from 'socket.io'
import type { AssistantResponse } from '~/libs/openai/assistant.service'
import { AssistantService } from '~/libs/openai/assistant.service'
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from '~/libs/openai/constants'
import { getShopData } from '~/models/Shop.server'
import { checkAiCreditPerMonthExceeded, increaseAiCreditPerMonth } from '~/models/helpers/ai-credit-helpers.server'
import { cleanupConversationMessage, considerCreditUsage } from '~/routes/api.ai-assistant/fns.server'
import type { MCPToolCall, TailorKitSocketIOMCPServer } from '~/services/mcp/storefront/tailorkit-mcp.server'
import { getTailorKitSocketIOMCPServer } from '~/services/mcp/storefront/tailorkit-mcp.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import {
  AI_ASSISTANT_STOREFRONT_CONFIGURATION_COMPLETE_MESSAGE,
  AI_ASSISTANT_STOREFRONT_MARKDOWN_FORMAT,
  AI_ASSISTANT_STOREFRONT_SYSTEM_MESSAGE,
  AI_ASSISTANT_STOREFRONT_USER_CONFIRMATION_REQUIRED_MESSAGE,
  getAiAssistantStorefrontNextActionPrompt,
} from '../constants/ai-assistant'
import type { TailorKitAdminMcpWithSocketServer } from '~/services/mcp/admin/tailorkit-admin-mcp.server'
import { MCP_TOOLS_DATA_MARKDOWN_VALUE, MCP_TOOLS_EVENT_MARKDOWN_KEY } from '~/services/mcp/constants'

interface ToolExecutionResult {
  success: boolean
  result?: any
  error?: string
  toolCall: MCPToolCall
}

const REASONING = false

export async function aiAssistantCallWithMCP(
  shopDomain: string,
  sessionId: string,
  payload: TAIAssistantCallPayload,
  io: SocketIOServer
): Promise<ReadableStream> {
  if (!io) {
    throw new Error('Socket.IO server not available')
  }

  const shopData = await getShopData(shopDomain)

  if (!shopData) {
    throw new Error('Shop data not found')
  }

  const { message, conversationHistory } = payload

  // Get MCP server instance
  const mcpServer = getTailorKitSocketIOMCPServer(io)
  const globalClientIds = await mcpServer.getGlobalConnectedClientIds()

  if (globalClientIds.length === 0) {
    throw new Error(
      'No TailorKit clients connected to this server instance. Please ensure the product personalizer page is open.'
    )
  }

  const mcpToolNames = mcpServer
    .getMCPTools()
    .filter(
      (t): t is typeof t & { type: 'function'; function: { name: string; description?: string } } =>
        t.type === 'function'
    )
    .map(t => ({ ...t, function: { name: t.function.name, description: t.function.description } }))

  const systemMessage = [
    AI_ASSISTANT_STOREFRONT_SYSTEM_MESSAGE,
    'VERY VERY VERY IMPORTANT:',
    'When you consider to use tool_calls, maximum tool call each run is one array because each tool call will change the state of data.',
    `Available tools: ${mcpToolNames
      .map((toolName, index) => `${index + 1}: ${toolName.function.name} - ${toolName.function.description}`)
      .join('\n')}`,
  ].join('\n\n')

  const assistant = new AssistantService({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini' as ChatModel,
    temperature: Number(process.env.OPENAI_TEMPERATURE) || DEFAULT_TEMPERATURE,
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS) || DEFAULT_MAX_TOKENS,
    systemMessage,
    user: sessionId,
    shopDomain,
  })

  // Find client by session ID, fallback to first connected client
  const preferredClientId = mcpServer.getPreferredClientForSession(sessionId)
  let determinedClientId: string

  if (preferredClientId) {
    determinedClientId = preferredClientId
    console.log(`Using session-matched client ${determinedClientId} for session ${sessionId}`)
  } else {
    console.log(`No client found for session ${sessionId}, using first available local client`)
    determinedClientId = globalClientIds[0]

    // Associate this client with the session for future requests
    console.log(`Associating client ${determinedClientId} with session ${sessionId}`)
    mcpServer.associateClientWithSession(determinedClientId, sessionId)
  }

  let accumulatedContent = ''
  const maxToolCalls = 25

  // Create a new ReadableStream for streaming the response
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        const cleanedUpConversationHistory = (conversationHistory as unknown as AssistantResponse[]).map(msg => ({
          ...msg,
          content: cleanupConversationMessage(msg.content),
        }))

        // Add client context to the conversation
        const contextMessage = `[CLIENT_CONTEXT: Connected to Elva AI personalizer client ${determinedClientId}]`

        // Stream initial AI response
        await assistant.streamMessage(
          `${contextMessage}\n\nUser request: ${message}`,
          cleanedUpConversationHistory,
          chunk => {
            try {
              let chunkString = chunk

              if (REASONING) {
                chunkString = chunkString.replace(AI_ASSISTANT_STOREFRONT_MARKDOWN_FORMAT.CONFIGURATION_COMPLETE, '')
                chunkString = chunkString.replace(
                  AI_ASSISTANT_STOREFRONT_MARKDOWN_FORMAT.USER_CONFIRMATION_REQUIRED,
                  ''
                )
              }

              accumulatedContent += chunk

              sendMessageToClient(controller, chunkString)
            } catch (error) {
              controller.error(error)
            }
          }
        )

        // Now execute the iterative MCP process
        await executeIterativeMCPProcess({
          assistant,
          mcpServer,
          clientId: determinedClientId,
          originalMessage: message,
          controller,
          accumulatedContent,
          maxToolCalls,
        })

        controller.close()

        // Calculate and record credit usage
        const classification = await assistant.classifyPrompt(accumulatedContent)
        const creditUsage = considerCreditUsage(classification)

        // Validate ai credit per month
        const isAiCreditValid = checkAiCreditPerMonthExceeded(shopData, creditUsage)
        if (!isAiCreditValid) {
          throw new Error('AI credit per month exceeded')
        }

        // CRITICAL: Blocking credit consumption
        // Note: For storefront streaming, we consume AFTER streaming completes
        // This is acceptable as pre-check (checkAiCreditPerMonthExceeded) already validated
        try {
          const allocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
          await increaseAiCreditPerMonth(shopDomain, creditUsage, 'ai_chat', undefined, allocation)
        } catch (error: any) {
          console.error('[AI Chat MCP] Failed to consume credits after streaming:', error)
          // Don't throw here - stream already completed successfully
          // Log error for monitoring/alerting
        }
      } catch (error) {
        controller.error(error)
        throw new Error(formatErrorMessage(error))
      }
    },
  })

  return readableStream
}

export async function executeIterativeMCPProcess(args: {
  assistant: AssistantService
  mcpServer: TailorKitSocketIOMCPServer | TailorKitAdminMcpWithSocketServer
  clientId: string
  originalMessage: string
  controller: ReadableStreamDefaultController
  accumulatedContent: string
  maxToolCalls: number
  shopDomain?: string
  shouldSummarize?: boolean
  conversationHistory?: AssistantResponse[]
}) {
  const {
    assistant,
    mcpServer,
    clientId,
    originalMessage,
    controller,
    maxToolCalls,
    shopDomain,
    shouldSummarize = true,
    conversationHistory = [],
  } = args

  let accumulatedContent = args.accumulatedContent

  let toolCallCount = 0
  let currentContext = [accumulatedContent, shopDomain ? `shopDomain: ${shopDomain}` : ''].join('\n')
  const toolResults: ToolExecutionResult[] = []

  let shouldContinue = true

  while (shouldContinue && toolCallCount < maxToolCalls) {
    try {
      const nextActionPrompt = getAiAssistantStorefrontNextActionPrompt(
        clientId,
        originalMessage,
        toolCallCount,
        maxToolCalls
      )

      let sanitizedToolResults = toolResults.map(tr => ({
        role: 'function' as const,
        name: tr.toolCall.name,
        content: JSON.stringify(tr.result || ''),
      }))

      // Remove previous get_personalizer_dom tool calls and remain the lastest only to avoid hallucination
      if ((mcpServer as any).sanitizeToolResults && typeof (mcpServer as any).sanitizeToolResults === 'function') {
        sanitizedToolResults = (mcpServer as any).sanitizeToolResults(sanitizedToolResults)
      }

      // Get AI's next action plan
      const messages: ChatCompletionMessageParam[] = [
        ...conversationHistory,
        { role: 'user' as const, content: nextActionPrompt },
        { role: 'assistant', content: currentContext },
        ...sanitizedToolResults,
      ]

      const response = await assistant.callWithFunctions(messages, mcpServer.getMCPTools(), {
        temperature: 0.3, // Lower temperature for more focused tool usage
        max_tokens: 2000,
      })

      const assistantMessage = response.choices[0].message

      // Stream the AI's reasoning
      if (assistantMessage.content) {
        const reasoningUpdate = `\n\n**AI Reasoning (Step ${toolCallCount + 1}):** ${assistantMessage.content}`
        currentContext += reasoningUpdate

        if (REASONING) {
          const sentMessage = sendMessageToClient(controller, reasoningUpdate)
          accumulatedContent += sentMessage
        }
      }

      // Check if AI wants to stop
      if (
        assistantMessage.content?.includes(AI_ASSISTANT_STOREFRONT_MARKDOWN_FORMAT.CONFIGURATION_COMPLETE)
        && REASONING
      ) {
        const completionMessage = `${AI_ASSISTANT_STOREFRONT_CONFIGURATION_COMPLETE_MESSAGE}`
        const sentMessage = sendMessageToClient(controller, completionMessage)
        accumulatedContent += sentMessage
        break
      }

      if (
        assistantMessage.content?.includes(AI_ASSISTANT_STOREFRONT_MARKDOWN_FORMAT.USER_CONFIRMATION_REQUIRED)
        && REASONING
      ) {
        const confirmationMessage = `${AI_ASSISTANT_STOREFRONT_USER_CONFIRMATION_REQUIRED_MESSAGE}`
        const sentMessage = sendMessageToClient(controller, confirmationMessage)
        accumulatedContent += sentMessage
        break
      }

      // Execute any tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          toolCallCount++

          if (toolCallCount > maxToolCalls) {
            const limitMessage = `\n\n⚠️ **Tool call limit reached.** Configuration stopped at ${maxToolCalls} actions.`
            const sentMessage = sendMessageToClient(controller, limitMessage)
            accumulatedContent += sentMessage
            shouldContinue = false
            break
          }

          try {
            // Execute the MCP tool
            const result = await mcpServer.executeMCPTool(
              {
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments),
              },
              clientId
            )

            const sanitizedResult = mcpServer.getSanitizedResultMCPTool(toolCall.function.name, result)
            toolResults.push({
              success: true,
              result: sanitizedResult,
              toolCall: {
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments),
              },
            })

            // Stream tool execution update
            const toolUpdate = `\n\n🔧 **Action ${toolCallCount}:** ${toolCall.function.name} - Success`
            const sentMessage = sendMessageToClient(controller, toolUpdate)
            accumulatedContent += sentMessage

            // Special case for Assistant tool calling
            if (typeof sanitizedResult === 'string') {
              const sentMessage = sendMessageToClient(controller, sanitizedResult, false)
              accumulatedContent += sentMessage
            }
          } catch (error: any) {
            console.error('Error in MCP iteration tool call:', error)
            toolResults.push({
              success: false,
              error: error.message,
              toolCall: {
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments),
              },
            })

            // Stream error update
            const errorUpdate = `\n\n❌ **Action ${toolCallCount}:** ${toolCall.function.name} - Failed: ${error.message}`
            const sentMessage = sendMessageToClient(controller, errorUpdate)
            accumulatedContent += sentMessage
          }

          // Small delay between tool calls
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        if (shouldSummarize && REASONING) {
          // Update context with tool results
          const toolSummary = toolResults
            .map(tr => `${tr.toolCall.name}: ${tr.success ? 'Success' : `Failed - ${tr.error}`}`)
            .join(', ')
          currentContext += `\n\nTool executions: ${toolSummary}`
          const sentMessage = sendMessageToClient(controller, `\n\nTool executions: ${toolSummary}`)
          accumulatedContent += sentMessage
        }
      } else {
        // No tool calls, AI is probably done
        shouldContinue = false
      }

      // Small delay before next iteration
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error: any) {
      console.error('Error in MCP iteration:', error)
      const errorMessage = `\n\n❌ **Error:** ${error.message}`
      const sentMessage = sendMessageToClient(controller, errorMessage)
      accumulatedContent += sentMessage
      break
    }
  }

  if (toolCallCount > 0 && shouldSummarize) {
    // Final summary
    const summaryMessage = await assistant.summarizeConversation([{ role: 'assistant', content: accumulatedContent }])
    const sentMessage = sendMessageToClient(controller, summaryMessage)
    accumulatedContent += sentMessage
  }

  return {
    accumulatedContent,
    toolResults,
  }
}

export function sendMessageToClient(
  controller: ReadableStreamDefaultController,
  message: string,
  isTextResponse: boolean = true
) {
  const messageStringify = JSON.stringify(message)
  const sentMessage = isTextResponse
    ? `${MCP_TOOLS_DATA_MARKDOWN_VALUE}${messageStringify}\n\n`
    : `${MCP_TOOLS_EVENT_MARKDOWN_KEY}${messageStringify}\n\n`
  controller.enqueue(new TextEncoder().encode(sentMessage))

  return sentMessage
}
