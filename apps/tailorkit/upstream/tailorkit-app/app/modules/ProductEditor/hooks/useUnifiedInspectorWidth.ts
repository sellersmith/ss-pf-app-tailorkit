import { useCallback, useEffect } from 'react'
import { useResizablePane } from '~/hooks/useResizablePane'
import { useChatBot } from '~/providers/ChatBotContext'
import {
  EXTRA_INSPECTOR_WIDTH,
  LARGE_INTEGRATION_EDITOR_INSPECTOR_WIDTH,
  SMALL_INSPECTOR_WIDTH,
} from '~/modules/TemplateEditor/constants'

/**
 * Hook to manage unified editor inspector width with chatbot-aware resizing
 * Automatically adjusts inspector width when chatbot opens/closes
 */
export function useUnifiedInspectorWidth() {
  const parsePx = useCallback((value: string) => parseInt(value.replace('px', ''), 10), [])
  const { isOpen: isChatBotOpen } = useChatBot()

  const {
    width: inspectorWidth,
    onResizeDelta,
    reset,
  } = useResizablePane({
    initialWidth: parsePx(
      isChatBotOpen
        ? `${parsePx(SMALL_INSPECTOR_WIDTH) - 40}px`
        : `${parsePx(LARGE_INTEGRATION_EDITOR_INSPECTOR_WIDTH)}px`
    ),
    minWidth: parsePx(SMALL_INSPECTOR_WIDTH),
    maxWidth: parsePx(EXTRA_INSPECTOR_WIDTH),
    storageKey: 'INTEGRATION_INSPECTOR_WIDTH',
  })

  // Reset inspector width when chatbot opens/closes
  useEffect(() => {
    reset()
  }, [reset, isChatBotOpen])

  // Handler for resizable divider (dragging right shrinks inspector)
  const onResizeInspector = useCallback(
    (deltaX: number) => {
      onResizeDelta(-deltaX)
    },
    [onResizeDelta]
  )

  return {
    inspectorWidth,
    onResizeInspector,
  }
}
