import { AI_IMAGE_EDIT_LIMITS, type AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'

/**
 * Sanitize incoming aspect ratio for AI mockup generation.
 * Ensures we only pass supported ratios to the image model.
 *
 * @param value - Unknown input from request body.
 * @returns A validated aspect ratio from the allowed list.
 */
export function sanitizeMockupAspectRatio(value: unknown): AllowedAspectRatio {
  if (typeof value === 'string' && AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS.includes(value as AllowedAspectRatio)) {
    return value as AllowedAspectRatio
  }

  return AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS[0]
}
