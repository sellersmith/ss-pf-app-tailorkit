import { ensureDesignTab } from './ensureDesignTab'

const MAX_WAIT_MS = 10_000

/**
 * Ensures the canvas editor element has non-zero dimensions before a tour step mounts.
 * Konva Stage containers may exist in the DOM but have 0x0 dimensions until initialization completes.
 * This polls until the element is both present and has real layout dimensions.
 */
export async function ensureCanvasReady(): Promise<void> {
  if (typeof window === 'undefined') return

  await ensureDesignTab()

  await new Promise<void>(resolve => {
    const startTime = Date.now()

    const check = () => {
      const el = document.querySelector('#canvas-editor')
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          resolve()
          return
        }
      }

      if (Date.now() - startTime > MAX_WAIT_MS) {
        resolve() // Give up after timeout, let the tour render anyway
        return
      }

      requestAnimationFrame(check)
    }

    requestAnimationFrame(check)
  })

  // Extra frame to ensure paint is complete
  await new Promise(resolve => requestAnimationFrame(resolve))
}
