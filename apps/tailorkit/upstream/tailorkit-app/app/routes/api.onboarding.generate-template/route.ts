/**
 * API endpoint: POST /api/onboarding/generate-template
 * Generates templates for the simplified onboarding wizard.
 * Supports 7 template types: instant (text presets) and lazy (AI-generated).
 */

import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { uuid } from '~/utils/uuid'
import {
  applyTextInputPreset,
  applyEngravingPreset,
} from '~/modules/TemplateEditor/components/Editor/utils/element-presets/text-presets'
import type { TemplateType } from '~/modules/SimplifiedOnboarding/types'

// ============================================================================
// Action handler
// ============================================================================

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request)

  const body = await request.json()
  const {
    templateType,
    productId,
    mockupResult,
    integrationId: existingIntegrationId,
  } = body as {
    templateType: TemplateType
    productId: string
    productImageUrl: string
    mockupResult: {
      processedImageUrl: string
      templatePositions: Array<{ x: number; y: number; width: number; height: number }>
      processedDimensions: { width: number; height: number }
    }
    integrationId?: string
  }

  if (!templateType || !productId || !mockupResult) {
    return json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // Generate integration ID if not provided
    const integrationId = existingIntegrationId || uuid()

    // Generate template based on type
    const templateId = uuid()
    let thumbnailUrl = ''

    switch (templateType) {
      case 'plain-custom-text': {
        // Template uses applyTextInputPreset() — text settings generated client-side
        applyTextInputPreset() // Validate preset availability
        thumbnailUrl = generatePlaceholderThumbnail(templateType)
        break
      }

      case 'debossed-custom-text': {
        // Text deboss effect: applied as text layer property using createDebossPreset()
        // + updateEmbossDirection(280) + updateEmbossDepth(45) from elements/effects/presets.ts
        // Uses inner shadows for "pressed-in" text look
        applyEngravingPreset() // Validate preset availability
        thumbnailUrl = generatePlaceholderThumbnail(templateType)
        break
      }

      case 'plain-initial':
      case 'plain-monogram': {
        // Lazy types: AI vector generation creates base SVG, no filter applied
        // In production: call AI generation → vectorize → apply as SVG image layer
        thumbnailUrl = generatePlaceholderThumbnail(templateType)
        break
      }

      case 'debossed-initial':
      case 'debossed-monogram': {
        // Lazy types: AI vector generation creates base SVG, then apply SVG path deboss filter
        // Uses debossingPreset from VectorEditor/utils/filters/pathFilterPresets.ts
        // (SVG filter primitives: feGaussianBlur + feSpecularLighting + feComposite)
        // This is DIFFERENT from text deboss — it's a vector/path filter, not inner shadows
        // In production: call AI generation → vectorize → apply debossingPreset filter → SVG image layer
        thumbnailUrl = generatePlaceholderThumbnail(templateType)
        break
      }

      case 'embossed-custom-text': {
        // Embossed text effect — rendered client-side with inner shadows
        thumbnailUrl = generatePlaceholderThumbnail(templateType)
        break
      }

      case 'laser-engraving-initial': {
        // Laser engraving initial — AI vector + laser-engraving filter
        thumbnailUrl = generatePlaceholderThumbnail(templateType)
        break
      }

      case 'hot-foil-stamping-monogram': {
        // Hot foil stamping monogram — AI vector + hot-foil-stamping filter
        thumbnailUrl = generatePlaceholderThumbnail(templateType)
        break
      }

      case 'custom-illustration':
      case 'custom-pet-portrait':
      case 'custom-person-portrait':
      case 'custom-accent-motif-pattern': {
        // Lazy image types: AI image generation creates a sample raster image
        thumbnailUrl = generatePlaceholderThumbnail(templateType)
        break
      }

      default:
        return json({ success: false, error: `Unknown template type: ${templateType}` }, { status: 400 })
    }

    return json({
      success: true,
      templateId,
      integrationId,
      thumbnailUrl,
    })
  } catch (error) {
    console.error('[generate-template] Error:', error)
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Template generation failed',
      },
      { status: 500 }
    )
  }
})

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generates a placeholder thumbnail URL for template previews.
 * In production, this would use server-side canvas rendering.
 * For now, returns a data URL with a colored placeholder.
 */
function generatePlaceholderThumbnail(templateType: TemplateType): string {
  // Map template types to descriptive placeholder identifiers
  const typeLabels: Record<TemplateType, string> = {
    'plain-custom-text': 'Plain Text',
    'embossed-custom-text': 'Embossed Text',
    'debossed-custom-text': 'Debossed Text',
    'plain-initial': 'Initial',
    'laser-engraving-initial': 'Laser Engraving Initial',
    'plain-monogram': 'Monogram',
    'debossed-monogram': 'Debossed Monogram',
    'hot-foil-stamping-monogram': 'Hot Foil Monogram',
    'custom-illustration': 'Illustration',
    'custom-pet-portrait': 'Pet Portrait',
    'custom-person-portrait': 'Person Portrait',
    'custom-accent-motif-pattern': 'Motif Pattern',
  }

  // Return a simple SVG data URL as placeholder
  const label = typeLabels[templateType] || templateType
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#f4f4f4" rx="8"/>
    <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-family="system-ui" font-size="14" fill="#666">${label}</text>
  </svg>`

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
