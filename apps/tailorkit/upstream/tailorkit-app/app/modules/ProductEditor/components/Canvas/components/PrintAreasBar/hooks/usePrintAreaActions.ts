/* eslint-disable max-lines */
import { useCallback, useState } from 'react'
import { showToast } from '~/utils/toastEvents'
import { DEFAULT_PRINT_AREA, IntegrationStore } from '~/stores/modules/integration/integration'
import { DEFAULT_TEMPLATE_DIMENSION, TemplateEditorStore, TemplateEditorStoreActions } from '~/stores/modules/template'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import { resetTemplateEditorStates } from '~/modules/TemplateEditor/fns'
import { uuid } from '~/utils/uuid'
import type { Template } from '~/types/psd'
import type { PrintArea } from '~/types/integration'
import { captureTemplatePreview } from '../../../../../hooks/useDesignPreview'
import { setSwitchingToPrintAreaId } from '~/stores/modules/canvas-switching'
import { waitForTemplateReady } from '../../../../../utilities/editorTiming'
import { createDefaultAndSelect } from '../utils/createDefaultAndSelect'
import type useCreateTemplateForPrintArea from './useCreateTemplateForPrintArea'
import { useUploadPSDForPrintArea } from './useUploadPSDForPrintArea'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import {
  markEditedTemplate,
  storeTemplateSnapshot,
  removeEditedTemplate,
} from '../../../../../hooks/editedTemplatesTracker'
import { TOAST } from '~/constants/toasts'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'

interface UsePrintAreaActionsParams {
  mockupId: string
  currentPrintAreaId: string
  switchingToPrintAreaId: string | null
  printAreas: Array<PrintArea & { id: string }>
  activeVariant: any
  productTitle?: string
  variantTitle?: string
  viewId: string
  updateParams: (params: { printAreaId: string; templateId: string }) => void
  createTemplateForPrintArea: ReturnType<typeof useCreateTemplateForPrintArea>['createTemplateForPrintArea']
  t: (key: string) => string
}

export type TemporarySelectedTemplate = {
  template: Template | File | null
  source: 'existing' | 'psd' | ''
  applyTemplateDimensionToPrintArea: boolean
}

export function usePrintAreaActions(params: UsePrintAreaActionsParams) {
  const {
    mockupId,
    currentPrintAreaId,
    switchingToPrintAreaId,
    printAreas,
    activeVariant,
    productTitle,
    variantTitle,
    viewId,
    updateParams,
    createTemplateForPrintArea,
    t,
  } = params
  const { uploadPSDAndCreateTemplate, isUploading: psdUploading } = useUploadPSDForPrintArea()
  const { trackEvent } = useEventsTracking()
  const { closeModal } = useModal()

  const [temporarySelectedTemplate, setTemporarySelectedTemplate] = useState<TemporarySelectedTemplate>({
    template: null,
    source: '',
    applyTemplateDimensionToPrintArea: true,
  })

  const handleSelectPrintArea = useCallback(
    async (printAreaId: string) => {
      if (printAreaId === currentPrintAreaId) return
      if (switchingToPrintAreaId) return // Prevent double-click during loading

      const startTime = performance.now()

      try {
        setSwitchingToPrintAreaId(printAreaId)
        LayerStoreSelection.dispatch({
          type: 'RESET_STATE',
        })

        // CRITICAL: Reset extracting state when switching print areas
        // This prevents ProgressProcessPSD from being stuck on screen
        TemplateEditorStoreActions.setLoading(false)

        // Use requestAnimationFrame to ensure spinner renders before blocking capture
        await new Promise(resolve => requestAnimationFrame(resolve))

        // Capture current template before switching (if it exists)
        if (currentPrintAreaId && mockupId) {
          const templateState = TemplateEditorStore.getState()

          // Only capture if there's an active template
          if (templateState._id && templateState.stageRef?.current) {
            await captureTemplatePreview(mockupId, currentPrintAreaId)
          }
        }
        // Find the template for this print area
        const printArea = printAreas.find(pa => pa._id === printAreaId)
        const template = typeof printArea?.template === 'object' ? printArea.template : null
        const templateId = template?._id || ''
        updateParams({ printAreaId, templateId })

        // Wait for template to initialize (if switching to a template with an ID)
        if (templateId) {
          await waitForTemplateReady(templateId, 3000)
        } else {
          // For new/empty templates, wait for next paint cycles
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        }

        // Ensure minimum 500ms duration to prevent flash
        const elapsed = performance.now() - startTime
        const remaining = Math.max(0, 500 - elapsed)
        await new Promise(resolve => setTimeout(resolve, remaining))
      } finally {
        setSwitchingToPrintAreaId(null)
      }
    },
    [currentPrintAreaId, switchingToPrintAreaId, mockupId, printAreas, updateParams]
  )

  const handleSortPrintAreas = useCallback(
    (sortedPrintAreas: (PrintArea & { id: string })[]) => {
      IntegrationStore.dispatch({
        type: 'UPDATE_SORTABLE_PRINT_AREA',
        payload: {
          mockupId,
          printAreas: sortedPrintAreas,
        },
      })
    },
    [mockupId]
  )

  /**
   * Handles the deletion of a print area and its associated template.
   *
   * This function performs the following critical operations:
   * 1. Removes the template from the edited templates tracker to prevent resurrection
   * 2. Resets the TemplateEditorStore if deleting the currently active template
   * 3. Deletes all associated layers for the print area
   * 4. Handles special cases:
   *    - Last print area: creates a new default print area with template
   *    - Active print area: automatically switches to the first remaining print area
   *
   * @param deletingPrintAreaId - The ID of the print area to delete
   * @param onComplete - Callback to execute after deletion completes (typically closes modal)
   *
   * @critical This function must execute operations in a specific order to prevent bugs:
   * - Template tracker cleanup BEFORE store reset (prevents race condition)
   * - Store reset BEFORE layer deletion (prevents auto-sync resurrection)
   *
   * @throws Shows error toast if deletion fails, but continues to close modal
   */
  const handleConfirmDelete = useCallback(
    async (deletingPrintAreaId: string, onComplete: () => void) => {
      if (!deletingPrintAreaId) return

      try {
        showToast(t(TOAST.PRINT_AREA.DELETING_TEMPLATE))

        // Get the template ID before deletion for cleanup
        const printAreaToDelete = printAreas.find(pa => pa._id === deletingPrintAreaId)
        const templateToDelete = typeof printAreaToDelete?.template === 'object' ? printAreaToDelete.template : null
        const templateIdToDelete = templateToDelete?._id

        // CRITICAL: Remove deleted template from tracker FIRST (before resetting store)
        // This prevents auto-sync from resurrecting the template if it runs between these operations
        if (templateIdToDelete) {
          removeEditedTemplate(templateIdToDelete, deletingPrintAreaId)
        }

        // CRITICAL: Reset TemplateEditorStore if this is the active template
        // This prevents auto-sync from resurrecting the deleted template
        if (deletingPrintAreaId === currentPrintAreaId) {
          const templateState = TemplateEditorStore.getState()
          if (templateState._id) {
            // Reset template editor to prevent auto-sync resurrection
            resetTemplateEditorStates(true) // skipTrace = true
          }
        }

        // Find all layers associated with this print area
        const layers = activeVariant?.mockup?.layers
        const layerStores = layers?.filter((layer: any) => layer.getState().printAreaId === deletingPrintAreaId)

        if (!layerStores || layerStores.length === 0) {
          // No layers found, remove the print area directly by filtering it out
          const updatedPrintAreas = printAreas.filter(pa => pa._id !== deletingPrintAreaId)

          // Check if this is the last print area
          if (updatedPrintAreas.length === 0) {
            // IMPORTANT: Clear existing print areas in store BEFORE creating default
            IntegrationStore.dispatch({
              type: 'UPDATE_SORTABLE_PRINT_AREA',
              payload: { mockupId, printAreas: [] },
            })

            await createDefaultAndSelect({
              viewId,
              activeVariant,
              productTitle,
              variantTitle,
              updateParams,
              createTemplateForPrintArea,
            })
          } else {
            IntegrationStore.dispatch({
              type: 'UPDATE_SORTABLE_PRINT_AREA',
              payload: { mockupId, printAreas: updatedPrintAreas },
            })

            // If we deleted the currently selected print area and others remain,
            // automatically switch to the first remaining print area
            if (deletingPrintAreaId === currentPrintAreaId) {
              const first = updatedPrintAreas[0]
              const firstTemplate = typeof first?.template === 'object' ? first.template : null
              const firstTemplateId = firstTemplate?._id || ''
              updateParams({ printAreaId: first._id, templateId: firstTemplateId })
            }
          }
        } else {
          // Clear layer selection before deleting
          LayerIntegrationStoreSelection.dispatch({
            type: 'RESET_STATE',
          })

          // Check if this is the last print area
          const isLastPrintArea = printAreas.length === 1

          if (isLastPrintArea) {
            // If this is the last print area, delete all layers first (keep print area temporarily)
            layerStores.forEach((layerStore: any) => {
              IntegrationStore.dispatch({
                type: 'DELETE_LAYER_ITEM',
                payload: {
                  mockupId,
                  layer: layerStore,
                  keepPrintArea: true, // Keep print area temporarily
                },
              })
            })

            // Now manually remove all print areas
            IntegrationStore.dispatch({
              type: 'UPDATE_SORTABLE_PRINT_AREA',
              payload: { mockupId, printAreas: [] },
            })

            // Then create a new default print area with a new template
            await createDefaultAndSelect({
              viewId,
              activeVariant,
              productTitle,
              variantTitle,
              updateParams,
              createTemplateForPrintArea,
            })
          } else {
            // Delete all layers - keepPrintArea: false for the last one to remove print area
            layerStores.forEach((layerStore: any, index: number) => {
              const isLastLayer = index === layerStores.length - 1
              IntegrationStore.dispatch({
                type: 'DELETE_LAYER_ITEM',
                payload: {
                  mockupId,
                  layer: layerStore,
                  keepPrintArea: !isLastLayer, // false for last layer to trigger print area deletion
                },
              })
            })

            // Switch to first available print area if we deleted the current one
            if (deletingPrintAreaId === currentPrintAreaId) {
              const remaining = printAreas.filter(pa => pa._id !== deletingPrintAreaId)
              const first = remaining[0]
              const firstTemplate = typeof first?.template === 'object' ? first.template : null
              const firstTemplateId = firstTemplate?._id || ''
              updateParams({ printAreaId: first._id, templateId: firstTemplateId })
            }
          }
        }

        // Show success toast
        showToast(t(TOAST.PRINT_AREA.TEMPLATE_DELETED))
      } catch (error) {
        console.error('[Print Area Delete] Failed to delete print area:', error)
        console.error('[Print Area Delete] Print area ID:', deletingPrintAreaId)
        console.error('[Print Area Delete] Error details:', error instanceof Error ? error.message : String(error))
        showToast(t(TOAST.PRINT_AREA.TEMPLATE_DELETE_FAILED), { isError: true })
      } finally {
        // Close modal
        onComplete()
      }
    },
    [
      currentPrintAreaId,
      activeVariant,
      printAreas,
      productTitle,
      variantTitle,
      mockupId,
      createTemplateForPrintArea,
      viewId,
      updateParams,
      t,
    ]
  )

  const handleSaveEditTemplate = useCallback(
    (
      printAreaId: string,
      data: { name: string; width: number; height: number },
      applyTemplateDimensionToPrintArea: boolean
    ) => {
      // Find the print area to update
      const printAreaIndex = printAreas.findIndex(pa => pa._id === printAreaId)
      if (printAreaIndex === -1) return

      const printArea = printAreas[printAreaIndex]
      const template = typeof printArea.template === 'object' ? printArea.template : null

      // Compute safe scale ratios from old -> new dimensions
      const oldWidth = Number(printArea.width ?? (template as any)?.dimension?.width ?? 0)
      const oldHeight = Number(printArea.height ?? (template as any)?.dimension?.height ?? 0)
      const newWidth = Number(data.width)
      const newHeight = Number(data.height)
      const scaleX = oldWidth > 0 && Number.isFinite(oldWidth) ? newWidth / oldWidth : 1
      const scaleY = oldHeight > 0 && Number.isFinite(oldHeight) ? newHeight / oldHeight : 1

      // Create updated print areas array with new dimensions and name
      const updatedPrintAreas = printAreas.map(pa => {
        if (pa._id === printAreaId) {
          return {
            ...pa,
            ...(applyTemplateDimensionToPrintArea ? { name: data.name, width: data.width, height: data.height } : {}),
          }
        }
        return pa
      })

      // Update print areas using sortable action (which replaces all print areas)
      IntegrationStore.dispatch({
        type: 'UPDATE_SORTABLE_PRINT_AREA',
        payload: { mockupId, printAreas: updatedPrintAreas },
      })

      // Update template name only (NOT dimensions)
      // Each printArea has independent dimensions, template dimension is NOT the source of truth
      if (template) {
        const updatedTemplate = {
          ...template,
          name: data.name,
          // Keep template dimension unchanged - it's only used as default when creating new printAreas
        }

        IntegrationStore.dispatch({
          type: 'UPDATE_TEMPLATE_SELECTED_FOR_PRINT_AREA',
          payload: { mockupId, printAreaId, template: updatedTemplate },
        })

        // Mark template as edited and store snapshot so it gets saved to database when saving integration
        // This ensures template name changes are persisted
        if (template._id) {
          try {
            const wasMarked = markEditedTemplate(template._id, mockupId, printAreaId)

            // Store snapshot with updated template name to ensure it's saved correctly
            if (wasMarked) {
              const layersState = Array.isArray(updatedTemplate.layers) ? updatedTemplate.layers : []
              const templateEditor = {
                ...updatedTemplate,
                extractedLayerStores: [],
                extracting: false,
                viewport: { x: 0, y: 0, scale: 1 },
                interactive: true,
                stageRef: { current: null },
              } as any

              storeTemplateSnapshot(template._id, layersState, templateEditor, updatedTemplate.previewUrl || '')
            }
          } catch (error) {
            console.error('[Save Edit Template] Failed to mark template as edited:', error)
            // Don't show toast here as it's a background operation - the save will still work
            // but template name might not persist if this fails
          }
        }

        // Scale template layers tied to this print area by the computed ratios
        const layerStores = activeVariant?.mockup?.layers || []
        layerStores.forEach((layerStore: any) => {
          const st = layerStore.getState()
          if (st.printAreaId === printAreaId && st.type === 'template') {
            const nextWidth = Math.max(1, Math.round(st.width * scaleX))
            const nextHeight = Math.max(1, Math.round(st.height * scaleY))
            layerStore.dispatch({
              type: 'UPDATE_DIMENSION',
              payload: { width: nextWidth, height: nextHeight },
              skipTrace: true,
            } as any)

            // Scale per-view overrides for this layer if width/height are overridden in the view
            const views = activeVariant?.mockup?.views || []
            views.forEach((view: any) => {
              const overrides = view?.overrides as Record<string, { width?: number; height?: number }> | undefined
              const ov = overrides ? overrides[st._id] : undefined
              if (!ov) return

              const hasW = typeof ov.width === 'number'
              const hasH = typeof ov.height === 'number'
              if (!hasW && !hasH) return

              const patch: { width?: number; height?: number } = {}
              if (hasW) patch.width = Math.max(1, Math.round((ov.width as number) * scaleX))
              if (hasH) patch.height = Math.max(1, Math.round((ov.height as number) * scaleY))

              if (patch.width !== undefined || patch.height !== undefined) {
                IntegrationStore.dispatch({
                  type: 'UPDATE_VIEW_OVERRIDES',
                  payload: { mockupId, viewId: view._id as string, layerId: st._id, patch },
                  skipTrace: true,
                } as any)
              }
            })
          }
        })

        // If this is the currently active print area, update the TemplateEditorStore
        if (printAreaId === currentPrintAreaId) {
          // Update dimension in TemplateEditorStore for current editing session
          TemplateEditorStore.dispatch({
            type: 'SET_DIMENSION',
            payload: {
              dimension: {
                width: data.width,
                height: data.height,
                measurementUnit: template.dimension.measurementUnit,
                resolution: template.dimension.resolution,
              },
            },
          })

          TemplateEditorStore.dispatch({
            type: 'SET_NAME',
            payload: { name: data.name },
          })
        }
      }
    },
    [printAreas, mockupId, activeVariant?.mockup?.layers, activeVariant?.mockup?.views, currentPrintAreaId]
  )

  const onCreatePrintAreaWithNewTemplate = useCallback(
    async (templateTitle: string, printAreaWidth: number, printAreaHeight: number) => {
      // Capture current print area before creating new template
      if (currentPrintAreaId && mockupId) {
        const templateState = TemplateEditorStore.getState()

        // Only capture if there's an active template
        if (templateState._id && templateState.stageRef?.current) {
          try {
            await captureTemplatePreview(mockupId, currentPrintAreaId)
          } catch (error) {
            console.error('[Create Template] Failed to capture preview:', error)
            // Graceful degradation: continue with template creation
          }
        }
      }

      const result = createTemplateForPrintArea({
        viewId,
        printArea: {
          ...DEFAULT_PRINT_AREA,
          _id: uuid(),
          width: printAreaWidth,
          height: printAreaHeight,
        },
        templateData: {
          _id: uuid(),
          name: templateTitle,
          dimension: {
            ...DEFAULT_TEMPLATE_DIMENSION,
            width: printAreaWidth,
            height: printAreaHeight,
          },
          isCreatingNew: true,
        } as unknown as Template,
      })

      if (result.success) {
        const { printAreaId, templateId } = result
        updateParams({ printAreaId, templateId })
      } else {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      }
    },
    [createTemplateForPrintArea, updateParams, viewId, currentPrintAreaId, mockupId, t]
  )

  const onSelectExistingTemplate = useCallback(
    async (template: Template, applyTemplateDimensionToPrintArea: boolean = true) => {
      // Capture current print area before selecting existing template
      if (currentPrintAreaId && mockupId) {
        const templateState = TemplateEditorStore.getState()

        // Only capture if there's an active template
        if (templateState._id && templateState.stageRef?.current) {
          try {
            await captureTemplatePreview(mockupId, currentPrintAreaId)
          } catch (error) {
            console.error('[Select Template] Failed to capture preview:', error)
            // Graceful degradation: continue with template selection
          }
        }
      }

      const result = createTemplateForPrintArea({
        viewId,
        printArea: {
          ...DEFAULT_PRINT_AREA,
          _id: uuid(),
          ...(applyTemplateDimensionToPrintArea
            ? {
                width: template.dimension?.width || DEFAULT_PRINT_AREA.width,
                height: template.dimension?.height || DEFAULT_PRINT_AREA.height,
              }
            : {}),
        },
        templateData: template,
      })

      if (result.success) {
        const { printAreaId, templateId } = result
        updateParams({ printAreaId, templateId })
      } else {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      }
    },
    [createTemplateForPrintArea, updateParams, viewId, currentPrintAreaId, mockupId, t]
  )

  const handleSelectTemporaryTemplate = useCallback(
    async (
      template: Template | File | null,
      source: 'existing' | 'psd' | '',
      applyTemplateDimensionToPrintArea: boolean = true
    ): Promise<void> => {
      setTemporarySelectedTemplate({
        template,
        source,
        applyTemplateDimensionToPrintArea,
      })
    },
    []
  )

  // Handler for replacing template in existing print area (from edit modal)
  const onReplaceTemplateWithExistingTemplateInPrintArea = useCallback(
    (printAreaId: string, template: Template, applyTemplateDimensionToPrintArea: boolean = false) => {
      const printArea = printAreas.find(pa => pa._id === printAreaId)
      if (!printArea) {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
        return
      }

      // Get the old template ID before replacement for cleanup
      const oldTemplate = typeof printArea.template === 'object' ? printArea.template : null
      const oldTemplateId = oldTemplate?._id

      // Use the print area's existing layer if available
      const layerStores = activeVariant?.mockup?.layers || []
      const existingLayer = layerStores.find((ls: any) => ls.getState().printAreaId === printAreaId)
      const layerId = existingLayer ? existingLayer.getState()._id : undefined

      const result = createTemplateForPrintArea({
        viewId,
        printArea: {
          ...printArea,
          ...(applyTemplateDimensionToPrintArea
            ? {
                width: template.dimension?.width || printArea.width,
                height: template.dimension?.height || printArea.height,
              }
            : {}),
        },
        templateData: {
          ...template,
          ...(!applyTemplateDimensionToPrintArea
            ? {
                dimension: {
                  ...template.dimension,
                  width: printArea.width || template.dimension?.width || DEFAULT_TEMPLATE_DIMENSION.width,
                  height: printArea.height || template.dimension?.height || DEFAULT_TEMPLATE_DIMENSION.height,
                },
              }
            : {}),
        },
        layerId, // Reuse existing layer
      })

      if (result.success) {
        // CRITICAL: Remove old template from tracker before adding new one
        // This prevents the replaced template from being saved
        if (oldTemplateId && oldTemplateId !== template._id) {
          removeEditedTemplate(oldTemplateId, printAreaId)
        }

        // CRITICAL: Mark template as edited so it gets saved to database
        const templateId = template._id
        if (templateId && mockupId && printAreaId) {
          // Store snapshot immediately with layers from IntegrationStore
          // This ensures layers are preserved even if user doesn't open template in editor
          try {
            const integrationState = IntegrationStore.getState()
            const variant = integrationState.variants.find(v => v.mockup._id === mockupId)
            const updatedPrintArea = variant?.printAreas?.find(pa => pa._id === printAreaId)
            const updatedTemplate = updatedPrintArea?.template

            if (updatedTemplate && typeof updatedTemplate === 'object') {
              // Extract layers from template data
              const layersState = Array.isArray(updatedTemplate.layers) ? updatedTemplate.layers : []

              // Only mark as edited if we have layers OR successfully store snapshot
              if (layersState.length > 0) {
                // Create template editor state from template data
                const templateEditor = {
                  ...updatedTemplate,
                  extractedLayerStores: [],
                  extracting: false,
                  viewport: { x: 0, y: 0, scale: 1 },
                  interactive: true,
                  stageRef: { current: null },
                  dimension: updatedTemplate.dimension || {
                    width: printArea.width || DEFAULT_TEMPLATE_DIMENSION.width,
                    height: printArea.height || DEFAULT_TEMPLATE_DIMENSION.height,
                    measurementUnit: 'px',
                    resolution: 300,
                  },
                } as any

                const previewUrl = updatedTemplate.previewUrl || ''

                storeTemplateSnapshot(templateId, layersState, templateEditor, previewUrl)

                // Only mark as edited after successfully storing snapshot
                markEditedTemplate(templateId, mockupId, printAreaId)
              } else {
                // No layers found - mark as edited anyway so template metadata gets saved
                markEditedTemplate(templateId, mockupId, printAreaId)
              }
            } else {
              // No template found - mark as edited anyway (fallback)
              markEditedTemplate(templateId, mockupId, printAreaId)
            }
          } catch (error) {
            console.error('[Replace Template] Failed to store snapshot:', error)
            // On error, still mark as edited but log warning
            // Template will need to be opened in editor before save
            console.warn(
              '[Replace Template] Template marked as edited without snapshot - may require editor switch during save'
            )
            markEditedTemplate(templateId, mockupId, printAreaId)
          }
        }

        showToast(t(TOAST.COMMON.TEMPLATE_REPLACED))
        // Refresh the view by updating params (this will trigger re-render)
        updateParams({ printAreaId, templateId: template._id })
      } else {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      }
    },
    [createTemplateForPrintArea, printAreas, activeVariant?.mockup?.layers, viewId, updateParams, mockupId, t]
  )

  // Handler for PSD upload complete (from edit modal)
  const onReplaceTemplateWithPSDForPrintArea = useCallback(
    async (
      printAreaId: string,
      file: File,
      dimensions: { width: number; height: number },
      isPODProduct: boolean = false
    ) => {
      // Get the old template ID before replacement for cleanup
      const printArea = printAreas.find(pa => pa._id === printAreaId)
      const oldTemplate = printArea && typeof printArea.template === 'object' ? printArea.template : null
      const oldTemplateId = oldTemplate?._id

      // Capture current print area before uploading PSD
      if (currentPrintAreaId && mockupId) {
        const templateState = TemplateEditorStore.getState()

        // Only capture if there's an active template
        if (templateState._id && templateState.stageRef?.current) {
          try {
            await captureTemplatePreview(mockupId, currentPrintAreaId)
          } catch (error) {
            console.error('[PSD Upload] Failed to capture preview:', error)
            // Graceful degradation: continue with PSD upload
          }
        }
      }

      const result = await uploadPSDAndCreateTemplate(
        file,
        printAreaId,
        {
          width: dimensions.width,
          height: dimensions.height,
        },
        isPODProduct
      )

      if (result?.success) {
        // CRITICAL: Remove old template from tracker before adding new one
        // This prevents the replaced template from being saved
        if (oldTemplateId && oldTemplateId !== result.templateId) {
          removeEditedTemplate(oldTemplateId, printAreaId)
        }

        // CRITICAL: Mark template as edited so it gets saved to database
        // For PSD upload, template is newly created with layers from PSD
        // We need to get layers from the layerIntegrationStore to store proper snapshot
        const templateId = result.templateId
        if (templateId && mockupId && printAreaId) {
          const wasMarked = markEditedTemplate(templateId, mockupId, printAreaId)

          if (wasMarked) {
            // Get template data from IntegrationStore after it's been updated
            const integrationState = IntegrationStore.getState()
            const variant = integrationState.variants.find(v => v.mockup._id === mockupId)
            const updatedPrintArea = variant?.printAreas?.find(pa => pa._id === printAreaId)
            const updatedTemplate = updatedPrintArea?.template

            if (updatedTemplate && typeof updatedTemplate === 'object') {
              // Try to get layers from layerStore first, fallback to template directly
              let layersState: any[] = []
              const layerStores = variant?.mockup?.layers || []
              const layerStore = layerStores.find((ls: any) => {
                if (typeof ls?.getState === 'function') {
                  return ls.getState().printAreaId === printAreaId
                }
                return ls?.printAreaId === printAreaId
              })

              if (layerStore) {
                const layerState = typeof layerStore.getState === 'function' ? layerStore.getState() : layerStore
                const templateData = (layerState as any).data?.template || updatedTemplate
                layersState = Array.isArray(templateData.layers) ? templateData.layers : []
              } else {
                // Fallback: extract layers directly from updatedTemplate
                layersState = Array.isArray(updatedTemplate.layers) ? updatedTemplate.layers : []
              }

              // Only store snapshot if we have layers (PSD upload should have layers)
              if (layersState.length > 0) {
                // Use updatedTemplate directly for template editor state
                const templateEditor = {
                  ...updatedTemplate,
                  extractedLayerStores: [],
                  extracting: false,
                  viewport: { x: 0, y: 0, scale: 1 },
                  interactive: true,
                  stageRef: { current: null },
                  dimension: updatedTemplate.dimension || {
                    width: dimensions.width,
                    height: dimensions.height,
                    measurementUnit: 'px',
                    resolution: 300,
                  },
                } as any

                const previewUrl = updatedTemplate.previewUrl || ''

                storeTemplateSnapshot(templateId, layersState, templateEditor, previewUrl)
              }
            }
          }
        }

        // Close the file dialog
        closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE)

        // Update params to navigate to the new print area and template
        if (result.printAreaId && result.templateId) {
          updateParams({
            printAreaId: result.printAreaId,
            templateId: result.templateId,
          })
        }

        // Send event to MixPanel
        trackEvent(EVENTS_TRACKING.UPLOAD_PSD_FILES, {
          [EVENTS_PARAMETERS_NAME.NUM_FILES]: 1,
          context: 'product_editor',
        })
      }
    },
    [uploadPSDAndCreateTemplate, closeModal, trackEvent, updateParams, currentPrintAreaId, mockupId, printAreas]
  )

  return {
    psdUploading,
    temporarySelectedTemplate,
    handleSelectPrintArea,
    handleSortPrintAreas,
    handleConfirmDelete,
    handleSaveEditTemplate,
    onCreatePrintAreaWithNewTemplate,
    onSelectExistingTemplate,
    handleSelectTemporaryTemplate,
    onReplaceTemplateWithExistingTemplateInPrintArea,
    onReplaceTemplateWithPSDForPrintArea,
  }
}
