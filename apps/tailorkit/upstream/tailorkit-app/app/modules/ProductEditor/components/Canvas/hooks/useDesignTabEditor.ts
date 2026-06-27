import { useTemplateEditor } from '~/modules/TemplateEditor/hooks'
import { useTemplateInitialization } from './useTemplateInitialization'
import { useTemplateEnvAdapter } from './useTemplateEnvAdapter'
import { useTemplateDiscardHandler } from './useTemplateDiscardHandler'
import type { VariantIntegration } from '~/types/integration'

interface UseDesignTabEditorParams {
  mockupId: string
  printAreaId: string
  templateId: string
  targetPrintArea: any
  viewId: string
  shouldSetPrintAreaFromTemplate: boolean
  shouldSetViewId: boolean
  activeVariant: VariantIntegration | null
}

/**
 * Unified hook for Design Tab Editor
 *
 * Composes all template editor hooks needed for the Design tab in unified editor:
 * - Template environment adapter (declares unified context)
 * - Print area URL synchronization
 * - Template initialization with requestAnimationFrame
 * - Template editor behavior (dropzone, modal messages)
 * - Discard handling
 *
 * This keeps the component clean with a single hook call.
 */
export function useDesignTabEditor(params: UseDesignTabEditorParams) {
  const { mockupId, printAreaId, templateId, targetPrintArea, activeVariant } = params

  // Set adapter to declare unified editor context to stores
  useTemplateEnvAdapter({
    mockupId,
    printAreaId: targetPrintArea?._id || '',
    templateId,
    enabled: Boolean(mockupId && targetPrintArea?._id),
  })

  // Initialize template editor
  useTemplateInitialization({
    targetPrintArea,
    printAreaId,
    activeVariant,
    enabled: Boolean(targetPrintArea),
  })

  // Handle template editor hooks (keyboard shortcuts, dropzone, modal messages)
  useTemplateEditor()

  // Re-initialize template when unified discard completes
  useTemplateDiscardHandler({
    mockupId,
    printAreaId,
  })
}
