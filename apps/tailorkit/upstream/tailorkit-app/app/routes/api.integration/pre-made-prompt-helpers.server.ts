import { AssistantService } from '~/libs/openai/assistant.service'
import type { VariantIntegration as VariantIntegrationType } from '~/types/integration'
import type { Template } from '~/types/psd'
import { formatErrorMessage } from '~/utils/formatErrorMessage'

/**
 * Generates AI-powered pre-made prompts for each unique mockup by analyzing
 * template preview images, returning a map of mockup ID to generated prompt text.
 */
export const preparePreMadePrompt = async (variants: VariantIntegrationType[]): Promise<Record<string, string>> => {
  // Group variant by mockup first
  const variantsGroupByMockup: Record<string, VariantIntegrationType> = {}

  for (const variant of variants) {
    const { mockup } = variant
    if (!mockup) continue

    if (variantsGroupByMockup[mockup._id]) {
      continue
    }

    variantsGroupByMockup[mockup._id] = variant
  }

  const previewUrlByMockup: Record<string, string[]> = {}

  // Get all option sets from mockup.template.layers.optionSets
  for (const mockupId of Object.keys(variantsGroupByMockup)) {
    const { printAreas } = variantsGroupByMockup[mockupId]

    if (!printAreas) continue

    const previewUrls = printAreas
      .map(printArea => printArea.template)
      .filter((template): template is Template => typeof template === 'object' && template !== null)
      .map(template => (template?.previewUrl?.includes('https://') ? template?.previewUrl : ''))

    previewUrlByMockup[mockupId] = previewUrls.filter(url => !!url)
  }

  const systemPrompt = [
    // eslint-disable-next-line max-len
    'You are an expert Prompt Generation AI Assistant tasked with creating clear, concise, and engaging premade prompts to help users easily customize their products.',
    // eslint-disable-next-line max-len
    'Given one or more images provided by the user, analyze the visual content deeply, considering the style, theme, subject matter, target audience, and overall emotional tone. ',
    'Based on this analysis, generate a structured premade prompt in the following format:',
    '"Help me create a product for [target audience or individual description] with a [adjective describing visual style or vibe] style.',
    'Guidelines for creating the premade prompt:',
    '- Clearly define the target audience or individual likely to be interested in the product (e.g., "a child," "a young woman," "a pet lover").',
    '- Extract a prominent theme or interest from the provided images (e.g., minimalism, animals, fantasy).',
    '- Identify a descriptive adjective for the visual style or emotional tone (e.g., playful, elegant, whimsical).',
    '- Ensure the output is concise, appealing, and directly relevant to the provided visuals.',
    'Your goal is to simplify user interaction by providing ready-made prompts, enabling users to effortlessly initiate product personalization.',
  ].join('\n\n')

  const assistant = new AssistantService({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
    temperature: 2,
    maxTokens: 2000,
    systemMessage: systemPrompt,
  })

  const preMadePrompts: Record<string, string> = {}

  for (const mockupId of Object.keys(previewUrlByMockup)) {
    const previewUrls = previewUrlByMockup[mockupId]

    if (!previewUrls) continue

    try {
      const preMadePrompt = await assistant.generatePreMadePrompt(previewUrls)

      preMadePrompts[mockupId] = preMadePrompt
    } catch (e) {
      console.error(formatErrorMessage(e))

      // Continue anyway, we don't want to block the integration process
      continue
    }
  }

  return preMadePrompts
}
