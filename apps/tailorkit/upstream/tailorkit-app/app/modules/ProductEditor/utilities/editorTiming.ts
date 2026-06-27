import { TemplateEditorStore } from '~/stores/modules/template'

export async function awaitNextPaint(): Promise<void> {
  await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())))
}

/**
 * Wait for TemplateEditorStore to have the expected template ID active.
 *
 * ✅ OPTIMIZED: Uses store subscription instead of polling (more efficient & reliable)
 *
 * This is needed during save operations to ensure the correct template is active
 * in the store after switching print areas. This is React state synchronization,
 * NOT canvas capture (which is now instant with fastCanvasCaptureBlob).
 *
 * @param expectedId - Template ID to wait for
 * @param timeoutMs - Maximum time to wait (default 3000ms)
 * @returns true if template ready, false if timeout
 */
export async function waitForTemplateReady(expectedId: string, timeoutMs = 3000): Promise<boolean> {
  // Quick check - already ready?
  const current = TemplateEditorStore.getState()
  if (current?._id === expectedId) {
    console.log('✅ Template already active:', expectedId)
    return true
  }

  console.log('⏳ Waiting for template to load:', expectedId)
  const start = performance.now()

  // Subscribe to store changes and wait for ID match (no polling!)
  return new Promise<boolean>(resolve => {
    const timeout = setTimeout(() => {
      unsubscribe()
      const duration = performance.now() - start
      const currentId = TemplateEditorStore.getState()?._id
      console.warn(
        `❌ Template load timeout after ${duration.toFixed(0)}ms (expected: ${expectedId}, current: ${currentId})`
      )
      resolve(false)
    }, timeoutMs)

    const unsubscribe = TemplateEditorStore.subscribe(() => {
      const state = TemplateEditorStore.getState()
      if (state?._id === expectedId) {
        clearTimeout(timeout)
        unsubscribe()
        const duration = performance.now() - start
        console.log(`✅ Template loaded in ${duration.toFixed(1)}ms`)
        resolve(true)
      }
    })
  })
}

/**
 * Poll TemplateEditorStore until the canvas is ready for capture (stageRef + dimensions exist) or timeout.
 */
export async function waitForCanvasReady(expectedId: string, timeoutMs = 3000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const current = TemplateEditorStore.getState()
    if (
      current?._id === expectedId
      && current.stageRef?.current
      && current.dimension?.width
      && current.dimension?.height
    ) {
      return true
    }
    await awaitNextPaint()
  }
  return false
}
