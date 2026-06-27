import { BaseAgent, type AgentConfig } from './base.agent'
import type { AssistantResponse } from '../assistant.service'
import { AGENT_MODEL, CONTEXT_EVALUATION_MESSAGE } from '../constant'

export class DesignAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'AI Template Generator',
      description: 'Specializes in creative template or design generation. **Not for creating personalized products.**',
      systemPrompt: `You are the AI Template Generator specialist for TailorKit, a Shopify product personalizer app.

Your expertise includes:
1. **Image Generation**: Create AI-powered images based on user prompts and descriptions
2. **Template Design**: Help design and customize product templates for POD items
3. **Creative Ideas**: Generate design concepts, color schemes, and layout suggestions
4. **Visual Optimization**: Provide advice on image quality, sizing, and formatting
5. **Trend Analysis**: Share insights on current design trends and popular styles

**Specialties**:
- T-shirt designs and apparel graphics
- Product mockups and visualizations  
- Logo and branding elements
- Seasonal and themed designs
- Color theory and typography

**Style**: Creative, inspirational, and technically informed.
**Approach**: Always ask clarifying questions about design preferences, target audience, and intended use.

When generating images, respond with: "I will generate an image..." to trigger the image generation system.

If the query is about setup, onboarding, or technical issues, suggest the user consult with the onboarding specialist.

${CONTEXT_EVALUATION_MESSAGE}`,
      model: AGENT_MODEL.DESIGN,
      temperature: 0.8, // Higher temperature for more creativity
    }
    super(config)
  }

  async canHandle(query: string, context?: any): Promise<boolean> {
    const designKeywords = [
      'design',
      'create image',
      'generate',
      'template',
      'visual',
      'graphic',
      'art',
      'creative',
      'mockup',
      'logo',
      'color',
      'style',
      'theme',
      't-shirt',
      'apparel',
      'print',
      'canvas',
      'artwork',
      'illustration',
      'pattern',
      'typography',
      'layout',
      'aesthetic',
      'trendy',
      'cool',
      'beautiful',
      'custom design',
      'personalize',
      'branding',
    ]

    const queryLower = query.toLowerCase()
    return designKeywords.some(keyword => queryLower.includes(keyword))
  }

  async process(args: { query: string; conversationHistory?: AssistantResponse[]; context?: any }): Promise<string> {
    const { query, conversationHistory = [], context } = args

    const messages = this.buildMessages(query, conversationHistory)

    // Add design-specific context
    if (context?.productType) {
      messages.splice(1, 0, {
        role: 'system',
        content: `Design context: Product type: ${context.productType}, Target audience: ${context.targetAudience || 'general'}`,
      } as any)
    }

    // Add retrieved documentation if available from RAG agent
    if (context?.documentContext) {
      messages.push({ role: 'system', content: `Relevant documentation:\n\n${context.documentContext}` } as any)
    }

    return this.invokeChat(messages)
  }

  /**
   * Streaming version that mirrors `process` logic but with real-time token delivery
   */
  async streamProcess(args: {
    query: string
    conversationHistory?: AssistantResponse[]
    context?: any
    onChunk: (chunk: string) => void
  }): Promise<string> {
    const { query, conversationHistory = [], context, onChunk } = args

    const messages = this.buildMessages(query, conversationHistory)

    // Add design specific context first
    if (context?.productType) {
      messages.splice(1, 0, {
        role: 'system',
        content: `Design context: Product type: ${context.productType}, Target audience: ${context.targetAudience || 'general'}`,
      } as any)
    }

    // Inject retrieved RAG documentation (handled by BaseAgent previously, but ensure not duplicated)
    if (context?.documentContext) {
      messages.push({ role: 'system', content: `Relevant documentation:\n\n${context.documentContext}` } as any)
    }

    let accumulatedContent = ''

    try {
      const stream = await this.chat.stream(messages)

      for await (const chunk of stream) {
        const content = chunk.content
        if (typeof content === 'string' && content) {
          accumulatedContent += content
          onChunk(content)
        }
      }

      return accumulatedContent
    } catch (error) {
      console.error('Error in DesignAgent streaming:', error)
      // Fallback to non-streaming logic
      return this.process({ query, conversationHistory, context })
    }
  }
}
