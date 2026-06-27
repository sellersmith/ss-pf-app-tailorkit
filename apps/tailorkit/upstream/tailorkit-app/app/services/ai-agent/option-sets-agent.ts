import { z } from 'zod'
import type { OutputGuardrail } from '@openai/agents'
import { Agent, run, tool, OutputGuardrailTripwireTriggered, InputGuardrailTripwireTriggered } from '@openai/agents'
import Template from '~/models/Template.server'
import Layer from '~/models/Layer.server'
import OptionSet from '~/models/OptionSet.server'

// Define the schema for the recommendation response
const RecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      optionSetId: z.string(),
      optionType: z.string(),
      label: z.string(),
      recommendedValue: z.string(),
      fontFamily: z.string(), // For font_option: the font family name (empty string if not applicable)
      fontSrc: z.string(), // For font_option: the font source URL (empty string if not applicable)
      reason: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  textRecommendations: z.array(
    z.object({
      layerId: z.string(),
      layerType: z.string(),
      label: z.string(),
      currentContent: z.string(),
      recommendedContent: z.string(),
      reason: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  summary: z.string(),
  userIntent: z.string(),
})

// Tool to get option sets from a template
const getOptionSetsTool = tool({
  name: 'get_option_sets',
  description: 'Get all available option sets for a given template ID and shop domain',
  parameters: z.object({
    templateId: z.string().describe('The template ID to get option sets for'),
    shopDomain: z.string().describe('The shop domain to search in'),
  }),
  execute: async input => {
    try {
      console.log(`🔍 Fetching option sets for template: ${input.templateId} in shop: ${input.shopDomain}`)

      // Get template with populated layers and option sets
      const template = await Template.findOne({
        _id: input.templateId,
        shopDomain: input.shopDomain,
        deletedAt: null,
      })
        .populate({
          path: 'layers',
          model: Layer,
          match: { deletedAt: null },
          populate: {
            path: 'optionSet',
            model: OptionSet,
          },
        })
        .lean()

      if (!template) {
        return {
          success: false,
          error: 'Template not found',
          optionSets: [],
        }
      }

      // Extract all option sets from all layers and prepare layer data
      const optionSets: any[] = []
      const optionSetIds = new Set<string>()
      const layers: any[] = []

      const templateData = template as any
      if (templateData.layers && Array.isArray(templateData.layers)) {
        templateData.layers.forEach((layer: any) => {
          // Prepare layer data
          const layerData = {
            _id: layer._id,
            type: layer.type,
            label: layer.label,
            visible: layer.visible,
            settings: layer.settings || {},
            templateId: layer.templateId,
            // For text layers, include the content
            ...(layer.type === 'text' && layer.settings
              ? {
                  textContent: layer.settings.content || '',
                  textCreatedBy: layer.settings.textCreatedBy || 'merchant',
                  characterLimit: layer.settings.characterLimit || 50,
                }
              : {}),
          }

          layers.push(layerData)

          // Extract option sets from layer
          if (layer.optionSet && Array.isArray(layer.optionSet)) {
            layer.optionSet.forEach((optionSet: any) => {
              if (optionSet && !optionSetIds.has(optionSet._id)) {
                optionSetIds.add(optionSet._id)
                optionSets.push({
                  _id: optionSet._id,
                  label: optionSet.label,
                  labelOnStoreFront: optionSet.labelOnStoreFront,
                  type: optionSet.type,
                  data: optionSet.data,
                  values: optionSet.values,
                  layerId: layer._id,
                  layerType: layer.type,
                  layerName: layer.label || `Layer ${layer._id}`,
                })
              }
            })
          }
        })
      }

      console.log(
        `✅ Found ${optionSets.length} option sets and ${layers.length} layers for template ${input.templateId}`
      )

      return {
        success: true,
        templateId: input.templateId,
        templateName: templateData.name,
        layers,
        optionSets,
        totalLayers: layers.length,
        totalOptionSets: optionSets.length,
      }
    } catch (error: any) {
      console.error('❌ Error fetching option sets:', error)
      return {
        success: false,
        error: error.message,
        optionSets: [],
      }
    }
  },
})

// Output guardrail to validate recommendations match actual option sets
const validateRecommendationsGuardrail: OutputGuardrail<typeof RecommendationSchema> = {
  name: 'ValidateRecommendationsGuardrail',
  async execute({ agentOutput, context }) {
    console.log('🛡️ Running output guardrail to validate recommendations...')

    try {
      const recommendations = agentOutput.recommendations

      // Check if we have any recommendations
      if (!recommendations || recommendations.length === 0) {
        return {
          outputInfo: { error: 'No recommendations provided' },
          tripwireTriggered: true,
        }
      }

      // Validate each recommendation has required fields
      for (const rec of recommendations) {
        if (!rec.optionSetId || !rec.optionType || !rec.recommendedValue) {
          return {
            outputInfo: {
              error: `Invalid recommendation: missing required fields`,
              recommendation: rec,
            },
            tripwireTriggered: true,
          }
        }

        // Check confidence is between 0 and 1
        if (rec.confidence < 0 || rec.confidence > 1) {
          return {
            outputInfo: {
              error: `Invalid confidence score: ${rec.confidence}. Must be between 0 and 1`,
              recommendation: rec,
            },
            tripwireTriggered: true,
          }
        }
      }

      // Validate that optionSetIds look like actual MongoDB ObjectIds (24 hex chars)
      const validObjectIdPattern
        = /^[0-9a-fA-F]{24}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      for (const rec of recommendations) {
        if (!validObjectIdPattern.test(rec.optionSetId)) {
          return {
            outputInfo: {
              error: `Invalid optionSetId format: ${rec.optionSetId}. Should be a valid ObjectId or UUID`,
              recommendation: rec,
            },
            tripwireTriggered: true,
          }
        }
      }

      console.log('✅ Guardrail passed: All recommendations are valid')
      return {
        outputInfo: {
          status: 'valid',
          recommendationCount: recommendations.length,
        },
        tripwireTriggered: false,
      }
    } catch (error: any) {
      console.error('❌ Guardrail validation error:', error)
      return {
        outputInfo: { error: `Validation failed: ${error.message}` },
        tripwireTriggered: true,
      }
    }
  },
}

// Create the recommendation agent - outputType forces JSON structure
const optionSetsAgent = new Agent({
  name: 'OptionSetsRecommendationAgent',
  instructions: `You are a product personalization assistant for print-on-demand products.

1. Use the get_option_sets tool to fetch available option sets AND layers for the template
2. For each option set found, provide a recommendation based on the user's request
3. For each text layer where textCreatedBy="customers", generate text content recommendations
4. Pick actual values from the option set data:
   - For color_option: Pick from data.colors array (use the "value" property like "rgb(0, 0, 0)")
   - For font_option: Pick from data.fonts array - INCLUDE BOTH:
     * recommendedValue: use the "family" property (like "Abril Fatface")
     * fontFamily: use the "family" property (like "Abril Fatface")
     * fontSrc: use the "src" property (the font URL like "https://fonts.gstatic.com/...")
   - For non-font options: Set fontFamily and fontSrc to empty strings ""
   - For text_option: Generate appropriate text
   - For image_option: Pick from data.options array (use the "value" property - the full image URL)
5. For IMAGE OPTIONS - Provide enhanced, detailed reasoning:
   - ANALYZE each available image option by examining the filename/URL for clues about appearance
   - DESCRIBE the visual characteristics (e.g., skin tone, pose, style, expression)
   - EXPLAIN why this specific image fits the user's request better than others
   - CONNECT the image choice to design benefits (contrast, readability, aesthetic appeal)
   - CONSIDER user demographics, preferences, and intended message
   - FORMAT: "Selected [image_name] which features [visual description].
   This choice provides [design benefits] while [user intent alignment].
   The [specific qualities] work well for [context/use case]."
   - EXAMPLE: "Selected 'women_3_Body_Body_Skin_1.png' which features a lighter, warm skin tone with natural complexion.
   This choice provides better contrast for text overlay and versatile color combinations while maintaining inclusive representation.
   The neutral pose and clean appearance work well for heartfelt personalized gifts."
6. For text content recommendations:
   - Generate text that fits the user's request and the layer's characterLimit
   - Must check the character limit of the input text layer which is available in the response of get_option_sets tool
   - Consider the current textContent as context
   - Make it relevant for print-on-demand products (t-shirts, mugs, etc.)
7. Use the exact optionSet._id, optionSet.type, and optionSet.label from the fetched data
8. Use the exact layer._id, layer.type, and layer.label for text recommendations`,
  tools: [getOptionSetsTool],
  outputType: RecommendationSchema,
  outputGuardrails: [validateRecommendationsGuardrail],
  model: 'gpt-4o',
})

// Main function to run the agent
export async function getOptionSetsRecommendations(
  templateId: string,
  shopDomain: string,
  userInput: string
): Promise<z.infer<typeof RecommendationSchema>> {
  try {
    console.log('🤖 Starting OptionSets Recommendation Agent...')
    console.log(`📋 Template ID: ${templateId}`)
    console.log(`🏪 Shop Domain: ${shopDomain}`)
    console.log(`💬 User Input: "${userInput}"`)
    console.log('='.repeat(60))

    const prompt = `TEMPLATE_ID: ${templateId}
SHOP_DOMAIN: ${shopDomain}
USER_REQUEST: "${userInput}"

EXECUTE THESE STEPS:
1. Call get_option_sets(templateId: "${templateId}", shopDomain: "${shopDomain}")
2. For each option set returned, create ONE recommendation
3. For each text layer where textCreatedBy="customers", create ONE text content recommendation
4. Return ONLY JSON in RecommendationSchema format

RESPONSE FORMAT REQUIRED:
{
  "recommendations": [/* array of option set recommendations */],
  "textRecommendations": [/* array of text content recommendations */],
  "summary": "Brief summary of all selections including text content",
  "userIntent": "${userInput}"
}

EXAMPLE FONT RECOMMENDATION:
{
  "optionSetId": "uuid-from-option-set",
  "optionType": "font_option",
  "label": "Font Option Set Label",
  "recommendedValue": "Abril Fatface",
  "fontFamily": "Abril Fatface",
  "fontSrc": "https://fonts.gstatic.com/s/abrilfatface/v23/zOL64pLDlL1D99S8g8PtiKchm-BsjOLhZBY.woff2",
  "reason": "Explanation why this font fits the request",
  "confidence": 0.9
}

EXAMPLE TEXT RECOMMENDATION:
{
  "layerId": "layer-uuid",
  "layerType": "text",
  "label": "Text Layer Name",
  "currentContent": "Current text content",
  "recommendedContent": "New suggested text based on user request",
  "reason": "Why this text fits the user's request",
  "confidence": 0.85
}

NO TEXT EXPLANATIONS. ONLY JSON RESPONSE.`

    const result = await run(optionSetsAgent, prompt)

    console.log('🎯 Agent Recommendations:')
    console.log('='.repeat(60))
    console.log(JSON.stringify(result.finalOutput, null, 2))
    console.log('='.repeat(60))

    return result.finalOutput as z.infer<typeof RecommendationSchema>
  } catch (error: any) {
    if (error instanceof OutputGuardrailTripwireTriggered) {
      console.error('🛡️ Output guardrail failed:', error.message)
      console.error('📋 Guardrail details:', error)

      // Return a fallback response when guardrail fails
      return {
        recommendations: [],
        textRecommendations: [],
        summary: `Guardrail validation failed: ${error.message}`,
        userIntent: userInput,
      }
    }

    if (error instanceof InputGuardrailTripwireTriggered) {
      console.error('🛡️ Input guardrail failed:', error.message)

      // Return a fallback response when input guardrail fails
      return {
        recommendations: [],
        textRecommendations: [],
        summary: `Input validation failed: ${error.message}`,
        userIntent: userInput,
      }
    }

    console.error('❌ Error running OptionSets agent:', error)
    console.error('❌ This might be because the agent returned text instead of JSON')

    // Return a fallback response for any other error
    return {
      recommendations: [],
      textRecommendations: [],
      summary: `Agent failed to return proper JSON format. Error: ${error.message}`,
      userIntent: userInput,
    }
  }
}

// Export the agent for potential reuse
export { optionSetsAgent, getOptionSetsTool, RecommendationSchema }
