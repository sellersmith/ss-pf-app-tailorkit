import type { ChatInvoker } from './ProductIntentAnalyzer'

export interface ClarificationContext {
  productType?: string
  targetAudience?: string
  occasion?: string
  style?: string
  currentStep: number
  isComplete: boolean
}

export interface ClarificationResult {
  shouldContinue: boolean
  nextQuestion?: string
  extractedInfo?: Partial<ClarificationContext>
  response: string
}

/**
 * Service responsible for managing the clarification flow when users
 * have onboarding intent but lack sufficient context for product creation
 */
export class ProductClarificationService {
  // eslint-disable-next-line no-useless-constructor
  constructor(private chatInvoker: ChatInvoker) {}

  /**
   * The four clarification questions to gather product context
   */
  private readonly clarificationQuestions = [
    'What type of product are you making?',
    'Who is it for?',
    "What's the occasion?",
    'Any preferred style or mood?',
  ]

  /**
   * Analyzes user response to extract relevant information
   */
  async analyzeUserResponse(userResponse: string, currentContext: ClarificationContext): Promise<ClarificationResult> {
    const analysisPrompt = `Analyze this user response for product clarification: "${userResponse}"

Current context:
- Product type: ${currentContext.productType || 'unknown'}
- Target audience: ${currentContext.targetAudience || 'unknown'} 
- Occasion: ${currentContext.occasion || 'unknown'}
- Style: ${currentContext.style || 'unknown'}
- Current step: ${currentContext.currentStep}

TASK: Extract any relevant product information from the user's response.

OUTPUT FORMAT (JSON):
{
  "productType": "extracted product type or null",
  "targetAudience": "extracted audience info or null", 
  "occasion": "extracted occasion info or null",
  "style": "extracted style/mood info or null",
  "hasUsefulInfo": boolean
}

RULES:
- Only extract information that is clearly stated or strongly implied
- Product type: t-shirt, mug, phone case, poster, hoodie, etc.
- Target audience: age group, profession, relationship (kids, gamers, mom, etc.)
- Occasion: birthday, Christmas, graduation, business, etc.
- Style: funny, professional, cute, minimalist, colorful, etc.
- Set hasUsefulInfo to true if any meaningful information was extracted

EXAMPLES:
"I want a t-shirt" → {"productType": "t-shirt", "targetAudience": null, "occasion": null, "style": null, "hasUsefulInfo": true}
"For my mom's birthday" → {"productType": null, "targetAudience": "mom", "occasion": "birthday", "style": null, "hasUsefulInfo": true}
"Something funny and colorful" → {"productType": null, "targetAudience": null, "occasion": null, "style": "funny and colorful", "hasUsefulInfo": true}
"I don't know" → {"productType": null, "targetAudience": null, "occasion": null, "style": null, "hasUsefulInfo": false}

Return only valid JSON.`

    try {
      const response = await this.chatInvoker.invokeChat(this.chatInvoker.buildMessages(analysisPrompt))

      const parsed = JSON.parse(response.trim())
      const extractedInfo: Partial<ClarificationContext> = {}

      // Only update fields that have new information
      if (parsed.productType) extractedInfo.productType = parsed.productType
      if (parsed.targetAudience) extractedInfo.targetAudience = parsed.targetAudience
      if (parsed.occasion) extractedInfo.occasion = parsed.occasion
      if (parsed.style) extractedInfo.style = parsed.style

      const updatedContext = { ...currentContext, ...extractedInfo }
      const hasUsefulInfo = Boolean(parsed.hasUsefulInfo)

      return this.determineNextStep(userResponse, updatedContext, hasUsefulInfo)
    } catch (error) {
      console.error('ProductClarificationService: analysis failed:', error)
      // Fallback: continue with next question
      return this.determineNextStep(userResponse, currentContext, false)
    }
  }

  /**
   * Determines the next step in the clarification flow
   */
  private determineNextStep(
    userResponse: string,
    context: ClarificationContext,
    hasUsefulInfo: boolean
  ): ClarificationResult {
    // Check if we have sufficient information to proceed
    const isComplete = this.hasMinimumContext(context)

    if (isComplete) {
      return {
        shouldContinue: false,
        response:
          'Perfect! I have enough information to help you create your personalized product. Let me find some great options for you.',
        extractedInfo: context,
      }
    }

    // If user provided useful info, acknowledge it and ask next question
    if (hasUsefulInfo) {
      const nextStep = context.currentStep + 1
      const acknowledgment = this.generateAcknowledgment(context)
      const nextQuestion = this.getNextQuestion(nextStep, context)

      if (nextQuestion) {
        return {
          shouldContinue: true,
          nextQuestion,
          response: `${acknowledgment} ${nextQuestion}`,
          extractedInfo: { ...context, currentStep: nextStep },
        }
      }
    }

    // If user didn't provide useful info or we're at the end, ask remaining questions
    const remainingQuestions = this.getRemainingQuestions(context)
    if (remainingQuestions.length > 0) {
      return {
        shouldContinue: true,
        nextQuestion: remainingQuestions[0],
        response: `I'd like to learn more to give you the best recommendations. ${remainingQuestions[0]}`,
        extractedInfo: { ...context, currentStep: Math.max(context.currentStep, 1) },
      }
    }

    // Fallback: proceed with what we have
    return {
      shouldContinue: false,
      response:
        "Thanks for the information! Let me help you create a personalized product based on what you've told me.",
      extractedInfo: context,
    }
  }

  /**
   * Checks if we have minimum context to proceed with product recommendation
   */
  private hasMinimumContext(context: ClarificationContext): boolean {
    // We need at least product type OR (audience + occasion/style)
    return !!(context.productType || (context.targetAudience && (context.occasion || context.style)))
  }

  /**
   * Generates acknowledgment message based on current context
   */
  private generateAcknowledgment(context: ClarificationContext): string {
    const info = []
    if (context.productType) info.push(`a ${context.productType}`)
    if (context.targetAudience) info.push(`for ${context.targetAudience}`)
    if (context.occasion) info.push(`for ${context.occasion}`)
    if (context.style) info.push(`with ${context.style} style`)

    if (info.length > 0) {
      return `Great! So you want ${info.join(' ')}.`
    }
    return 'Thanks for that information!'
  }

  /**
   * Gets the next logical question based on current context
   */
  private getNextQuestion(step: number, context: ClarificationContext): string | null {
    // Smart questioning: ask most relevant next question
    if (!context.productType && step <= 4) {
      return this.clarificationQuestions[0]
    }
    if (!context.targetAudience && step <= 4) {
      return this.clarificationQuestions[1]
    }
    if (!context.occasion && step <= 4) {
      return this.clarificationQuestions[2]
    }
    if (!context.style && step <= 4) {
      return this.clarificationQuestions[3]
    }
    return null
  }

  /**
   * Gets remaining unanswered questions
   */
  private getRemainingQuestions(context: ClarificationContext): string[] {
    const remaining = []
    if (!context.productType) remaining.push(this.clarificationQuestions[0])
    if (!context.targetAudience) remaining.push(this.clarificationQuestions[1])
    if (!context.occasion) remaining.push(this.clarificationQuestions[2])
    if (!context.style) remaining.push(this.clarificationQuestions[3])
    return remaining
  }

  /**
   * Starts the clarification flow with an appropriate opening question
   */
  startClarificationFlow(initialQuery: string): ClarificationResult {
    return {
      shouldContinue: true,
      nextQuestion: this.clarificationQuestions[0],
      response: `I'd love to help you create a personalized product! To give you the best recommendations, ${this.clarificationQuestions[0]}`,
      extractedInfo: {
        currentStep: 1,
        isComplete: false,
      },
    }
  }
}
