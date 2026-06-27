/**
 * Screenshot analysis tool for Elva AI.
 * Uses GPT-4o vision to analyze merchant screenshots from Crisp or in-app chat.
 */

import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/** Rate limiter: conversationId → { count, resetAt } */
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const MAX_IMAGES_PER_HOUR = 5
const ONE_HOUR_MS = 60 * 60 * 1000

/** Vision model — GPT-4o supports image_url in content */
const VISION_MODEL = 'gpt-4o'

const VISION_SYSTEM_PROMPT = [
  'You are analyzing a screenshot from a Shopify merchant using TailorKit (a product personalizer app).',
  'Describe what you see, focusing on:',
  '- Template editor state (layers, elements, canvas)',
  '- Storefront rendering (product page, customizer widget)',
  '- Error messages or warnings',
  '- Shopify admin settings (app embeds, theme editor)',
  'Be specific and actionable. If you see an error, explain what it means.',
  'Keep response under 200 words.',
].join('\n')

/** Check if image URL is valid HTTPS with image extension or content type */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
    const hasImageExt = imageExts.some(ext => parsed.pathname.toLowerCase().endsWith(ext))
    const hasImageParam = parsed.pathname.includes('image') || parsed.hostname.includes('crisp')
    return hasImageExt || hasImageParam
  } catch {
    return false
  }
}

/** Check rate limit for a conversation. Returns true if allowed. */
function checkRateLimit(conversationId: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(conversationId)

  if (!entry || now >= entry.resetAt) {
    rateLimits.set(conversationId, { count: 1, resetAt: now + ONE_HOUR_MS })
    return true
  }

  if (entry.count >= MAX_IMAGES_PER_HOUR) return false
  entry.count++
  return true
}

/**
 * Analyze a screenshot using GPT-4o vision.
 * Returns a text description focused on TailorKit context.
 */
export async function analyzeScreenshot(imageUrl: string, question?: string, conversationId?: string): Promise<string> {
  // Rate limit check
  if (conversationId && !checkRateLimit(conversationId)) {
    return 'Screenshot analysis limit reached (5 per hour). Please describe the issue in text instead.'
  }

  // Validate URL
  if (!isValidImageUrl(imageUrl)) {
    return 'Invalid image URL. Please send a screenshot as a PNG or JPG image.'
  }

  try {
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
    ]

    if (question) {
      userContent.push({ type: 'text', text: `Merchant's question: ${question}` })
    }

    const response = await openai.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 500,
      temperature: 0.2,
    })

    return response.choices[0]?.message?.content || 'Unable to analyze the screenshot.'
  } catch (error: unknown) {
    console.error('[analyze-screenshot] Vision API error:', error instanceof Error ? error.message : 'Unknown error')
    return 'Failed to analyze screenshot. Please describe what you see in text.'
  }
}
