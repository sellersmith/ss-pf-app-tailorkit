import { useCallback, useMemo, useState } from 'react'
import useSaveIntegration from './useSaveIntegration'
import { TemplateEditorStore } from '~/stores/modules/template'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useSaveTemplate } from '~/modules/TemplateEditor/hooks/useSaveTemplate'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { useEditorParams } from './useEditorParams'
import { EDITOR_TABS } from '../constants'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import { fastCanvasCaptureBlob } from '~/modules/TemplateEditor/utilities/canvas'
import {
  getEditedTemplates,
  clearEditedTemplates,
  setSavingState,
  getTemplateSnapshot,
  storeTemplateSnapshot,
} from './editedTemplatesTracker'
import { awaitNextPaint, waitForTemplateReady } from '../utilities/editorTiming'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useStore } from '~/libs/external-store'
import { ProgressStore } from '~/stores/canvas/progress'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { setSwitchingToPrintAreaId } from '~/stores/modules/canvas-switching'
import { captureTemplatePreview } from './useDesignPreview'
import { syncTemplateEditorToIntegration } from '~/stores/modules/integration/fns'
import type { Template } from '~/types/psd'
import {
  isStoreAssetThumbnailEnabled,
  shouldGenerateThumbnail,
  getExistingThumbnailUrl,
  generateStoreAssetThumbnail,
} from './storeAssetThumbnail'

export default function useUnifiedSave() {
  const { tab, mockupId, printAreaId, setTab, setPrintAreaId } = useEditorParams()

  const {
    saving: savingIntegration,
    publishIntegration,
    unpublishIntegration,
    clearProcessing,
    saveIntegration,
  } = useSaveIntegration()

  const { trackEvent } = useEventsTracking()
  const { openModal } = useModal()
  const { onSaveTemplate, onSaveClipart } = useSaveTemplate()

  const backgroundProgressIndex = useStore(ProgressStore, state => state.index)
  const backgroundProgressTotal = useStore(ProgressStore, state => state.total)

  const backgroundProgress = useMemo(() => {
    return backgroundProgressTotal > 0 ? (backgroundProgressIndex / backgroundProgressTotal) * 100 : 0
  }, [backgroundProgressIndex, backgroundProgressTotal])

  const [savingTemplates, setSavingTemplates] = useState(false)

  const saving = useMemo(() => savingIntegration || savingTemplates, [savingIntegration, savingTemplates])

  const saveAll = useCallback(async () => {
    if (backgroundProgressTotal > 0 && backgroundProgress < 100) {
      openModal(MODAL_ID.BACKGROUND_PROGRESS_UPLOADER_MODAL)
      return
    }

    try {
      // 1) Save all templates edited this session (sequentially, abort on first failure)
      const edited = getEditedTemplates()

      if (edited.length > 0) {
        setSavingTemplates(true)
        // Prevent tracking new edits during save loop (avoid double-saves from param switches)
        setSavingState(true)

        // Use current printAreaId, fallback to first edited item's printAreaId
        const globalSpinnerPrintAreaId = printAreaId || edited[0]?.printAreaId || ''
        if (globalSpinnerPrintAreaId) {
          setSwitchingToPrintAreaId(globalSpinnerPrintAreaId)
          // Double rAF to ensure overlay paints before work begins
          await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))
        }

        // Capture current snapshot
        await captureTemplatePreview(mockupId, printAreaId)

        // Sync to template editor to integration store
        syncTemplateEditorToIntegration({ mockupId, printAreaId })

        // Filter out templates that no longer exist in IntegrationStore (defensive check)
        // This prevents saving orphaned templates from discarded products
        const integrationState = IntegrationStore.getState()
        const validEdited = edited.filter(item => {
          return integrationState.variants.some(variant =>
            variant.printAreas?.some(printArea => {
              const template = printArea.template
              if (!template) return false
              const templateId = typeof template === 'object' ? template._id : template
              return templateId === item.templateId
            })
          )
        })

        // Explicit deduplication by templateId (defensive)
        const seen = new Set<string>()
        const uniqueEdited = validEdited.filter(item => {
          if (seen.has(item.templateId)) return false
          seen.add(item.templateId)
          return true
        })

        // Preserve original params to restore after temporary switches
        const original = { tab, mockupId, printAreaId }

        for (const item of uniqueEdited) {
          const { templateId } = item

          try {
            // ⚡ NEW: Try to use stored snapshot first (NO SWITCHING NEEDED!)
            const snapshot = getTemplateSnapshot(templateId)

            if (snapshot) {
              const { layersState, templateEditor, previewUrl, thumbnailUrl } = snapshot

              // Check if thumbnail is needed but not in snapshot (only for store assets)
              const needsThumbnail
                = shouldGenerateThumbnail(
                  templateEditor.shopDomain,
                  templateEditor.metadata,
                  templateEditor.previewProductImage
                ) && !thumbnailUrl

              if (needsThumbnail) {
                console.warn(
                  `⚠️ Thumbnail needed for template ${templateId} but not in snapshot, falling back to switch + generate`
                )
                // Fall through to switching mechanism below
              } else {
                // Use snapshot data directly without switching templates - INSTANT! 🚀

                // Use thumbnailUrl from snapshot if available, otherwise try IntegrationStore
                let finalThumbnailUrl: string | undefined = thumbnailUrl
                if (
                  !finalThumbnailUrl
                  && isStoreAssetThumbnailEnabled(templateEditor.shopDomain, templateEditor.metadata)
                ) {
                  finalThumbnailUrl = getExistingThumbnailUrl(templateId)
                }

                // Save using snapshot data via onSaveClipart (accepts layersState + templateEditor directly)
                const { saved, previewUrl: previewUrlAfterSave } = await onSaveClipart(
                  layersState,
                  templateEditor,
                  previewUrl,
                  finalThumbnailUrl
                )

                if (!saved) {
                  setSavingTemplates(false)
                  setSavingState(false)
                  return
                }

                if (previewUrlAfterSave) {
                  // Preserve thumbnailUrl when updating snapshot after save
                  storeTemplateSnapshot(
                    templateId,
                    layersState,
                    templateEditor,
                    previewUrlAfterSave as string,
                    finalThumbnailUrl // Preserve the thumbnail URL we used
                  )
                }
                continue // Skip to next template
              }
            }

            // FALLBACK: If no snapshot OR thumbnail needed but not available, use switching mechanism (slower but reliable)
            const { mockupId: targetMockupId, printAreaId: targetPrintAreaId } = item
            let previewUrl: string | undefined

            // Prefer existing blob preview from IntegrationStore
            const integrationState = IntegrationStore.getState()
            const variant = integrationState.variants.find(v => v.mockup._id === targetMockupId)
            const pa = variant?.printAreas?.find(p => p._id === targetPrintAreaId)
            const tpl = pa?.template
            if (isObject(tpl) && tpl.previewUrl && isString(tpl.previewUrl) && tpl.previewUrl.startsWith('blob:')) {
              previewUrl = tpl.previewUrl
            }

            // Ensure we're on the correct template before saving (onSaveTemplate reads from TemplateEditorStore)
            let current = TemplateEditorStore.getState()
            const needsSwitch = current?._id !== templateId
            // Also need to switch to DESIGN tab if we're going to capture canvas (no preview URL exists)
            const needsTabSwitch = !needsSwitch && tab !== EDITOR_TABS.DESIGN && !previewUrl

            // Track timing for minimum spinner duration
            const switchStartTime = performance.now()

            // Switch to target template if needed OR switch to DESIGN tab for canvas capture
            if (needsSwitch || needsTabSwitch) {
              // Set switching state to show canvas loading spinner
              const targetPrintAreaIdForSpinner = needsSwitch ? targetPrintAreaId : printAreaId
              setSwitchingToPrintAreaId(targetPrintAreaIdForSpinner)

              // Use  requestAnimationFrame to ensure spinner renders before blocking operations
              await new Promise(resolve => requestAnimationFrame(resolve))

              setTab(EDITOR_TABS.DESIGN)
              if (needsSwitch) {
                setPrintAreaId(targetPrintAreaId)
              }
              // Wait for React to re-render and template to initialize (useEffect + requestAnimationFrame)
              const ready = await waitForTemplateReady(templateId)
              if (!ready) {
                throw new Error(`Template ${templateId} failed to load within timeout`)
              }
              current = TemplateEditorStore.getState()
            }

            // Verify we're on the correct template
            if (current?._id !== templateId) {
              throw new Error(`Template mismatch: expected ${templateId}, got ${current?._id}`)
            }

            // If missing preview, capture it now using FAST capture (no polling needed!)
            // Spinner should already be visible from switch operation above
            if (!previewUrl) {
              const { stageRef, dimension } = current

              if (!(stageRef?.current && dimension?.width && dimension?.height)) {
                throw new Error(`Canvas not ready for template ${templateId}`)
              }

              const blob = await fastCanvasCaptureBlob(
                stageRef.current,
                Math.max(16, Math.floor(dimension.width)),
                Math.max(16, Math.floor(dimension.height)),
                'image/png'
              )
              previewUrl = URL.createObjectURL(blob)
            }

            // Generate thumbnail with preview product image (only for store assets domain)
            // Pass mockupId and printAreaId to read previewProductImage from PrintArea
            const thumbnailUrl = await generateStoreAssetThumbnail(
              templateId,
              current.stageRef,
              current.dimension,
              current.shopDomain,
              current.metadata,
              targetMockupId,
              targetPrintAreaId
            )

            // Save the template (spinner still visible from switch operation)
            const { saved, previewUrl: previewUrlAfterSave } = await onSaveTemplate(previewUrl, thumbnailUrl)

            // Revoke temporary blob URL after save
            if (saved && previewUrlAfterSave && previewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(previewUrlAfterSave)
              // Store snapshot with both previewUrl and thumbnailUrl (if generated)
              storeTemplateSnapshot(
                templateId,
                current.extractedLayerStores.map((layerStore: any) => layerStore.getState()),
                current,
                previewUrlAfterSave as string,
                thumbnailUrl // Store the generated thumbnail URL in snapshot for future saves
              )
            }

            if (!saved) {
              // Do not hide global spinner here; outer finally will handle
              setSavingTemplates(false)
              setSavingState(false)
              return
            }

            // Restore original params after fallback save
            if (needsSwitch || needsTabSwitch) {
              // Switch spinner to original print area for restore operation
              setSwitchingToPrintAreaId(original.printAreaId)

              // Use  requestAnimationFrame to ensure spinner renders before blocking operations
              await new Promise(resolve => requestAnimationFrame(resolve))

              if (needsSwitch) {
                setPrintAreaId(original.printAreaId)
              }
              setTab(original.tab)
              await awaitNextPaint()

              // Ensure minimum 500ms duration to prevent flash
              const elapsed = performance.now() - switchStartTime
              const remaining = Math.max(0, 500 - elapsed)
              await new Promise(resolve => setTimeout(resolve, remaining))

              // Keep global spinner; outer finally will clear
            }
          } catch (error) {
            console.error(`❌ Failed to save template ${templateId}:`, error)
            // Keep global spinner; outer finally will clear afterwards
            setSavingTemplates(false)
            setSavingState(false)
            throw error
          }
        }

        setSavingTemplates(false)
        setSavingState(false)
      }

      // 2) Save integration after templates
      await saveIntegration()

      // Clear session tracker after successful save
      clearEditedTemplates()

      // Track event when the unified editor is saved
      const integration = IntegrationStore.getState()
      const { _id: templateId, extractedLayerStores } = TemplateEditorStore.getState()

      const template = integration.variants
        .find(v => v.printAreas.find(p => (p?.template as Template)?._id === templateId))
        ?.printAreas.find(p => (p?.template as Template)._id === templateId) as Template

      const editSessionStartAt = sessionStorage?.getItem(`START_TEMPLATE_${templateId}_EDIT_SESSION_AT`)
      const editSessionSavedAt = sessionStorage?.getItem(`SAVED_TEMPLATE_${templateId}_EDIT_SESSION_AT`)

      trackEvent(EVENTS_TRACKING.SAVE_PRODUCT, {
        [EVENTS_PARAMETERS_NAME.TYPE]: 'unified_editor',
        templateId: templateId,
        templateType: template?.category,
        elementsCount: extractedLayerStores.length,
        isNewTemplate: !editSessionSavedAt && !template?.createdAt,
        [editSessionSavedAt ? 'editingTimeSeconds' : 'creationTimeSeconds']:
          (editSessionSavedAt || editSessionStartAt)
          && Math.round((Date.now() - Number(editSessionSavedAt || editSessionStartAt)) / 1000),
      })

      sessionStorage?.setItem(`SAVED_TEMPLATE_${templateId}_EDIT_SESSION_AT`, Date.now().toString())

      // Track onboarding completion on save (same as publish path)
      const startTime = localStorage?.getItem('TLK_ONBOARDING_START_AT')
      if (startTime) {
        const completionMinutes = (Date.now() - Number(startTime)) / 60000
        trackEvent(EVENTS_TRACKING.COMPLETE_ONBOARDING, {
          [EVENTS_PARAMETERS_NAME.COMPLETION_MINUTES]: completionMinutes.toFixed(2),
        })
        localStorage?.removeItem('TLK_ONBOARDING_START_AT')
      }
    } catch (e) {
      // Surface any error consistently
      showGenericErrorToast()
      // Ensure switching state is cleared on error
      setSwitchingToPrintAreaId(null)
    } finally {
      setSavingState(false)
      setSwitchingToPrintAreaId(null)
    }
  }, [
    backgroundProgressTotal,
    backgroundProgress,
    openModal,
    saveIntegration,
    trackEvent,
    tab,
    mockupId,
    printAreaId,
    onSaveTemplate,
    onSaveClipart,
    setTab,
    setPrintAreaId,
  ])

  return {
    saving,
    saveAll,
    publishIntegration,
    unpublishIntegration,
    clearProcessing,
  }
}
