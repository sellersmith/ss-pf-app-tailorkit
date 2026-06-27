import { EDITOR_TABS } from '~/modules/ProductEditor/constants'
import { getEditorParamsStore } from '~/modules/ProductEditor/hooks/useEditorParams'

/**
 * Ensures the editor is on the Design tab before a tour step mounts.
 * Automatically switches from Mockup/Preview to Design if needed.
 *
 * @returns Promise that resolves when tab switch completes
 * @throws Error if tab switch fails (e.g., store import fails or dispatch fails)
 */
export async function ensureDesignTab(): Promise<void> {
  if (typeof window === 'undefined') return

  const currentParams = new URLSearchParams(window.location.search)
  const currentTab = currentParams.get('tab')

  if (currentTab === EDITOR_TABS.DESIGN || !currentTab) {
    return // Already on Design tab or no tab param
  }

  try {
    // Dynamically import to avoid circular dependencies
    const store = getEditorParamsStore()

    if (!store) {
      throw new Error('Editor params store not available')
    }

    // Switch to Design tab
    store.dispatch({ type: 'SET_TAB', payload: EDITOR_TABS.DESIGN })

    // Wait for tab transition animation to complete
    // DesignMockupPreviewTabs enforces minimum 200ms delay
    await new Promise(resolve => setTimeout(resolve, 250))

    // Wait for React render cycle to complete
    await new Promise(resolve => requestAnimationFrame(resolve))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ensureDesignTab] Failed to switch tab:', error)
    // Re-throw to allow tour system to handle the error
    throw new Error(`Failed to switch to Design tab: ${errorMessage}`)
  }
}
