/* eslint-disable max-lines */
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useContext, useMemo, useState } from 'react'
import type { KeyboardAction, KeyPressContext } from '~/bootstrap/hoc/withKeyboardShortcut'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { useStore } from '~/libs/external-store'
import type { GroupableItemList } from '~/modules/GroupableItemList'
import { createLayerStore, type TLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStore } from '~/stores/modules/template'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '../../constants'
import { checkLayerInsideMultiLayout } from '../../elements/fns'
import {
  duplicateLayers,
  getBoundaryOfSelectedLayers,
  getTemplateElementsIncludingMultiLayout,
  getTopLeftShiftToCentralizeLayersInCanvas,
  getTopLeftShiftToEnsureLayersInsideCanvas,
} from '../../fns'

import {
  extractLayerStyle,
  applyStyleToLayer,
  copyStyleToClipboard,
  readStyleFromClipboard,
} from '../../fns/layerStyle'
import LayerListing from './LayerListing'
import { useTools } from '../../hooks/useTools'
import { TemplateEditorContext } from '../../context'
import { useUndoRedo } from '../Header/UndoRedo/hooks/useUndoRedo'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'

export interface ITempLayerStore extends TLayerStore {
  id: string
}

interface IOutlineProps {
  extractedLayerStores: TLayerStore[]
}

export default function Outline(props: WithTranslationProps & IOutlineProps) {
  const { t, extractedLayerStores } = props

  // TODO: UPDATE SORTABLE COMPONENT TO REMOVE ID PROPERTY
  const memoExtractedLayerStores = extractedLayerStores
    .map(layerStore => ({ ...layerStore, id: layerStore.getState()._id }))
    .filter(layerStore => !layerStore.getState().isGroupLayer)
  const { validationErrors, setValidationErrors } = useContext(TemplateEditorContext)

  // Get selected layers
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)
  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)
  const { onQuickToolsChangeHandler } = useTools()

  // Get a reference to the groupable item list element
  const [ref, _setRef] = useState<GroupableItemList<void, void>>()
  const setRef = useCallback((ref: any) => _setRef(ref), [])

  const { canUndo, canRedo, onUndo, onRedo } = useUndoRedo()

  // Define function to get selected template elements
  const getSelectedTemplateElements = useCallback(
    () => Array.from(new Set([...(clickedLayerStore ? [clickedLayerStore] : []), ...checkedLayerStores])),
    [checkedLayerStores, clickedLayerStore]
  )

  // Define function to get selected template elements
  const getSelectedTemplateElementIds = useCallback(
    () => getSelectedTemplateElements().map((layerStore: TLayerStore) => layerStore.getState()._id),
    [getSelectedTemplateElements]
  )

  // Define a function to verify keyboard action
  const verifyKeyboardAction = useCallback(
    (e: KeyboardEvent) => {
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

      const isCtrlKeyAndZKey = isCtrlKey && e.code === 'KeyZ'
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
      )
    },
    [getSelectedTemplateElements]
  )

  // Define function to move layers on canvas by keyboard
  const moveLayersByKeyboard = useCallback(
    ({ keyCode, altKey }: KeyPressContext) => {
      // Get template dimension
      const { dimension } = TemplateEditorStore.getState()
      const { width = 0, height = 0, measurementUnit = 'px', resolution = 300 } = dimension || {}

      const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
      const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)

      // Get the bounding rect around selected elements
      const elements = getSelectedTemplateElements()
      const boundary = getBoundaryOfSelectedLayers(elements.map((e: TLayerStore) => e.getState()))

      // Calculate shift to move selected elements to each canvas edge
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
          payload: {
            state: newState,
          },
        })

        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
          id: _id,
          elementData: layerStore.getState(),
        })
      })
    },
    [getSelectedTemplateElements]
  )

  // Define function to reorder elements up/down in the template element list
  const reorderElementsByKeyboard = useCallback(
    ({ keyCode, ctrlKey }: KeyPressContext) => {
      const items = ref?.state?.items

      if (!items) {
        return
      }

      // Get sibling element
      const elementIds = getSelectedTemplateElementIds()
      const elements = items.filter((item: any) => elementIds.includes(ref.getItemId(item)))

      const { _id } = elements[keyCode === 'ArrowUp' ? 0 : elements.length - 1]
      const index = items.map((e: any) => ref.getItemId(e)).indexOf(_id)

      if (
        index < 0
        || (ctrlKey && keyCode === 'ArrowUp' && index === 0)
        || (ctrlKey && keyCode === 'ArrowDown' && index === items.length - 1)
      ) {
        return
      }

      const siblingElement = ctrlKey
        ? keyCode === 'ArrowUp'
          ? items[0]
          : items[items.length - 1]
        : keyCode === 'ArrowUp'
          ? items[index - 1]
          : items[index + 1]

      if (siblingElement) {
        ref.moveItems(elementIds, siblingElement, keyCode === 'ArrowUp' ? 'before' : 'after')
      }
    },
    [getSelectedTemplateElementIds, ref]
  )

  const selectSiblingElementsByKeyboard = useCallback(
    ({ keyCode }: KeyPressContext) => {
      if (!clickedLayerStore) {
        return
      }

      // Get all elements except groups
      const allElementsExcludeGroupStores = extractedLayerStores.filter(
        (l: TLayerStore) => l.getState().type !== 'group'
      )

      // Get the affected previous/next element
      const newElement: any
        = allElementsExcludeGroupStores[
          allElementsExcludeGroupStores.indexOf(clickedLayerStore) + (keyCode === 'ArrowUp' ? -1 : 1)
        ]

      if (!newElement) {
        return
      }

      // Change clicked element to the new one
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: { clickedLayerStore: newElement },
      })
    },
    [clickedLayerStore, extractedLayerStores]
  )

  // Define function to select all template elements
  const selectAllElementsByKeyboard = useCallback(() => {
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: {
        checkedLayerStores: extractedLayerStores,
      },
    })
  }, [extractedLayerStores])

  // Define function to deselect all template elements
  const deselectAllElementsByKeyboard = useCallback(() => {
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: {
        clickedLayerStore: null,
        checkedLayerStores: [],
      },
    })
  }, [])

  // Define function to centralize selected template elements
  const centralizeElementsByKeyboard = useCallback(() => {
    const elements = getSelectedTemplateElements()
    const items = elements.map((element: TLayerStore) => element.getState())

    // Get template dimension
    const { dimension } = TemplateEditorStore.getState()
    const { width = 0, height = 0, measurementUnit = 'px', resolution = 300 } = dimension || {}

    const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
    const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)

    // Calculate position shift to centralize the elements being pasted
    const { topShift, leftShift } = getTopLeftShiftToCentralizeLayersInCanvas(items, canvasWidth, canvasHeight)

    elements.forEach((layerStore: TLayerStore) => {
      const { _id, top = 0, left = 0 } = layerStore.getState()

      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            top: top - (topShift || 0),
            left: left - (leftShift || 0),
          },
        },
      })

      Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
        id: _id,
        elementData: layerStore.getState(),
      })
    })
  }, [getSelectedTemplateElements])

  // Define function to group selected template elements
  const groupElementsByKeyboard = useCallback(
    () => ref?.createGroup(getSelectedTemplateElementIds()),
    [getSelectedTemplateElementIds, ref]
  )

  // Define function to ungroup selected template elements
  const ungroupElementsByKeyboard = useCallback(
    () => ref?.ungroup(getSelectedTemplateElementIds()),
    [getSelectedTemplateElementIds, ref]
  )

  // Define function to copy template elements by keyboard
  const copyElementsByKeyboard = useCallback(
    async (_: KeyPressContext, e: KeyboardEvent) => {
      // Get all layers in multi-layouts if copying multi-layout elements
      const elements = getSelectedTemplateElements()

      if (elements.length) {
        e.preventDefault()

        const items = getTemplateElementsIncludingMultiLayout(elements.map((e: TLayerStore) => e.getState()))
        // Because the order of the layers in the template editor is not guaranteed, we need to sort the layers by their _id before copying
        const extractedLayerIds = extractedLayerStores.map((layerStore: TLayerStore) => layerStore.getState()._id)
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
      }
    },
    [extractedLayerStores, getSelectedTemplateElements, t]
  )

  // Define function to paste copied template elements by keyboard
  const pasteElementsByKeyboard = useCallback(
    async (_: KeyPressContext, e: KeyboardEvent) => {
      let copiedText = ''

      try {
        copiedText = await navigator.clipboard.readText()
      } catch (_) {
        showToast(t(TOAST.COMMON.CLIPBOARD_BLOCKED), { isError: true })
        return
      }

      try {
        const items = JSON.parse(copiedText)

        if (!items?.[0]?._id) {
          return
        }

        // Prevent default event handler
        e.preventDefault()

        // Get template dimension
        const { dimension, shopDomain } = TemplateEditorStore.getState()
        const { width = 0, height = 0, measurementUnit = 'px', resolution = 300 } = dimension || {}

        const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
        const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)

        // Calculate position shift to centralize the elements being pasted
        const { topShift, leftShift } = getTopLeftShiftToEnsureLayersInsideCanvas(items, canvasWidth, canvasHeight)

        // Create elements based on copied data
        const createdLayers: any[] = duplicateLayers({
          layers: items,
          shopDomain,
          topShift,
          leftShift,
          validationErrorsContext: {
            validationErrors,
            setValidationErrors,
          },
        })
        const createdLayerStores = createdLayers.map(layerState => createLayerStore(layerState))

        // Find layers inside multi-layouts
        const layersInMultiLayouts = createdLayers
          .filter(l => {
            const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(l, createdLayers)

            return isLayerInsideMultiLayout
          })
          .map(l => l._id)

        if (createdLayerStores.length) {
          // Insert new layer stores into template editor
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
      } catch (e) {
        // Do nothing
      }
    },
    [extractedLayerStores, validationErrors, setValidationErrors, t]
  )

  // Define function to delete template elements by keyboard
  const deleteElementsByKeyboard = useCallback(
    () => ref && ref.deleteItems(getSelectedTemplateElementIds()),
    [getSelectedTemplateElementIds, ref]
  )

  // Define function to copy style of template element by keyboard
  const copyStyleByKeyboard = useCallback(
    async (_: KeyPressContext, e: KeyboardEvent) => {
      const elements = getSelectedTemplateElements()

      if (!elements.length) {
        return
      }

      // We take the first element as the style source (same behaviour as Canva)
      const styleObject = extractLayerStyle(elements[0].getState())

      if (Object.keys(styleObject).length) {
        e.preventDefault()
        const success = await copyStyleToClipboard(styleObject)
        if (success) {
          showToast(t(TOAST.COMMON.STYLE_COPIED))
        } else {
          showToast(t(TOAST.COMMON.CLIPBOARD_BLOCKED), { isError: true })
        }
      }
    },
    [getSelectedTemplateElements, t]
  )

  // Define function to paste style to selected template element(s)
  const pasteStyleByKeyboard = useCallback(
    async (_: KeyPressContext, e: KeyboardEvent) => {
      const styleObject = await readStyleFromClipboard()

      if (!styleObject) {
        return
      }

      const elements = getSelectedTemplateElements()

      if (!elements.length) {
        return
      }

      e.preventDefault()

      elements.forEach(layerStore => {
        applyStyleToLayer(layerStore, styleObject)
      })
      showToast(t(TOAST.COMMON.STYLE_PASTED))
    },
    [getSelectedTemplateElements, t]
  )

  const onToggleRulerMode = useCallback(() => {
    // Filter out move tool
    onQuickToolsChangeHandler('ruler-tool')
  }, [onQuickToolsChangeHandler])

  const onToggleGridMode = useCallback(() => {
    // Filter out move tool
    onQuickToolsChangeHandler('grid-tool')
  }, [onQuickToolsChangeHandler])

  const onUndoHandler = useCallback(() => {
    if (canUndo) {
      onUndo()
    }
  }, [canUndo, onUndo])

  const onRedoHandler = useCallback(() => {
    if (canRedo) {
      onRedo()
    }
  }, [canRedo, onRedo])

  // Define keyboard shortcuts
  const keyboardActions: KeyboardAction[] = useMemo(
    (): KeyboardAction[] => [
      {
        keyCode: 'ArrowUp',
        onAction: moveLayersByKeyboard,
      },
      {
        keyCode: 'ArrowDown',
        onAction: moveLayersByKeyboard,
      },
      {
        keyCode: 'ArrowLeft',
        onAction: moveLayersByKeyboard,
      },
      {
        keyCode: 'ArrowRight',
        onAction: moveLayersByKeyboard,
      },
      {
        altKey: true,
        keyCode: 'ArrowUp',
        onAction: moveLayersByKeyboard,
      },
      {
        altKey: true,
        keyCode: 'ArrowDown',
        onAction: moveLayersByKeyboard,
      },
      {
        altKey: true,
        keyCode: 'ArrowLeft',
        onAction: moveLayersByKeyboard,
      },
      {
        altKey: true,
        keyCode: 'ArrowRight',
        onAction: moveLayersByKeyboard,
      },
      {
        shiftKey: true,
        keyCode: 'ArrowUp',
        onAction: selectSiblingElementsByKeyboard,
      },
      {
        shiftKey: true,
        keyCode: 'ArrowDown',
        onAction: selectSiblingElementsByKeyboard,
      },
      {
        altKey: true,
        shiftKey: true,
        keyCode: 'ArrowUp',
        onAction: reorderElementsByKeyboard,
      },
      {
        altKey: true,
        shiftKey: true,
        keyCode: 'ArrowDown',
        onAction: reorderElementsByKeyboard,
      },
      {
        altKey: true,
        ctrlKey: true,
        keyCode: 'ArrowUp',
        onAction: reorderElementsByKeyboard,
      },
      {
        altKey: true,
        ctrlKey: true,
        keyCode: 'ArrowDown',
        onAction: reorderElementsByKeyboard,
      },
      {
        ctrlKey: true,
        keyCode: 'KeyA',
        preventDefault: true,
        onAction: selectAllElementsByKeyboard,
      },
      {
        metaKey: true,
        keyCode: 'KeyA',
        preventDefault: true,
        onAction: selectAllElementsByKeyboard,
      },
      {
        altKey: true,
        ctrlKey: true,
        keyCode: 'KeyD',
        onAction: deselectAllElementsByKeyboard,
      },
      {
        altKey: true,
        ctrlKey: true,
        keyCode: 'KeyE',
        onAction: centralizeElementsByKeyboard,
      },
      {
        altKey: true,
        ctrlKey: true,
        keyCode: 'KeyG',
        onAction: groupElementsByKeyboard,
      },
      {
        altKey: true,
        ctrlKey: true,
        keyCode: 'KeyU',
        onAction: ungroupElementsByKeyboard,
      },
      {
        metaKey: true,
        keyCode: 'KeyC',
        onAction: copyElementsByKeyboard,
      },
      {
        metaKey: true,
        keyCode: 'KeyV',
        onAction: pasteElementsByKeyboard,
      },
      {
        ctrlKey: true,
        keyCode: 'KeyC',
        onAction: copyElementsByKeyboard,
      },
      {
        ctrlKey: true,
        keyCode: 'KeyV',
        onAction: pasteElementsByKeyboard,
      },
      {
        keyCode: 'Backspace',
        onAction: deleteElementsByKeyboard,
      },
      {
        keyCode: 'KeyR',
        shiftKey: true,
        onAction: onToggleRulerMode,
      },
      {
        keyCode: 'KeyG',
        shiftKey: true,
        onAction: onToggleGridMode,
      },
      {
        metaKey: true,
        keyCode: 'KeyZ',
        preventDefault: true,
        onAction: onUndoHandler,
      },
      {
        metaKey: true,
        keyCode: 'KeyZ',
        shiftKey: true,
        preventDefault: true,
        onAction: onRedoHandler,
      },
      {
        ctrlKey: true,
        keyCode: 'KeyZ',
        preventDefault: true,
        onAction: onUndoHandler,
      },
      {
        ctrlKey: true,
        keyCode: 'KeyZ',
        shiftKey: true,
        preventDefault: true,
        onAction: onRedoHandler,
      },
      {
        shiftKey: true,
        metaKey: true,
        keyCode: 'KeyC',
        onAction: copyStyleByKeyboard,
      },
      {
        shiftKey: true,
        metaKey: true,
        keyCode: 'KeyV',
        onAction: pasteStyleByKeyboard,
      },
      {
        shiftKey: true,
        ctrlKey: true,
        keyCode: 'KeyC',
        onAction: copyStyleByKeyboard,
      },
      {
        shiftKey: true,
        ctrlKey: true,
        keyCode: 'KeyV',
        onAction: pasteStyleByKeyboard,
      },
      {
        altKey: true,
        shiftKey: true,
        metaKey: true,
        keyCode: 'KeyC',
        onAction: copyStyleByKeyboard,
      },
      {
        altKey: true,
        shiftKey: true,
        metaKey: true,
        keyCode: 'KeyV',
        onAction: pasteStyleByKeyboard,
      },
      {
        altKey: true,
        shiftKey: true,
        ctrlKey: true,
        keyCode: 'KeyC',
        onAction: copyStyleByKeyboard,
      },
      {
        altKey: true,
        shiftKey: true,
        ctrlKey: true,
        keyCode: 'KeyV',
        onAction: pasteStyleByKeyboard,
      },
    ],
    [
      moveLayersByKeyboard,
      selectSiblingElementsByKeyboard,
      reorderElementsByKeyboard,
      selectAllElementsByKeyboard,
      deselectAllElementsByKeyboard,
      centralizeElementsByKeyboard,
      groupElementsByKeyboard,
      ungroupElementsByKeyboard,
      copyElementsByKeyboard,
      pasteElementsByKeyboard,
      deleteElementsByKeyboard,
      onToggleRulerMode,
      onToggleGridMode,
      onUndoHandler,
      onRedoHandler,
      copyStyleByKeyboard,
      pasteStyleByKeyboard,
    ]
  )

  return (
    <LayerListing
      t={t}
      setRef={setRef}
      items={memoExtractedLayerStores}
      keyboardActions={keyboardActions}
      verifyKeyboardAction={verifyKeyboardAction}
    />
  )
}
