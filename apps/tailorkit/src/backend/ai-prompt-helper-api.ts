// PageFly-owned reference consumer proving the AI credit port end-to-end: a real text generation
// through ctx.ports.ai that deducts from the unified PageFly credit pool. NOT an upstream file.
import type { AppBackendRegisterContext } from '../../../../web/server/src/app-platform/contracts'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'

function bodyObject<T>(body: unknown): T {
  return (body && typeof body === 'object' ? body : {}) as T
}

/**
 * Registers the AI prompt-helper reference route. Uses the entitlement gatedCapability
 * (writePersonalizedProducts) so locked-tier shops are denied before any credit is spent.
 */
export function registerTailorKitAIPromptHelperApi(app: AppBackendRegisterContext): void {
  app.api.route({
    method: 'POST',
    path: '/ai/prompt-helper',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      const { topic } = bodyObject<{ topic?: string }>(request.body)
      if (!topic?.trim()) {
        return { status: 400, body: { success: false, message: 'topic required' } }
      }

      const result = await app.ports.ai.generateText(request.context, {
        prompt: `Suggest 3 short personalization prompt ideas for: ${topic.trim()}`,
        action: 'tailorkit.prompt-helper',
        maxOutputTokens: 300,
      })

      if (!result.ok) {
        const status = result.reason === 'insufficient-credits' ? 402 : result.reason === 'disabled' ? 503 : 502
        return { status, body: { success: false, reason: result.reason, message: result.message } }
      }

      return { body: { success: true, suggestions: result.text, creditsCharged: result.creditsCharged } }
    },
  })
}
