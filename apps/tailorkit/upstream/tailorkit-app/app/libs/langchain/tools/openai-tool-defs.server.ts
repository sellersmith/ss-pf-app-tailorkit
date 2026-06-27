/**
 * OpenAI function calling tool definitions and executor for Elva AI Chat.
 * Replaces LangGraph tool wrappers (skill-tools.server.ts, element-tools.server.ts)
 * with native OpenAI function calling format.
 *
 * remove_element/edit_element modify the last plan in-place and return
 * an updated [SKILL_RESULT] so the client renders a new plan card.
 */

import type { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { tool } from 'ai'
import { z } from 'zod'
import { executeSkill } from '~/libs/langchain/skills/executor'
import { findRelevantDocumentation } from '~/utils/openai-client.server'
import FeedbackResponse from '~/modules/Feedback/models/FeedbackResponse.server'
import { createJiraFeatureRequest } from './jira-feature-request.server'
import { postSlackMessage, CORE_TAILORKIT_MEMBERS } from '~/bootstrap/fns/slack.server'
import { trackFeatureEvent } from '~/bootstrap/fns/feature-tracking.server'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import type { SkillContext, SkillResult, SkillStatusCallback } from '~/libs/langchain/skills/types'
import type { ElvaSkillKind } from '~/libs/langchain/elva-ui-message'

/** OpenAI function calling tool definitions for Elva */
export const ELVA_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'customize_product',
      description:
        'Generate a customization plan for a product. '
        + 'Call when the user describes a product they want personalization or customization for. '
        + 'Returns an execution plan the user can review and apply.',
      parameters: {
        type: 'object',
        properties: {
          spec: {
            type: 'string',
            description: 'Natural language specification of the product and desired customization',
          },
        },
        required: ['spec'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_element',
      description:
        'Remove a step from the current customization plan and return the updated plan. '
        + 'Use the label from the previously generated plan.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Human-readable label of the step to remove (case-insensitive match)' },
        },
        required: ['label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_element',
      description:
        'Edit a step in the current customization plan and return the updated plan. '
        + 'Can change display style, values, pricing, label, or settings.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Human-readable label of the step to edit (case-insensitive match)' },
          modifications: {
            type: 'object',
            description: 'Key-value modifications to apply (e.g., {displayStyle: "imageless_dropdown_list"})',
          },
        },
        required: ['label', 'modifications'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_docs',
      description:
        'Search TailorKit documentation and knowledge base. '
        + 'Call when the user asks about TailorKit features, setup, configuration, troubleshooting, '
        + 'pricing, billing, integrations, or how-to questions. Returns relevant documentation excerpts.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query describing what the user wants to know about',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_feature_request',
      description:
        'Submit a feature request, bug report, or improvement suggestion from the merchant. '
        + 'Call when the merchant explicitly expresses a wish for a new feature, reports a bug, '
        + 'or suggests an improvement. Do NOT call for general questions or how-to queries.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short, clear title summarizing the request (max 100 chars)',
          },
          description: {
            type: 'string',
            description: 'Detailed description including what the merchant wants and why',
          },
          category: {
            type: 'string',
            enum: ['feature_request', 'bug_report', 'improvement'],
            description: 'Type of request',
          },
        },
        required: ['title', 'description', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_screenshot',
      description:
        'Analyze a screenshot sent by the merchant using AI vision. '
        + 'Call when a merchant shares an image (screenshot of their store, template editor, error, etc.) '
        + 'and you need to understand what they are showing.',
      parameters: {
        type: 'object',
        properties: {
          image_url: {
            type: 'string',
            description: 'HTTPS URL of the image to analyze',
          },
          question: {
            type: 'string',
            description: 'Optional context about what to look for in the screenshot',
          },
        },
        required: ['image_url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description:
        'Search TailorKit internal implementation knowledge for deeper technical context. '
        + "Use when search_docs doesn't have enough information to answer a technical question "
        + 'about how a feature works, why something behaves a certain way, or troubleshooting complex issues.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Technical query about TailorKit internal behavior or feature implementation',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_storefront',
      description:
        "Visit the merchant's storefront to verify TailorKit installation, "
        + 'check if the customizer is rendering, and diagnose display issues. '
        + "Use when a merchant reports their customizer or product isn't showing correctly.",
      parameters: {
        type: 'object',
        properties: {
          product_url: {
            type: 'string',
            description: 'Optional specific product page URL to check. If omitted, visits store homepage.',
          },
        },
        required: [],
      },
    },
  },
]

/**
 * Extract the last [SKILL_RESULT] plan from conversation messages.
 * Searches backwards through messages for the most recent plan.
 */
function extractLastPlan(messages: ChatCompletionMessageParam[]): SkillResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const content = typeof msg.content === 'string' ? msg.content : ''
    const match = content.match(/\[SKILL_RESULT\](.*?)\[\/SKILL_RESULT\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[1]) as SkillResult
        if (parsed.success && (parsed.plan || parsed.preview)) return parsed
      } catch {
        /* not valid JSON, skip */
      }
    }
  }
  return null
}

/**
 * Execute a tool call and return the result string.
 * For customize_product: wraps result in [SKILL_RESULT] markers.
 * For remove/edit: modifies the last plan and returns updated [SKILL_RESULT].
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  context: SkillContext,
  onStatus?: SkillStatusCallback,
  messages?: ChatCompletionMessageParam[]
): Promise<string> {
  switch (name) {
    case 'customize_product': {
      const result = await executeSkill('customize', args.spec as string, context, onStatus)
      if (!result.success) {
        return JSON.stringify({ success: false, error: result.error })
      }
      // Font resolution is done client-side via FontLoader (Google Fonts CSS API).
      // Server-side resolution via FontService was attempted but font data gets lost
      // during SSE streaming (37KB JSON survives stringify but not chunked transit).
      return `[SKILL_RESULT]${JSON.stringify(result)}[/SKILL_RESULT]`
    }

    case 'remove_element': {
      const lastPlan = messages ? extractLastPlan(messages) : null
      if (!lastPlan) {
        return JSON.stringify({ success: false, error: 'No plan found in conversation to modify.' })
      }

      const labelLower = ((args.label as string) || '').toLowerCase()

      if (lastPlan.plan) {
        // ExecutionPlan format — filter out the matching step
        const before = lastPlan.plan.steps.length
        lastPlan.plan.steps = lastPlan.plan.steps.filter(s => s.label.toLowerCase() !== labelLower)
        // Re-number remaining steps
        lastPlan.plan.steps.forEach((s, idx) => {
          s.order = idx + 1
          s.id = `step_${idx + 1}`
        })
        // Remove flags referencing the deleted step
        lastPlan.plan.flags = (lastPlan.plan.flags || []).filter(
          f => !f.stepId || lastPlan.plan!.steps.some(s => s.id === f.stepId)
        )
        if (lastPlan.plan.steps.length === before) {
          return JSON.stringify({ success: false, error: `Step "${args.label}" not found in plan.` })
        }
        // Recalculate data.toolCallBatch if present
        if (lastPlan.data?.toolCallBatch?.calls) {
          lastPlan.data.toolCallBatch.calls = lastPlan.data.toolCallBatch.calls.filter(
            (c: { args?: { label?: string } }) => c.args?.label?.toLowerCase() !== labelLower
          )
        }
      } else if (lastPlan.preview) {
        // Flat preview format — filter out matching item
        const before = lastPlan.preview.length
        lastPlan.preview = lastPlan.preview.filter(p => p.label.toLowerCase() !== labelLower)
        if (lastPlan.preview.length === before) {
          return JSON.stringify({ success: false, error: `Element "${args.label}" not found in plan.` })
        }
      }

      return `[SKILL_RESULT]${JSON.stringify(lastPlan)}[/SKILL_RESULT]`
    }

    case 'edit_element': {
      const lastPlan = messages ? extractLastPlan(messages) : null
      if (!lastPlan) {
        return JSON.stringify({ success: false, error: 'No plan found in conversation to modify.' })
      }

      const labelLower = ((args.label as string) || '').toLowerCase()
      const mods = args.modifications || {}

      if (lastPlan.plan) {
        const step = lastPlan.plan.steps.find(s => s.label.toLowerCase() === labelLower)
        if (!step) {
          return JSON.stringify({ success: false, error: `Step "${args.label}" not found in plan.` })
        }
        // Apply modifications to the step
        Object.assign(step, mods)
      } else if (lastPlan.preview) {
        const item = lastPlan.preview.find(p => p.label.toLowerCase() === labelLower)
        if (!item) {
          return JSON.stringify({ success: false, error: `Element "${args.label}" not found in plan.` })
        }
        Object.assign(item, mods)
      }

      return `[SKILL_RESULT]${JSON.stringify(lastPlan)}[/SKILL_RESULT]`
    }

    case 'search_docs': {
      const query = args.query as string
      if (!query) {
        return JSON.stringify({ success: false, error: 'Search query is required.' })
      }
      if (!context.shopData || !context.shopDomain) {
        return JSON.stringify({ success: false, error: 'Missing shop context for documentation search.' })
      }
      try {
        const { documents } = await findRelevantDocumentation(
          'match_documents',
          query,
          context.shopDomain,
          context.shopData,
          { match_threshold: 0.2, match_count: 5 }
        )
        if (!documents || documents.length === 0) {
          return JSON.stringify({ success: true, results: 'No relevant documentation found for this query.' })
        }
        const formatted = documents
          .map((doc: { title?: string; content?: string }) => `## ${doc.title || 'Untitled'}\n${doc.content || ''}`)
          .join('\n\n')
        return JSON.stringify({ success: true, results: formatted })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return JSON.stringify({ success: false, error: `Documentation search failed: ${message}` })
      }
    }

    case 'submit_feature_request': {
      const title = ((args.title as string) || '').trim()
      const description = ((args.description as string) || '').trim()
      const category = args.category as string
      const VALID_CATEGORIES = ['feature_request', 'bug_report', 'improvement']
      const MAX_REQUESTS_PER_DAY = 5
      const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000

      // Input validation
      if (!title || title.length < 5) {
        return JSON.stringify({
          success: false,
          error: 'Please provide a more specific title (at least 5 characters).',
        })
      }
      if (!description || description.length < 10) {
        return JSON.stringify({ success: false, error: 'Please provide more detail about your request.' })
      }
      if (!VALID_CATEGORIES.includes(category)) {
        return JSON.stringify({ success: false, error: 'Invalid category.' })
      }
      if (!context.shopDomain) {
        return JSON.stringify({ success: false, error: 'Missing shop context.' })
      }

      // Rate limit: max requests per shop per day
      const oneDayAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
      const recentCount = await FeedbackResponse.countDocuments({
        shopDomain: context.shopDomain,
        formId: 'elva-feature-request',
        createdAt: { $gte: oneDayAgo },
      })
      if (recentCount >= MAX_REQUESTS_PER_DAY) {
        return JSON.stringify({
          success: false,
          error: 'Daily feature request limit reached. Please try again tomorrow.',
        })
      }

      // Dedup: exact title match (case-insensitive) in last 24h for same shop
      const normalizedTitle = title.toLowerCase().trim()
      const existingRequest = await FeedbackResponse.findOne({
        shopDomain: context.shopDomain,
        formId: 'elva-feature-request',
        createdAt: { $gte: oneDayAgo },
        'responses.0.answer': normalizedTitle,
      })
      if (existingRequest) {
        return JSON.stringify({
          success: true,
          message: 'A similar request was already submitted recently. Our team is reviewing it.',
        })
      }

      // Save to MongoDB (reuse existing FeedbackResponse model)
      await FeedbackResponse.create({
        formId: 'elva-feature-request',
        shopDomain: context.shopDomain,
        localTime: new Date().toString(),
        responses: [
          { question: 'title', answer: normalizedTitle },
          { question: 'description', answer: description },
          { question: 'category', answer: category },
          { question: 'conversationId', answer: context.conversationId || '' },
        ],
      })

      // Create Jira issue (graceful fallback on failure)
      const jiraResult = await createJiraFeatureRequest({
        title,
        description,
        category: category as 'feature_request' | 'bug_report' | 'improvement',
        shopDomain: context.shopDomain,
        conversationId: context.conversationId,
      })

      // Slack notification (non-blocking)
      const tailorKitDevChannelID = 'C07QE0V9J1Z'

      if (tailorKitDevChannelID) {
        const emoji = category === 'bug_report' ? '🐛' : category === 'improvement' ? '💡' : '✨'
        postSlackMessage(
          `${emoji} *Merchant Feature Request* ${CORE_TAILORKIT_MEMBERS}\n`
            + `• *Title:* ${title}\n`
            + `• *Shop:* ${context.shopDomain}\n`
            + `• *Category:* ${category.replace('_', ' ')}\n${
              jiraResult.key ? `• *Jira:* ${jiraResult.key}\n` : ''
            }• *Description:* ${description.substring(0, 200)}`,
          tailorKitDevChannelID
        ).catch(() => {})
      }

      // Track feature request submission
      trackFeatureEvent(context.shopData, 'ai_assistant', 'feature_request_submitted', {
        category,
        has_jira: !!jiraResult.key,
        jira_key: jiraResult.key || null,
        shop_domain: context.shopDomain,
      }).catch(() => {})

      // Confirmation email to merchant via Customer.io (non-blocking).
      // Frequency capping and dedupe are handled by the Customer.io campaign
      // configuration, not here — keep client-side logic minimal.
      ;(async () => {
        const categoryLabel
          = category === 'bug_report' ? 'Bug report' : category === 'improvement' ? 'Improvement' : 'Feature request'

        return postEventToCustomerIo({
          shopDomain: context.shopDomain,
          eventName: CUSTOMERIO_EVENTS.ELVA_FEATURE_REQUEST_SUBMITTED,
          eventData: {
            title,
            description,
            category,
            categoryLabel,
            jiraKey: jiraResult.key || null,
          },
        })
      })().catch(e => {
        console.error('[elva] Failed to deliver feature-request confirmation email:', {
          shopDomain: context.shopDomain,
          jiraKey: jiraResult.key || null,
          error: e instanceof Error ? e.message : String(e),
        })
      })

      return JSON.stringify({
        success: true,
        jiraKey: jiraResult.key || null,
        message: jiraResult.key ? `Request submitted as ${jiraResult.key}` : 'Request submitted successfully',
      })
    }

    case 'analyze_screenshot': {
      const imageUrl = args.image_url as string
      const question = args.question as string | undefined
      if (!imageUrl) {
        return JSON.stringify({ success: false, error: 'Image URL is required.' })
      }
      const { analyzeScreenshot } = await import('./analyze-screenshot.server')
      const analysis = await analyzeScreenshot(imageUrl, question, context.conversationId)
      return JSON.stringify({ success: true, analysis })
    }

    case 'search_code': {
      const query = args.query as string
      if (!query) {
        return JSON.stringify({ success: false, error: 'Search query is required.' })
      }
      const { searchCode } = await import('./search-code.server')
      const codeContext = await searchCode(query, context.shopDomain)
      return JSON.stringify({ success: true, results: codeContext })
    }

    case 'browse_storefront': {
      if (!context.shopData) {
        return JSON.stringify({ success: false, error: 'Shop context required to browse storefront.' })
      }
      const { browseStorefront } = await import('./browse-storefront.server')
      const findings = await browseStorefront({
        productUrl: args.product_url as string | undefined,
        shopData: context.shopData,
        conversationId: context.conversationId,
      })
      return findings
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

// ──────────────────────────────────────────────────────────────────────
// AI SDK v6 tool factories — Phase 02-03 of vercel-ai-sdk migration.
// Each factory closes over loop-scoped context and returns a `tool()`
// suitable for streamText({ tools }). Legacy ELVA_TOOLS + executeToolCall
// remain above for backward compat; deleted in Phase 15.
// ──────────────────────────────────────────────────────────────────────

export type ElvaToolOutput =
  | { kind: ElvaSkillKind; toolCallId?: string; payload: unknown }
  | { success: false; error: string }
  | { success: true; [k: string]: unknown }

/**
 * Parse executeToolCall's string output into a structured ElvaToolOutput.
 * UI-rendering tools (customize/remove/edit) return `[SKILL_RESULT]…[/SKILL_RESULT]`
 * → unwrap into { kind, payload }. Others return plain JSON → parse as-is.
 */
function parseToolResult(name: string, raw: string): ElvaToolOutput {
  const skillMatch = raw.match(/^\[SKILL_RESULT\]([\s\S]*)\[\/SKILL_RESULT\]$/)
  if (skillMatch) {
    const kind: ElvaSkillKind
      = name === 'customize_product'
        ? 'customize'
        : name === 'remove_element'
          ? 'remove'
          : name === 'edit_element'
            ? 'edit'
            : 'customize'
    try {
      return { kind, payload: JSON.parse(skillMatch[1]) }
    } catch {
      return { success: false, error: 'Failed to parse skill result JSON' }
    }
  }
  try {
    return JSON.parse(raw) as ElvaToolOutput
  } catch {
    return { success: false, error: 'Tool returned non-JSON output' }
  }
}

/** Accessor for current conversation messages (for tools needing plan history). */
export type MessagesRef = () => ChatCompletionMessageParam[]

/** Factory: customize_product → AI SDK tool. */
export const buildCustomizeProductTool = (ctx: SkillContext, onStatus: SkillStatusCallback, getMessages: MessagesRef) =>
  tool({
    description: (ELVA_TOOLS[0] as { function: { description: string } }).function.description,
    inputSchema: z.object({
      spec: z.string().describe('Natural language specification of the product and desired customization'),
    }),
    execute: async ({ spec }) => {
      const raw = await executeToolCall('customize_product', { spec }, ctx, onStatus, getMessages())
      return parseToolResult('customize_product', raw)
    },
  })

/** Factory: remove_element → AI SDK tool. Modifies last plan in conversation. */
export const buildRemoveElementTool = (ctx: SkillContext, onStatus: SkillStatusCallback, getMessages: MessagesRef) =>
  tool({
    description: (ELVA_TOOLS[1] as { function: { description: string } }).function.description,
    inputSchema: z.object({
      label: z.string().describe('Human-readable label of the step to remove (case-insensitive match)'),
    }),
    execute: async ({ label }) => {
      const raw = await executeToolCall('remove_element', { label }, ctx, onStatus, getMessages())
      return parseToolResult('remove_element', raw)
    },
  })

/** Factory: edit_element → AI SDK tool. Modifies last plan in conversation. */
export const buildEditElementTool = (ctx: SkillContext, onStatus: SkillStatusCallback, getMessages: MessagesRef) =>
  tool({
    description: (ELVA_TOOLS[2] as { function: { description: string } }).function.description,
    inputSchema: z.object({
      label: z.string().describe('Human-readable label of the step to edit (case-insensitive match)'),
      modifications: z
        .record(z.string(), z.unknown())
        .describe('Key-value modifications to apply (e.g., {displayStyle: "imageless_dropdown_list"})'),
    }),
    execute: async ({ label, modifications }) => {
      const raw = await executeToolCall('edit_element', { label, modifications }, ctx, onStatus, getMessages())
      return parseToolResult('edit_element', raw)
    },
  })

/** Factory: search_docs → AI SDK tool. Returns plain JSON (no skill-result). */
export const buildSearchDocsTool = (ctx: SkillContext, onStatus: SkillStatusCallback) =>
  tool({
    description: (ELVA_TOOLS[3] as { function: { description: string } }).function.description,
    inputSchema: z.object({
      query: z.string().describe('Search query describing what the user wants to know about'),
    }),
    execute: async ({ query }) =>
      parseToolResult('search_docs', await executeToolCall('search_docs', { query }, ctx, onStatus)),
  })

/** Factory: submit_feature_request → AI SDK tool. */
export const buildSubmitFeatureRequestTool = (ctx: SkillContext, onStatus: SkillStatusCallback) =>
  tool({
    description: (ELVA_TOOLS[4] as { function: { description: string } }).function.description,
    inputSchema: z.object({
      title: z.string().describe('Short, clear title summarizing the request (max 100 chars)'),
      description: z.string().describe('Detailed description including what the merchant wants and why'),
      category: z.enum(['feature_request', 'bug_report', 'improvement']).describe('Type of request'),
    }),
    execute: async args =>
      parseToolResult('submit_feature_request', await executeToolCall('submit_feature_request', args, ctx, onStatus)),
  })

/** Factory: analyze_screenshot → AI SDK tool. */
export const buildAnalyzeScreenshotTool = (ctx: SkillContext, onStatus: SkillStatusCallback) =>
  tool({
    description: (ELVA_TOOLS[5] as { function: { description: string } }).function.description,
    inputSchema: z.object({
      image_url: z.string().describe('HTTPS URL of the image to analyze'),
      question: z.string().optional().describe('Optional context about what to look for in the screenshot'),
    }),
    execute: async args =>
      parseToolResult('analyze_screenshot', await executeToolCall('analyze_screenshot', args, ctx, onStatus)),
  })

/** Factory: search_code → AI SDK tool. */
export const buildSearchCodeTool = (ctx: SkillContext, onStatus: SkillStatusCallback) =>
  tool({
    description: (ELVA_TOOLS[6] as { function: { description: string } }).function.description,
    inputSchema: z.object({
      query: z.string().describe('Technical query about TailorKit internal behavior or feature implementation'),
    }),
    execute: async ({ query }) =>
      parseToolResult('search_code', await executeToolCall('search_code', { query }, ctx, onStatus)),
  })

/** Factory: browse_storefront → AI SDK tool. */
export const buildBrowseStorefrontTool = (ctx: SkillContext, onStatus: SkillStatusCallback) =>
  tool({
    description: (ELVA_TOOLS[7] as { function: { description: string } }).function.description,
    inputSchema: z.object({
      product_url: z
        .string()
        .optional()
        .describe('Optional specific product page URL to check. If omitted, visits store homepage.'),
    }),
    execute: async args =>
      parseToolResult('browse_storefront', await executeToolCall('browse_storefront', args, ctx, onStatus)),
  })

/**
 * Build the full Elva tool record for AI SDK streamText({ tools }).
 * Channel filter applied here — Crisp gets text-only support subset.
 */
export function buildElvaTools(
  channel: 'in-app' | 'crisp',
  ctx: SkillContext,
  onStatus: SkillStatusCallback,
  getMessages: MessagesRef
) {
  const all = {
    customize_product: buildCustomizeProductTool(ctx, onStatus, getMessages),
    remove_element: buildRemoveElementTool(ctx, onStatus, getMessages),
    edit_element: buildEditElementTool(ctx, onStatus, getMessages),
    search_docs: buildSearchDocsTool(ctx, onStatus),
    submit_feature_request: buildSubmitFeatureRequestTool(ctx, onStatus),
    analyze_screenshot: buildAnalyzeScreenshotTool(ctx, onStatus),
    search_code: buildSearchCodeTool(ctx, onStatus),
    browse_storefront: buildBrowseStorefrontTool(ctx, onStatus),
  }
  if (channel === 'in-app') return all
  const { customize_product: _c, remove_element: _r, edit_element: _e, ...crispSubset } = all
  return crispSubset
}
