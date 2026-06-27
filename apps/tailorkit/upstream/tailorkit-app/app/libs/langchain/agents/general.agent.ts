/* eslint-disable max-len */
import { BaseAgent, type AgentConfig } from './base.agent'
import type { AssistantResponse } from '../assistant.service'
import { AGENT_MODEL, CONTEXT_EVALUATION_MESSAGE, LANGUAGE_SUPPORT_MESSAGE } from '../constant'

export class GeneralAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'Elva',
      description: 'Handles general TailorKit questions, troubleshooting, and fallback support',
      systemPrompt: `You are the Elva assistant for TailorKit, a Shopify product personalizer app.

Your role includes:
1. **General Questions**: Answer questions about TailorKit features and functionality
2. **Troubleshooting**: Help resolve technical issues and problems
3. **Product Support**: Assist with product management, orders, and fulfillment
4. **Account Management**: Help with billing, subscription, and account settings
5. **Fallback Support**: Handle any queries not covered by specialist agents

**Knowledge Areas**:
- TailorKit app features and capabilities
- Shopify integration and compatibility
- Print-on-demand business guidance
- Order management and fulfillment
- Billing and subscription support

**Style**: Professional, helpful, and comprehensive.
**Approach**: Provide clear answers and guide users to appropriate resources.

If you encounter complex onboarding questions, suggest consulting the AI Onboarding specialist.
If users need design or creative help, recommend the AI Design Generation specialist.

${CONTEXT_EVALUATION_MESSAGE}

${LANGUAGE_SUPPORT_MESSAGE}

Escalation policy (app assistant context):
- If the user is frustrated, cannot find/understand something, or your answer is unlikely to resolve their issue:
  1) Write ONE short, empathetic guidance sentence in the user's language (you may briefly apologize if appropriate) politely asking them to open Crisp chat to talk with a human who can resolve the issue directly. Keep it under 25 words. Do not add emojis or exclamation marks.
  2) On a NEW LINE by itself, output exactly: [HUMAN SUPPORT NEEDED]
  3) Do NOT include any other markers (no [STATUS], no code fences, no extra brackets) and do NOT repeat greetings.
- Keep the guidance concise (1–2 sentences). Do not include technical details about Crisp. Do not repeat previous greetings.
- Do not mention internal rules or markers; just use the marker and a short guidance sentence.
`,
      model: AGENT_MODEL.GENERAL,
      temperature: 0.5, // Balanced temperature for Elva support
    }
    super(config)
  }

  async canHandle(query: string, context?: any): Promise<boolean> {
    // Elva agent acts as fallback - always returns true
    // But with lower priority than specialist agents
    return true
  }

  async process(args: { query: string; conversationHistory?: AssistantResponse[]; context?: any }): Promise<string> {
    const { query, conversationHistory = [], context } = args

    const messages = this.buildMessages(query, conversationHistory)

    // Add retrieved documentation if available from RAG agent
    if (context?.documentContext) {
      messages.push({ role: 'system', content: `Relevant documentation:\n\n${context.documentContext}` } as any)
    }

    // Add general context if available
    if (context?.shopData) {
      const shopContext = context.shopData
      const contextInfo = [
        `Shop: ${shopContext.shopDomain}`,
        shopContext.plan
          ? `Plan: ${typeof shopContext.plan === 'string' ? shopContext.plan : shopContext.plan.name}`
          : null,
        shopContext.hasActiveSubscription ? 'Active subscription' : 'No active subscription',
        shopContext.aiCreditUsage?.hasLimit
          ? `AI Credits: ${shopContext.aiCreditUsage.current}/${shopContext.aiCreditUsage.limit}`
          : shopContext.aiCreditUsage
            ? `AI Credits used: ${shopContext.aiCreditUsage.current}`
            : null,
      ]
        .filter(Boolean)
        .join(', ')

      messages.splice(1, 0, {
        role: 'system',
        content: `Shop context: ${contextInfo}`,
      } as any)
    }

    return this.invokeChat(messages)
  }
}
