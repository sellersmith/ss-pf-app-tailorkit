import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { getScenesOfAIMockups } from '~/utils/supabase-client.server'
import { generateImages } from '../api.ai-assistant.suggestion/fns.server'
import { sanitizeMockupAspectRatio } from '~/utils/aiMockupAspectRatio'
import Shop, { getShopData } from '~/models/Shop.server'
import { checkAiCreditPerMonthExceeded, increaseAiCreditPerMonth } from '~/models/helpers/ai-credit-helpers.server'
import { considerCreditUsage } from '../api.ai-assistant/fns.server'
import { authenticate } from '~/shopify/app.server'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { uploadFiles } from '~/shopify/graphql/files/fns.server'
import OpenAI from 'openai'

/**
 * API route to get scenes of AI mockups
 * Returns scenes data from the local JSON file
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  try {
    const scenes = await getScenesOfAIMockups()

    return json(
      { scenes },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      }
    )
  } catch (error) {
    console.error('Error fetching AI mockup scenes:', error)
    return json({ scenes: [] })
  }
})

/**
 * Get generic constraints to improve mockup quality
 * Addresses common issues: large backgrounds, pattern outputs, scale problems
 *
 * Note: Uses generic constraints instead of scene-specific to avoid language-dependent
 * hardcoding. Scene names may be translated to different languages, so we use
 * universal constraints that work for all scenes.
 *
 * Constraints are intentionally flexible (no hard percentages) to allow AI model
 * to make appropriate decisions based on product type and scene context.
 */
function getSceneConstraints(): string {
  return (
    'Product should be prominently featured as the main subject. '
    + 'Maintain product scale relative to reference image. '
    + 'Focus on product visibility, minimize distracting backgrounds that overshadow the product.'
  )
}

/**
 * Use AI text model to analyze product title and generate placement constraint.
 * This avoids hardcoding product categories while ensuring realistic placement.
 *
 * @param productTitle - The product title to analyze
 * @param scene - The scene name for context
 * @returns A specific placement constraint for the image generation prompt
 */
async function analyzeProductPlacement(productTitle: string, scene: string): Promise<string> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt = [
      'You are a product placement expert.',
      'Given a product title and scene name, output a SHORT placement instruction for an AI image generator.',
      '',
      'Rules:',
      '- Analyze the product title to understand what type of product it is',
      '- Determine where this product would NATURALLY be placed/used in real life',
      '- The scene name is for atmosphere/background ONLY - it should NOT dictate placement',
      '- Output a direct, specific instruction (1-2 sentences max)',
      '- Focus on REALISTIC placement that makes physical sense',
      '',
      'Examples:',
      '- "ADIDAS STAN SMITH" + "Modern workspace" → "Place the shoes on the floor/ground level."',
      '- "Ceramic Coffee Mug" + "Golden hour adventure" → "Place the mug on a surface or held in hand."',
      '- "Christmas Ornament" + "Cozy home" → "Hang the ornament on a tree or display it on a surface."',
      '- "Leather Backpack" + "Studio minimalist" → "Place the backpack on the floor or show it being worn."',
    ].join('\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Product: "${productTitle}"\nScene: "${scene}"\n\nOutput placement instruction:`,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    })

    const placement = response.choices[0]?.message?.content?.trim()
    if (placement) {
      console.log('[AI Mockup] AI-generated placement constraint:', placement)
      return placement
    }

    return ''
  } catch (error) {
    console.error('[AI Mockup] Error analyzing product placement:', error)
    return ''
  }
}

/**
 * Build an optimized prompt for the mockup model with hard constraints.
 *
 * Based on ChatGPT's analysis for Gemini Nano Banana:
 * - Uses hard constraints to prevent product replacement/redesign
 * - Prevents pattern outputs and floating products
 * - Maintains scene creativity while locking product fidelity
 *
 * - `scene` is the background / environment description (preset).
 * - `userPrompt` is optional natural-language instruction from the user.
 * - `placementConstraint` is AI-generated instruction for realistic product placement.
 *
 * The model sees:
 * - Hard constraints to preserve exact product
 * - AI-generated placement constraint (dynamic, not hardcoded)
 * - Scene description for background creativity
 * - Generic constraints to address common issues (language-independent)
 * - Style and preservation requirements
 */
function buildMockupPrompt(args: {
  scene: string
  userPrompt?: string
  productTitle?: string
  placementConstraint?: string
}): string {
  const sceneText = args.scene?.trim() || 'simple neutral studio background'
  const sceneConstraints = getSceneConstraints()
  const variationId = Math.floor(Math.random() * 1000)
  const userPrompt = args.userPrompt?.trim()
  const placementConstraint = args.placementConstraint?.trim()

  // Use AI-generated placement constraint if available
  const productPlacement = placementConstraint ? `CRITICAL PLACEMENT RULE: ${placementConstraint}` : ''
  const userInstructions = userPrompt ? `\nUser instructions: ${userPrompt}` : ''

  return `
${productPlacement}

Use the reference image as the ONLY product.
Reproduce its exact shape, material, proportions, edges, and surface details without changing or simplifying them.
Do NOT replace it with any other type of item.

Create a realistic product photo with the design clearly visible.

Scene/atmosphere: ${sceneText}.${userInstructions}

Keep the product's original geometry precisely. No redesigning, no guessing, no substituting with similar objects.

${sceneConstraints}

Background: beautifully blurred, natural lighting.

Human interaction rules:
- For wide/full shots: show a COMPLETE person, not just floating body parts.
- For close-up shots: can zoom into the relevant body part that is naturally wearing/holding/using the product.
- NEVER show random disembodied hands or arms that appear out of nowhere without context.
Do NOT add accessories, props, or extra items that are not in the reference image.
Do NOT assume a different product category than what the reference image shows.

Creative direction #${variationId}: Vary the shot composition, camera perspective, lighting mood, and environmental details naturally.
Each generation should feel distinct while maintaining product prominence and fidelity.

High fidelity. Photorealistic. Maintain all key product details from the reference image.
`.trim()
}

/**
 * API endpoint for generating AI mockups
 * POST /api/ai-mockup-generate
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    session: { shop },
    admin,
  } = await authenticate.admin(request)

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' })
  }

  if (!shop) {
    return json({ success: false, error: 'Shop data not found' })
  }

  try {
    const body = await request.json()
    const {
      scene,
      prompt,
      referenceImageUrl,
      referenceImageData,
      numberGeneratedImages = 1,
      aspectRatio,
      productTitle,
    } = body
    const sanitizedAspectRatio = sanitizeMockupAspectRatio(aspectRatio)

    // Validate required fields (prompt is optional - only user custom input)
    if (!scene) {
      return json({ success: false, error: 'Scene is required' })
    }

    // Reference image is required for AI mockup generation
    // Can be either referenceImageUrl (URL) or referenceImageData (base64 data URL)
    if (!referenceImageUrl && !referenceImageData) {
      return json({
        success: false,
        error: 'Reference image (URL or base64 data) is required for AI mockup generation',
      })
    }

    const shopData = await getShopData(shop)

    // Check AI credit
    const creditUsage = considerCreditUsage('image') * (numberGeneratedImages || 1)
    const isAiCreditValid = shopData ? checkAiCreditPerMonthExceeded(shopData, creditUsage) : false

    if (!isAiCreditValid) {
      return json({ success: false, error: 'AI credit per month exceeded' })
    }

    // Use AI text model to analyze product and generate placement constraint
    // This dynamically determines where the product should be placed based on its type
    let placementConstraint = ''
    if (productTitle) {
      placementConstraint = await analyzeProductPlacement(productTitle, scene)
    }

    // Build final compact prompt for the image model
    const enhancedPrompt = buildMockupPrompt({
      scene: scene || '',
      userPrompt: prompt || '',
      productTitle: productTitle || '',
      placementConstraint,
    })

    // Prepare reference images: either URL or Buffer from base64 data URL
    let referenceImageUrls: string[] | undefined
    let referenceImageBuffers: Buffer[] | undefined

    if (referenceImageData) {
      // Handle base64 data URL from canvas mockup
      try {
        let base64Data = referenceImageData
        let mimeType = 'image/webp' // Default to webp for canvas exports

        // Extract MIME type from data URL prefix if present (e.g., "data:image/webp;base64,")
        if (base64Data.startsWith('data:')) {
          const base64Index = base64Data.indexOf(',')
          if (base64Index !== -1) {
            const mimeMatch = base64Data.substring(5, base64Index).match(/^([^;]+)/)
            if (mimeMatch && mimeMatch[1]) {
              mimeType = mimeMatch[1]
            }
            base64Data = base64Data.substring(base64Index + 1)
          }
        }

        // Convert base64 to Buffer
        const imageBuffer = Buffer.from(base64Data, 'base64')

        // Store buffer with metadata for proper MIME type handling
        referenceImageBuffers = [imageBuffer]

        // Log for debugging
        console.log('[AI Mockup] Using base64 reference image:', {
          mimeType,
          bufferSize: imageBuffer.byteLength,
          isValid: imageBuffer.length > 0,
        })
      } catch (error) {
        console.error('Error parsing base64 data URL:', error)
        return json({ success: false, error: 'Invalid base64 image data format' })
      }
    } else if (referenceImageUrl) {
      // Handle URL (existing behavior)
      referenceImageUrls = [referenceImageUrl]
    }

    // Generate images with reference image (URL or Buffer)
    const { success, files, error } = await generateImages({
      prompt: enhancedPrompt,
      referenceImageUrls, // URLs (if using URL)
      referenceImageBuffers, // Buffers (if using base64)
      numberGeneratedImages,
      shopDomain: shop,
      size: 'auto',
      aspectRatio: sanitizedAspectRatio,
    })

    if (!success || !files || files.length === 0) {
      return json({
        success: false,
        error: error || 'Failed to generate mockup image',
      })
    }

    // Upload generated images to Shopify
    const api = new ShopifyApiClient(admin)
    const uploadedImages = await uploadFiles({ api, files, shopDomain: shop })

    if (!uploadedImages?.uploadedFiles || uploadedImages.uploadedFiles.length === 0) {
      return json({ success: false, error: 'Failed to upload generated image' })
    }

    // Track event
    if (shopData) {
      trackEvent(shopData, EVENTS_TRACKING.BUILD_WITH_AI, {
        feature: 'ai_mockup_generation',
        scene,
        aspectRatio: sanitizedAspectRatio,
        success: true,
        mockupUrls: uploadedImages.uploadedFiles.map((f: any) => f?.image?.originalSrc),
      })
    }

    // CRITICAL: Blocking credit consumption (must succeed before returning success)
    try {
      const allocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
      await increaseAiCreditPerMonth(shop, creditUsage, 'ai_mockup', undefined, allocation)
    } catch (error: any) {
      console.error('[AI Mockup] Failed to consume credits:', error)
      return json({
        success: false,
        error: error.message?.includes('Insufficient AI credits')
          ? 'Insufficient AI credits'
          : 'Failed to process credit consumption. Please try again.',
      })
    }

    // Non-blocking flag update (fire-and-forget is OK for non-critical flag)
    Shop.updateOne(
      { shopDomain: shop, 'usages.usedGenerativeAI': { $ne: true } },
      { 'usages.usedGenerativeAI': true }
    ).catch(error => {
      console.error('[AI Mockup] Failed to update usedGenerativeAI flag:', error)
    })

    // Return first generated mockup URL (or all if multiple)
    const mockupUrls = uploadedImages.uploadedFiles.map((f: any) => f?.image?.originalSrc).filter(Boolean)

    return json({
      success: true,
      mockupUrl: mockupUrls[0],
      mockupUrls,
      creditUsage,
    })
  } catch (error) {
    console.error('Error generating AI mockup:', error)
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})
