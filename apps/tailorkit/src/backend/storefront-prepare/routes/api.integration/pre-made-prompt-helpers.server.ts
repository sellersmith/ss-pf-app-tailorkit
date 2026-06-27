import type { VariantIntegration as VariantIntegrationType } from '../../types/integration'

/**
 * AI pre-made prompt generation (upstream calls OpenAI AssistantService). The TailorKit AI server is
 * not ported into PageFly app-platform yet, so this is a no-op stub: the publisher always passes an
 * empty pre-made-prompt map and never invokes this. Restore the upstream OpenAI implementation when
 * the AI server port lands. Signature kept identical for the re-export in preparation-fns.
 */
export const preparePreMadePrompt = async (
  _variants: VariantIntegrationType[]
): Promise<Record<string, string>> => {
  return {}
}
