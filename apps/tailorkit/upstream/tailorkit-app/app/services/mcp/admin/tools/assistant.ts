/* eslint-disable max-len */
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { context } from '~/utils/openai-client.server'
import { MCP_TOOLS } from '~/routes/api.mcp.$tool/constants'
import { UUID_PATTERN } from './constants'

// Tool description for AI to understand when to call this tool
const assistantToolDescription = `
Use this tool when the user needs customer support, has questions, or wants to learn about TailorKit (Shopify product personalizer).

ALWAYS call this tool for:
- Questions about HOW TO do something (e.g., "How to create template?", "How to setup?", "What is the process?")
- General questions about TailorKit features and capabilities
- Technical support requests and troubleshooting
- Product personalization guidance and best practices
- Shopify integration setup and configuration issues
- Account management and billing inquiries
- User onboarding and getting started help
- Feature requests and feedback
- Bug reports and technical issues
- General customer service inquiries
- ANY instructional or educational questions

NEVER use this tool when the user explicitly asks to CREATE, GENERATE, or BUILD something specific.
This tool is for ANSWERING QUESTIONS and providing SUPPORT, not for creating actual content or templates.

The assistant will respond as Elva, the TailorKit AI support specialist, providing helpful, accurate, and friendly customer service in the user's preferred language.`

const assistantTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: MCP_TOOLS.ASSISTANT,
    description: assistantToolDescription,
    parameters: {
      type: 'object',
      properties: {
        userMessage: {
          type: 'string',
          description:
            'The complete user message that requires a customer support response. Include the full context and any specific questions or issues mentioned.',
          minLength: 1,
        },
        assistantContext: {
          type: 'string',
          description: 'Internal context and configuration for the assistant behavior and personality',
          default: context(false),
        },
        assistantMessageId: {
          type: 'string',
          description: 'Assistant message ID. This MUST be exactly the same as provided in the system message.',
          pattern: UUID_PATTERN,
        },
        conversationHistory: {
          type: 'array',
          description: 'The conversation history between the user and the assistant',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['user', 'assistant', 'system'],
                description: 'The role of the message sender (user, assistant, or system)',
              },
              content: {
                type: 'string',
                description: 'The actual message content/text',
                minLength: 1,
              },
              messageId: {
                type: 'string',
                description: 'Unique identifier for the message (required for assistant messages to enable updates)',
                pattern: UUID_PATTERN,
              },
              timestamp: {
                type: 'string',
                description: 'ISO 8601 timestamp indicating when the message was created (optional)',
                format: 'date-time',
              },
            },
            required: ['role', 'content'],
            additionalProperties: false,
          },
        },
        userLanguage: {
          type: 'string',
          description: 'Preferred language for the response (ISO 639-1 code, e.g., "en", "es", "fr")',
          pattern: '^[a-z]{2}$',
          default: 'en',
        },
        urgencyLevel: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Priority level of the support request',
          default: 'medium',
        },
        supportCategory: {
          type: 'string',
          enum: [
            'general_inquiry',
            'technical_support',
            'billing',
            'feature_request',
            'bug_report',
            'integration_help',
            'onboarding',
          ],
          description: 'Category of the support request for better routing and response',
        },
      },
      required: ['userMessage', 'conversationHistory', 'assistantMessageId'],
      additionalProperties: false,
    },
  },
}

export default assistantTool
