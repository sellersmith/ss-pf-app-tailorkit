import { useCallback, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import withKeyboardShortcut, { type KeyboardAction, type KeyPressContext } from '~/bootstrap/hoc/withKeyboardShortcut'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore, TemplateEditorStoreActions } from '~/stores/modules/template'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import {
  getFileNameWithoutExtension,
  convertBlobToFile,
  readImageFromClipboard,
  createImageFromBlob,
} from '~/utils/file-types'
import { uuid } from '~/utils/uuid'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TemplateEditorContext } from '../../context'
import {
  FILE_UPLOAD_EVENTS,
  MUTATION_LAYER_FROM_INSPECTOR_EVENTS,
  TEMPLATE_EDITOR_CTA_IDS,
  TEMPLATE_EDITOR_TRANSMISSION_EVENTS,
} from '../../constants'
import { createImageElements, type ElementCreationContext } from '../Editor/utils/elementCreators'
import { ELayerType } from '~/types/psd'
import {
  cleanupDeletedLayersFromConditionalLogic,
  duplicateLayers,
  getBoundaryOfSelectedLayers,
  getTemplateElementsIncludingMultiLayout,
  getTopLeftShiftToCentralizeLayersInCanvas,
  getTopLeftShiftToEnsureLayersInsideCanvas,
} from '../../fns'
import { checkLayerInsideMultiLayout } from '../../elements/fns'
import {
  extractLayerStyle,
  applyStyleToLayer,
  copyStyleToClipboard,
  readStyleFromClipboard,
} from '../../fns/layerStyle'
import { useTools } from '../../hooks/useTools'
import { useUndoRedo } from '../Header/UndoRedo/hooks/useUndoRedo'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore, getLayerStoreById, markLayerStoreAsDeleted } from '~/stores/modules/layer'
import { deleteCharmInstance, isCharmLayer, isCharmNodeLayer } from '../../utils/charm-deletion-helper'

function KeyboardBinder() {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const { validationErrors, setValidationErrors } = useContext(TemplateEditorContext)

  const extractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)
  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)

  const { onQuickToolsChangeHandler } = useTools()
  const { canUndo, canRedo, onUndo, onRedo } = useUndoRedo()

  const getSelectedTemplateElements = useCallback(
    () => Array.from(new Set([...(clickedLayerStore ? [clickedLayerStore] : []), ...checkedLayerStores])),
    [checkedLayerStores, clickedLayerStore]
  )

  const getSelectedTemplateElementIds = useCallback(
    () => getSelectedTemplateElements().map((layerStore: TLayerStore) => layerStore.getState()._id),
    [getSelectedTemplateElements]
  )

  const verifyKeyboardAction = useCallback(
    (e: KeyboardEvent) => {
      if (document.querySelector('[data-portal-id^="modal-"] .Polaris-Backdrop')) {
        return false
      }

      const isSelectedTemplateElements = getSelectedTemplateElements().length
      const isCtrlKey = e.ctrlKey
      const isMetaKey = e.metaKey
      const isShiftKey = e.shiftKey
      const isRulerKey = e.code === 'KeyR'
      const isGridKey = e.code === 'KeyG'

      const isCtrlKeyAndAKey = isCtrlKey && e.code === 'KeyA'
      const isMetaKeyAndAKey = isMetaKey && e.code === 'KeyA'
      const isMetaKeyAndCKey = isMetaKey && e.code === 'KeyC'
      const isMetaKeyAndVKey = isMetaKey && e.code === 'KeyV'
      const isMetaKeyAndSKey = isMetaKey && e.code === 'KeyS'

      const isCtrlKeyAndZKey = isCtrlKey && e.code === 'KeyZ'
      const isCtrlKeyAndSKey = isCtrlKey && e.code === 'KeyS'
      const isMetaKeyAndZKey = isMetaKey && e.code === 'KeyZ'
      const isShiftKeyAndZKey = isShiftKey && e.code === 'KeyZ'

      const isShiftKeyAndRulerKey = isShiftKey && isRulerKey
      const isShiftKeyAndGridKey = isShiftKey && isGridKey

      return (
        isSelectedTemplateElements
        || isCtrlKeyAndAKey
        || isMetaKeyAndAKey
        || isMetaKeyAndCKey
        || isMetaKeyAndVKey
        || isShiftKeyAndRulerKey
        || isShiftKeyAndGridKey
        || isCtrlKeyAndZKey
        || isMetaKeyAndZKey
        || isShiftKeyAndZKey
        || isMetaKeyAndSKey
        || isCtrlKeyAndSKey
      )
    },
    [getSelectedTemplateElements]
  )

  const moveLayersByKeyboard = useCallback(
    ({ keyCode, altKey }: KeyPressContext) => {
      const { dimension } = TemplateEditorStore.getState()
      const { width = 0, height = 0, measurementUnit = 'px', resolution = 300 } = dimension || {}

      const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
      const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)

      const elements = getSelectedTemplateElements()
      const boundary = getBoundaryOfSelectedLayers(elements.map((e: TLayerStore) => e.getState()))

      const topShift = boundary.top
      const leftShift = boundary.left
      const rightShift = canvasWidth - (boundary.left + boundary.width)
      const bottomShift = canvasHeight - (boundary.top + boundary.height)

      elements.forEach((layerStore: TLayerStore) => {
        const { _id, top, left } = layerStore.getState()

        const newState = {
          ...(keyCode === 'ArrowUp' ? { top: altKey ? (top || 0) - topShift : (top || 0) - 1 } : {}),
          ...(keyCode === 'ArrowDown' ? { top: altKey ? (top || 0) + bottomShift : (top || 0) + 1 } : {}),
          ...(keyCode === 'ArrowLeft' ? { left: altKey ? (left || 0) - leftShift : (left || 0) - 1 } : {}),
          ...(keyCode === 'ArrowRight' ? { left: altKey ? (left || 0) + rightShift : (left || 0) + 1 } : {}),
        }

        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: newState },
        })

        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
          id: _id,
          elementData: layerStore.getState(),
        })
      })
    },
    [getSelectedTemplateElements]
  )

  const selectSiblingElementsByKeyboard = useCallback(
    ({ keyCode }: KeyPressContext) => {
      if (!clickedLayerStore) return

      const allElementsExcludeGroupStores = extractedLayerStores.filter(
        (l: TLayerStore) => l.getState().type !== 'group'
      )
      const newElement: any
        = allElementsExcludeGroupStores[
          allElementsExcludeGroupStores.indexOf(clickedLayerStore) + (keyCode === 'ArrowUp' ? -1 : 1)
        ]
      if (!newElement) return

      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: { clickedLayerStore: newElement },
      })
    },
    [clickedLayerStore, extractedLayerStores]
  )

  const selectAllElementsByKeyboard = useCallback(() => {
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: { checkedLayerStores: extractedLayerStores },
    })
  }, [extractedLayerStores])

  const deselectAllElementsByKeyboard = useCallback(() => {
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: { clickedLayerStore: null, checkedLayerStores: [] },
    })
  }, [])

  const centralizeElementsByKeyboard = useCallback(() => {
    const elements = getSelectedTemplateElements()
    const items = elements.map((element: TLayerStore) => element.getState())

    const { dimension } = TemplateEditorStore.getState()
    const { width = 0, height = 0, measurementUnit = 'px', resolution = 300 } = dimension || {}

    const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
    const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)

    const { topShift, leftShift } = getTopLeftShiftToCentralizeLayersInCanvas(items, canvasWidth, canvasHeight)

    elements.forEach((layerStore: TLayerStore) => {
      const { _id, top = 0, left = 0 } = layerStore.getState()
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { top: top - (topShift || 0), left: left - (leftShift || 0) } },
      })
      Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
        id: _id,
        elementData: layerStore.getState(),
      })
    })
  }, [getSelectedTemplateElements])

  const copyElementsByKeyboard = useCallback(
    async (_: KeyPressContext, e: KeyboardEvent) => {
      const elements = getSelectedTemplateElements()
      if (!elements.length) return

      e.preventDefault()
      const items = getTemplateElementsIncludingMultiLayout(elements.map((e: TLayerStore) => e.getState()))
      const extractedLayerIds = extractedLayerStores.map((layerStore: TLayerStore) => layerStore.getState()._id)
      const itemsSorted = items.sort((a, b) => extractedLayerIds.indexOf(a._id) - extractedLayerIds.indexOf(b._id))

      try {
        const payload = JSON.stringify(itemsSorted)
        await navigator.clipboard.writeText(payload)
        let verified = false
        try {
          const text = await navigator.clipboard.readText()
          verified = text === payload
        } catch (_) {}

        if (verified) {
          const elementCount = elements.length
          showToast(t(elementCount > 1 ? TOAST.COMMON.ELEMENTS_COPIED : TOAST.COMMON.ELEMENT_COPIED))
        } else {
          showToast(t(TOAST.COMMON.CLIPBOARD_BLOCKED), { isError: true })
        }
      } catch (_) {
        showToast(t(TOAST.COMMON.CLIPBOARD_BLOCKED), { isError: true })
      }
    },
    [extractedLayerStores, getSelectedTemplateElements, t]
  )

  const pasteImageAsNewLayer = useCallback(
    async (blob: Blob) => {
      const { dimension, shopDomain } = TemplateEditorStore.getState()
      const { width = 0, height = 0, measurementUnit = 'px', resolution = 300 } = dimension || {}
      const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
      const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)

      const { width: imgWidth, height: imgHeight, dataUrl } = await createImageFromBlob(blob)
      const fileName = `image-${Date.now()}.png`

      const context: ElementCreationContext = {
        widthByPixels: canvasWidth,
        heightByPixels: canvasHeight,
        shopDomain,
        t,
      }

      const id = uuid()
      const mediaFile = {
        id,
        alt: fileName,
        image: { width: imgWidth, height: imgHeight, originalSrc: dataUrl },
      }

      const newLayerStores = createImageElements([mediaFile], context)

      if (newLayerStores.length) {
        // Update template store using the canonical pattern
        TemplateEditorStoreActions.setExtractedLayerStores([...newLayerStores, ...extractedLayerStores])

        // Auto-select the new layer (following useElementActions pattern)
        setTimeout(() => {
          LayerStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { clickedLayerStore: newLayerStores[0] },
          })
        }, 100)

        // Trigger background upload using existing utility
        Transmitter.trigger(FILE_UPLOAD_EVENTS.SELECT, {
          files: [{ _id: newLayerStores[0].getState()._id, file: convertBlobToFile(blob, fileName) }],
        })

        // Track analytics
        trackEvent(EVENTS_TRACKING.ADD_TEMPLATE_ELEMENT, {
          [EVENTS_PARAMETERS_NAME.ELEMENT_TYPE]: ELayerType.IMAGE,
          [EVENTS_PARAMETERS_NAME.NUM_FILES]: 1,
        })

        showToast(t(TOAST.TEMPLATE_EDITOR.IMAGE_PASTED))
      }
    },
    [extractedLayerStores, t, trackEvent]
  )

  const pasteImageAsFill = useCallback(
    async (layerStore: TLayerStore, blob: Blob) => {
      const { width: imgWidth, height: imgHeight, dataUrl } = await createImageFromBlob(blob)
      const fileName = `image-${Date.now()}.png`
      const layerId = layerStore.getState()._id

      // Update layer's image (following the onReplaceImage pattern from LayerListing)
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            image: {
              _id: uuid(),
              width: imgWidth,
              height: imgHeight,
              src: dataUrl,
              originalSrc: dataUrl,
              imageName: getFileNameWithoutExtension(fileName),
            },
          },
        },
      })

      // Trigger background upload using existing utility
      Transmitter.trigger(FILE_UPLOAD_EVENTS.SELECT, {
        files: [{ _id: layerId, file: convertBlobToFile(blob, fileName) }],
      })

      showToast(t(TOAST.TEMPLATE_EDITOR.IMAGE_REPLACED))
    },
    [t]
  )

  const pasteElementsByKeyboard = useCallback(
    async (_: KeyPressContext, e: KeyboardEvent) => {
      // First, try to read image from clipboard
      const imageBlob = await readImageFromClipboard()

      if (imageBlob) {
        e.preventDefault()

        const selectedElements = getSelectedTemplateElements()
        const selectedImageLayer = selectedElements.find((ls: TLayerStore) => ls.getState().type === ELayerType.IMAGE)

        if (selectedImageLayer) {
          // Paste as fill - replace selected layer's image
          await pasteImageAsFill(selectedImageLayer, imageBlob)
        } else {
          // Paste as new layer
          await pasteImageAsNewLayer(imageBlob)
        }
        return
      }

      // Fall back to existing JSON paste logic
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

        e.preventDefault()

        const { dimension, shopDomain } = TemplateEditorStore.getState()
        const { width = 0, height = 0, measurementUnit = 'px', resolution = 300 } = dimension || {}
        const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
        const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)
        const { topShift, leftShift } = getTopLeftShiftToEnsureLayersInsideCanvas(items, canvasWidth, canvasHeight)

        const createdLayers: any[] = duplicateLayers({
          layers: items,
          shopDomain,
          topShift,
          leftShift,
          validationErrorsContext: { validationErrors, setValidationErrors },
        })
        const createdLayerStores = createdLayers.map(layerState => createLayerStore(layerState))

        // Exclude layers that belong to multi-layouts from the outline list
        const layersInMultiLayouts = createdLayers
          .filter(l => {
            const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(l, createdLayers)
            return isLayerInsideMultiLayout
          })
          .map(l => l._id)

        if (createdLayerStores.length) {
          TemplateEditorStore?.dispatch({
            type: 'SET_EXTRACTED_LAYER_IDS',
            payload: {
              extractedLayerStores: [
                ...createdLayerStores.filter((ls: TLayerStore) => !layersInMultiLayouts.includes(ls.getState()._id)),
                ...extractedLayerStores,
              ],
            },
          })
          showToast(t(createdLayerStores.length > 1 ? TOAST.COMMON.ELEMENTS_PASTED : TOAST.COMMON.ELEMENT_PASTED))
        }
      } catch (_) {}
    },
    [
      extractedLayerStores,
      validationErrors,
      setValidationErrors,
      t,
      getSelectedTemplateElements,
      pasteImageAsNewLayer,
      pasteImageAsFill,
    ]
  )

  const onToggleRulerMode = useCallback(() => onQuickToolsChangeHandler('ruler-tool'), [onQuickToolsChangeHandler])
  const onToggleGridMode = useCallback(() => onQuickToolsChangeHandler('grid-tool'), [onQuickToolsChangeHandler])

  const onUndoHandler = useCallback(() => {
    if (canUndo) onUndo()
  }, [canUndo, onUndo])
  const onRedoHandler = useCallback(() => {
    if (canRedo) onRedo()
  }, [canRedo, onRedo])

  const onDeleteItems = useCallback((ids: string[]) => {
    const allLayerStores = TemplateEditorStore.getState().extractedLayerStores

    // Separate CHARM layers from regular layers — CHARM layers need special handling
    // to dispatch DELETE_CHARM_INSTANCE on their parent CHARM_NODE store
    const charmStores: TLayerStore[] = []
    const regularLayerIds: string[] = []

    for (const id of ids) {
      const store = getLayerStoreById(id)
      if (!store) continue
      if (isCharmNodeLayer(store)) continue // CHARM_NODE cannot be deleted
      if (isCharmLayer(store)) {
        charmStores.push(store)
      } else {
        regularLayerIds.push(id)
      }
    }

    // Handle CHARM layers: dispatch DELETE_CHARM_INSTANCE on parent CHARM_NODE
    for (const store of charmStores) {
      deleteCharmInstance(store)
    }

    // Handle regular layers with existing flow
    if (regularLayerIds.length > 0) {
      const allStores = TemplateEditorStore.getState().extractedLayerStores
      cleanupDeletedLayersFromConditionalLogic(regularLayerIds, allStores)

      regularLayerIds.forEach(id => {
        markLayerStoreAsDeleted(id, true, true)
      })
    }

    const charmLayerIds = charmStores.map(s => s.getState()._id)
    const removedLayerIds = [...charmLayerIds, ...regularLayerIds]
    TemplateEditorStore.dispatch({
      type: 'SET_EXTRACTED_LAYER_IDS',
      payload: {
        extractedLayerStores: allLayerStores.filter(ls => !removedLayerIds.includes(ls.getState()._id)),
      },
    })

    const currentChecked = LayerStoreSelection.getState().checkedLayerStores
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: {
        clickedLayerStore: null,
        checkedLayerStores: currentChecked.filter(ls => !removedLayerIds.includes(ls.getState()._id)),
      },
    })
  }, [])

  const deleteElementsByKeyboard = useCallback(
    () => onDeleteItems(getSelectedTemplateElementIds()),
    [getSelectedTemplateElementIds, onDeleteItems]
  )

  const keyboardActions: KeyboardAction[] = useMemo(
    (): KeyboardAction[] => [
      { keyCode: 'ArrowUp', onAction: moveLayersByKeyboard },
      { keyCode: 'ArrowDown', onAction: moveLayersByKeyboard },
      { keyCode: 'ArrowLeft', onAction: moveLayersByKeyboard },
      { keyCode: 'ArrowRight', onAction: moveLayersByKeyboard },
      { altKey: true, keyCode: 'ArrowUp', onAction: moveLayersByKeyboard },
      { altKey: true, keyCode: 'ArrowDown', onAction: moveLayersByKeyboard },
      { altKey: true, keyCode: 'ArrowLeft', onAction: moveLayersByKeyboard },
      { altKey: true, keyCode: 'ArrowRight', onAction: moveLayersByKeyboard },
      { shiftKey: true, keyCode: 'ArrowUp', onAction: selectSiblingElementsByKeyboard },
      { shiftKey: true, keyCode: 'ArrowDown', onAction: selectSiblingElementsByKeyboard },
      { ctrlKey: true, keyCode: 'KeyA', preventDefault: true, onAction: selectAllElementsByKeyboard },
      { metaKey: true, keyCode: 'KeyA', preventDefault: true, onAction: selectAllElementsByKeyboard },
      { altKey: true, ctrlKey: true, keyCode: 'KeyD', onAction: deselectAllElementsByKeyboard },
      { altKey: true, ctrlKey: true, keyCode: 'KeyE', onAction: centralizeElementsByKeyboard },
      { metaKey: true, keyCode: 'KeyC', onAction: copyElementsByKeyboard },
      { metaKey: true, keyCode: 'KeyV', onAction: pasteElementsByKeyboard },
      { ctrlKey: true, keyCode: 'KeyC', onAction: copyElementsByKeyboard },
      { ctrlKey: true, keyCode: 'KeyV', onAction: pasteElementsByKeyboard },
      { keyCode: 'Backspace', onAction: deleteElementsByKeyboard },
      { keyCode: 'KeyR', shiftKey: true, onAction: onToggleRulerMode },
      { keyCode: 'KeyG', shiftKey: true, onAction: onToggleGridMode },
      { metaKey: true, keyCode: 'KeyZ', preventDefault: true, onAction: onUndoHandler },
      { metaKey: true, keyCode: 'KeyZ', shiftKey: true, preventDefault: true, onAction: onRedoHandler },
      { ctrlKey: true, keyCode: 'KeyZ', preventDefault: true, onAction: onUndoHandler },
      { ctrlKey: true, keyCode: 'KeyZ', shiftKey: true, preventDefault: true, onAction: onRedoHandler },
      // Save template (Cmd/Ctrl + S)
      {
        metaKey: true,
        keyCode: 'KeyS',
        preventDefault: true,
        onAction: () => {
          const btn = document.getElementById(TEMPLATE_EDITOR_CTA_IDS.SAVE_TEMPLATE) as HTMLButtonElement | null
          if (btn && !btn.disabled) btn.click()
        },
      },
      {
        ctrlKey: true,
        keyCode: 'KeyS',
        preventDefault: true,
        onAction: () => {
          const btn = document.getElementById(TEMPLATE_EDITOR_CTA_IDS.SAVE_TEMPLATE) as HTMLButtonElement | null
          if (btn && !btn.disabled) btn.click()
        },
      },
      // Copy/Paste style shortcuts
      {
        shiftKey: true,
        metaKey: true,
        keyCode: 'KeyC',
        onAction: async () => {
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
        },
      },
      {
        shiftKey: true,
        metaKey: true,
        keyCode: 'KeyV',
        onAction: async () => {
          const styleObject = await readStyleFromClipboard()
          if (!styleObject) return
          const elements = getSelectedTemplateElements()
          if (!elements.length) return
          elements.forEach(layerStore => {
            applyStyleToLayer(layerStore, styleObject)
          })
          showToast(t(TOAST.COMMON.STYLE_PASTED))
        },
      },
      {
        shiftKey: true,
        ctrlKey: true,
        keyCode: 'KeyC',
        onAction: async () => {
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
        },
      },
      {
        shiftKey: true,
        ctrlKey: true,
        keyCode: 'KeyV',
        onAction: async () => {
          const styleObject = await readStyleFromClipboard()
          if (!styleObject) return
          const elements = getSelectedTemplateElements()
          if (!elements.length) return
          elements.forEach(layerStore => {
            applyStyleToLayer(layerStore, styleObject)
          })
          showToast(t(TOAST.COMMON.STYLE_PASTED))
        },
      },
      // Export layer(s) shortcut (Cmd/Ctrl + Shift + E) - single handler for both Mac and Windows
      {
        shiftKey: true,
        keyCode: 'KeyE',
        preventDefault: true,
        onAction: (_: KeyPressContext, e: KeyboardEvent) => {
          // Check for Cmd (Mac) or Ctrl (Windows)
          if (!e.metaKey && !e.ctrlKey) return
          const elements = getSelectedTemplateElements()
          if (!elements.length) return
          Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.EXPORT_LAYERS_KEYBOARD_SHORTCUT, {
            layerStores: elements,
          })
        },
      },
    ],
    [
      moveLayersByKeyboard,
      selectSiblingElementsByKeyboard,
      selectAllElementsByKeyboard,
      deselectAllElementsByKeyboard,
      centralizeElementsByKeyboard,
      copyElementsByKeyboard,
      pasteElementsByKeyboard,
      deleteElementsByKeyboard,
      onToggleRulerMode,
      onToggleGridMode,
      onUndoHandler,
      onRedoHandler,
      getSelectedTemplateElements,
      t,
    ]
  )

  const Binder = useMemo(() => withKeyboardShortcut(() => null), [])
  return <Binder keyboardActions={keyboardActions} verifyKeyboardAction={verifyKeyboardAction} />
}

export default KeyboardBinder
