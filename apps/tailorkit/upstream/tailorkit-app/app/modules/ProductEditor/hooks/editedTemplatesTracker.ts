// Session-scoped tracker for edited templates in the unified editor
// Stores the most recent mockup/printArea context AND full template snapshot for each templateId

import type { LayerDocument } from '~/models/Layer.server'
import type { TemplateEditor } from '~/stores/modules/template'

type EditedTemplateContext = {
  templateId: string
  mockupId: string
  printAreaId: string
}

type TemplateSnapshot = {
  layersState: LayerDocument[]
  templateEditor: TemplateEditor
  previewUrl: string
  thumbnailUrl?: string
}

const templateIdToContext = new Map<string, EditedTemplateContext>()
const templateIdToSnapshot = new Map<string, TemplateSnapshot>()
// Track print areas that have been marked to prevent duplicate marking
const printAreaIdToTemplateId = new Map<string, string>()
let isSavingInProgress = false

export function markEditedTemplate(templateId: string, mockupId: string, printAreaId: string): boolean {
  if (!templateId || !mockupId || !printAreaId) return false
  // Don't track edits during save loop to avoid re-marking templates being saved
  if (isSavingInProgress) return false

  // Prevent duplicate: if this print area was already marked, skip
  const existingTemplateId = printAreaIdToTemplateId.get(printAreaId)
  if (existingTemplateId) {
    return false
  }

  templateIdToContext.set(templateId, { templateId, mockupId, printAreaId })
  printAreaIdToTemplateId.set(printAreaId, templateId)
  return true
}

/**
 * Store a complete snapshot of template state for saving later without switching
 * This allows us to save templates without having to switch to them in TemplateEditorStore
 */
export function storeTemplateSnapshot(
  templateId: string,
  layersState: LayerDocument[],
  templateEditor: TemplateEditor,
  previewUrl: string,
  thumbnailUrl?: string
) {
  if (!templateId) return
  templateIdToSnapshot.set(templateId, { layersState, templateEditor, previewUrl, thumbnailUrl })
}

/**
 * Get stored template snapshot if available
 * Returns undefined if no snapshot exists (fallback to switching mechanism)
 */
export function getTemplateSnapshot(templateId: string): TemplateSnapshot | undefined {
  return templateIdToSnapshot.get(templateId)
}

export function getEditedTemplates(): EditedTemplateContext[] {
  // Deduplicate by templateId (Map already does this, but ensure we return unique templates)
  return Array.from(templateIdToContext.values())
}

export function clearEditedTemplates() {
  templateIdToContext.clear()
  templateIdToSnapshot.clear() // Also clear snapshots
  printAreaIdToTemplateId.clear() // Clear print area tracking
}

/**
 * Remove a specific template from the edited templates tracker
 * Call this when a template/print area is deleted or replaced
 */
export function removeEditedTemplate(templateId: string, printAreaId?: string) {
  if (!templateId) return

  // Remove from template tracking
  templateIdToContext.delete(templateId)
  templateIdToSnapshot.delete(templateId)

  // Remove from print area tracking if printAreaId provided
  if (printAreaId) {
    printAreaIdToTemplateId.delete(printAreaId)
  } else {
    // If no printAreaId, scan and remove all entries pointing to this templateId
    for (const [paId, tId] of printAreaIdToTemplateId.entries()) {
      if (tId === templateId) {
        printAreaIdToTemplateId.delete(paId)
      }
    }
  }
}

export function setSavingState(saving: boolean) {
  isSavingInProgress = saving
}
