import { useCallback, useContext, useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { useClipboardMeta } from './useClipboardMeta'
import { useContextMenuActions } from './useContextMenuActions'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import {
  duplicateLayers,
  getTemplateElementsIncludingMultiLayout,
  getTopLeftShiftToEnsureLayersInsideCanvas,
} from '~/modules/TemplateEditor/fns'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import {
  extractLayerStyle,
  applyStyleToLayer,
  copyStyleToClipboard,
  readStyleFromClipboard,
} from '~/modules/TemplateEditor/fns/layerStyle'
import { TemplateEditorStore } from '~/stores/modules/template'
import { createLayerStore, type TLayerStore } from '~/stores/modules/layer'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import type Konva from 'konva'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'

interface Params {
  /**
   * i18n translate function from the parent component. Injected to avoid re-initialising translation in the hook.
   */
  t: TFunction
  selectedIds: string[]
  clickedLayerStore: TLayerStore | null
  checkedLayerStores: TLayerStore[]
  /** Whether the canvas is interactive – disables context-menu when false. */
  interactive?: boolean
}

export function useCanvasContextMenu({
  t,
  selectedIds,
  clickedLayerStore,
  checkedLayerStores,
  interactive = true,
}: Params) {
  /* ------------------------------------------------------------------ */
  /* Context menu state                                                 */
  /* ------------------------------------------------------------------ */

  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  })

  // Export popover state (opens when "Export layer" is clicked in context menu)
  const [exportPopover, setExportPopover] = useState<{
    open: boolean
    x: number
    y: number
    layerStores: TLayerStore[]
  }>({
    open: false,
    x: 0,
    y: 0,
    layerStores: [],
  })

  /* ------------------------------------------------------------------ */
  /* Template-level context                                             */
  /* ------------------------------------------------------------------ */
  const { validationErrors, setValidationErrors } = useContext(TemplateEditorContext)

  /* ------------------------------------------------------------------ */
  /* Clipboard helpers                                                  */
  /* ------------------------------------------------------------------ */
  const clipboardMeta = useClipboardMeta(contextMenu.open)

  const getSelectedTemplateElements = useCallback(() => {
    return Array.from(new Set([...(clickedLayerStore ? [clickedLayerStore] : []), ...checkedLayerStores]))
  }, [clickedLayerStore, checkedLayerStores])

  /* ----------------------------- Actions ----------------------------- */

  const copyElements = useCallback(async () => {
    const elements = getSelectedTemplateElements()
    if (!elements.length) return

    const extractedLayerStores = TemplateEditorStore.getState().extractedLayerStores
    const items = getTemplateElementsIncludingMultiLayout(elements.map((e: TLayerStore) => e.getState()))

    // Preserve original outline ordering
    const extractedLayerIds = extractedLayerStores.map(ls => ls.getState()._id)
    const itemsSorted = items.sort((a, b) => extractedLayerIds.indexOf(a._id) - extractedLayerIds.indexOf(b._id))

    try {
      const payload = JSON.stringify(itemsSorted)
      await navigator.clipboard.writeText(payload)

      let verified = false
      try {
        const text = await navigator.clipboard.readText()
        verified = text === payload
      } catch (_) {
        // ignore – read permission may be denied
      }

      if (verified) {
        const elementCount = elements.length
        showToast(t(elementCount > 1 ? TOAST.COMMON.ELEMENTS_COPIED : TOAST.COMMON.ELEMENT_COPIED))
      } else {
        showToast(t(TOAST.COMMON.CLIPBOARD_BLOCKED), { isError: true })
      }
    } catch (_) {
      showToast(t(TOAST.COMMON.CLIPBOARD_BLOCKED), { isError: true })
    }
  }, [getSelectedTemplateElements, t])

  const pasteElements = useCallback(async () => {
    let copiedText = ''

    try {
      copiedText = await navigator.clipboard.readText()
    } catch (_) {
      showToast(t(TOAST.COMMON.CLIPBOARD_BLOCKED), { isError: true })
      return
    }

    try {
      const items = JSON.parse(copiedText)
      if (!items?.[0]?._id) return

      // Template meta
      const { dimension, shopDomain } = TemplateEditorStore.getState()
      const { width = 0, height = 0, measurementUnit = 'px', resolution = 300 } = dimension || {}

      const canvasWidth = lengthUnitToPixels(width, measurementUnit as any, resolution)
      const canvasHeight = lengthUnitToPixels(height, measurementUnit as any, resolution)

      // Calculate position shift to keep inside canvas
      const { topShift, leftShift } = getTopLeftShiftToEnsureLayersInsideCanvas(items, canvasWidth, canvasHeight)

      // Create layers
      const createdLayers: any[] = duplicateLayers({
        layers: items,
        shopDomain,
        topShift,
        leftShift,
        validationErrorsContext: { validationErrors, setValidationErrors },
      })

      const createdLayerStores = createdLayers.map(layerState => createLayerStore(layerState))

      if (createdLayerStores.length) {
        // Insert into store (skip multi-layout injection same as outline)
        TemplateEditorStore.dispatch({
          type: 'SET_EXTRACTED_LAYER_IDS',
          payload: {
            extractedLayerStores: [...createdLayerStores, ...TemplateEditorStore.getState().extractedLayerStores],
          },
        })

        showToast(t(createdLayerStores.length > 1 ? TOAST.COMMON.ELEMENTS_PASTED : TOAST.COMMON.ELEMENT_PASTED))
      }
    } catch (_) {
      // Invalid clipboard – ignore
    }
  }, [t, validationErrors, setValidationErrors])

  const copyStyle = useCallback(async () => {
    const elements = getSelectedTemplateElements()
    if (!elements.length) return

    const styleObject = extractLayerStyle(elements[0].getState())
    if (Object.keys(styleObject).length) {
      const success = await copyStyleToClipboard(styleObject)
      if (success) {
        showToast(t(TOAST.COMMON.STYLE_COPIED))
      } else {
        showToast(t(TOAST.COMMON.CLIPBOARD_BLOCKED), { isError: true })
      }
    }
  }, [getSelectedTemplateElements, t])

  const pasteStyle = useCallback(async () => {
    const styleObject = await readStyleFromClipboard()
    if (!styleObject) return

    const elements = getSelectedTemplateElements()
    if (!elements.length) return

    elements.forEach(layerStore => {
      applyStyleToLayer(layerStore, styleObject)
    })
    showToast(t(TOAST.COMMON.STYLE_PASTED))
  }, [getSelectedTemplateElements, t])

  // Export layers - opens export popover at same position as context menu
  const exportLayers = useCallback(() => {
    const elements = getSelectedTemplateElements()
    if (!elements.length) return

    // Open export popover at same position
    setExportPopover({
      open: true,
      x: contextMenu.x,
      y: contextMenu.y,
      layerStores: elements,
    })
  }, [getSelectedTemplateElements, contextMenu.x, contextMenu.y])

  const onExportPopoverClose = useCallback(() => {
    setExportPopover(prev => ({ ...prev, open: false }))
  }, [])

  // Listen for keyboard shortcut event (Cmd/Ctrl+Shift+E)
  useEffect(() => {
    const handler = (event: any) => {
      const { layerStores } = event.data as { layerStores: TLayerStore[] }
      // Open export popover centered on screen
      setExportPopover({
        open: true,
        x: window.innerWidth / 2,
        y: window.innerHeight / 3, // Position a bit higher for better UX
        layerStores,
      })
    }

    Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.EXPORT_LAYERS_KEYBOARD_SHORTCUT, handler)
    return () => {
      Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.EXPORT_LAYERS_KEYBOARD_SHORTCUT, handler)
    }
  }, [])

  /* ------------------------- Menu Actions ---------------------------- */

  const menuActions = useContextMenuActions({
    t,
    selectedIds,
    clipboardMeta,
    copyElements,
    pasteElements,
    copyStyle,
    pasteStyle,
    exportLayers,
    onClose: () => setContextMenu(prev => ({ ...prev, open: false })),
  })

  /* ---------------------- Context Menu Handler ----------------------- */

  const onContextMenuHandler = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!interactive) return
      e.evt.preventDefault()
      setContextMenu({ open: true, x: e.evt.clientX, y: e.evt.clientY })
    },
    [interactive]
  )

  const onContextMenuClose = useCallback(() => {
    setContextMenu(prev => ({ ...prev, open: false }))
  }, [])

  return {
    contextMenu,
    menuActions,
    onContextMenuHandler,
    onContextMenuClose,
    // Export popover
    exportPopover,
    onExportPopoverClose,
  }
}
