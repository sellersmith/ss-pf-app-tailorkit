import { useModalMessage } from './useModalMessage'
import { useTemplateDropZone } from './useTemplateDropZone'

/**
 * Custom hook for Template Editor
 *
 * @returns {void}
 */
export function useTemplateEditor() {
  /**
   * Handle modal messages from main app
   */
  useModalMessage()

  /**
   * Handle template drop zone
   */
  useTemplateDropZone()
}
