import { APP_PROXY_PATH } from '../constants'
import { STORE_FRONT_ACTION } from '../constants/app-actions'
import { fetchWithAdminContext } from '../libraries/fetchWithAdminContext'
import { sessionStorage } from './sessionStorage'

const AI_CREDITS_CACHE_KEY = 'tlk_ai_credits_available'

/**
 * Check if shop has available AI credits via the storefront proxy API.
 * Result is cached in sessionStorage for the duration of the browser session.
 */
export async function checkAiCreditsAvailable(): Promise<boolean> {
  try {
    const cached = sessionStorage.getItem(AI_CREDITS_CACHE_KEY)
    if (cached !== null) {
      return cached === 'true'
    }

    const url = `${APP_PROXY_PATH}/app_proxy/storefront`
    const response = await fetchWithAdminContext(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: STORE_FRONT_ACTION.CHECK_AI_CREDITS_STATUS }),
    })

    const data = await response.json()
    const available = data?.aiCreditsAvailable ?? true

    sessionStorage.setItem(AI_CREDITS_CACHE_KEY, String(available))
    return available
  } catch {
    // If the check fails, default to allowing AI features
    return true
  }
}

/**
 * Clear the cached AI credits status (e.g., after a purchase).
 */
export function clearAiCreditsCache(): void {
  sessionStorage.removeItem(AI_CREDITS_CACHE_KEY)
}

/**
 * Mark AI credits as exhausted in the session cache.
 * Called when generation API returns AI_CREDITS_EXHAUSTED error.
 */
export function markAiCreditsExhausted(): void {
  sessionStorage.setItem(AI_CREDITS_CACHE_KEY, 'false')
}

/**
 * Hide all AI generation UI elements in the storefront.
 * If a fieldset only contains the AI image generator (no upload button),
 * hide the entire fieldset since it would be empty without AI.
 */
export function hideAiGenerationUI(): void {
  // Hide AI image generation containers
  const imageGenerators = document.querySelectorAll('tailorkit-ai-image-generator')
  imageGenerators.forEach(el => {
    ;(el as HTMLElement).style.display = 'none'

    // If the parent fieldset has no upload button, hide the entire fieldset
    const fieldset = el.closest('fieldset')
    if (fieldset && !fieldset.querySelector('.emtlkit-button--upload')) {
      ;(fieldset as HTMLElement).style.display = 'none'
    }
  })

  // Hide AI text generation buttons
  const textGenerators = document.querySelectorAll('.emtlkit--generate-text-with-ai')
  textGenerators.forEach(el => {
    ;(el as HTMLElement).style.display = 'none'
  })
}
