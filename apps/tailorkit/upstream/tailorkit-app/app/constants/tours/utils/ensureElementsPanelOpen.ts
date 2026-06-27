import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { ensureDesignTab } from './ensureDesignTab'

/**
 * Ensures the Elements tool sidebar panel is open before a tour step mounts.
 * Uses the Transmitter event bus to trigger the panel toggle in the Navigation component.
 */
export async function ensureElementsPanelOpen(): Promise<void> {
  if (typeof window === 'undefined') return

  await ensureDesignTab()

  Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, {
    toolId: 'elements',
  })

  // Wait for panel animation
  await new Promise(resolve => setTimeout(resolve, 300))
  await new Promise(resolve => requestAnimationFrame(resolve))
}
