import { RenderElementOutline } from '~/modules/TemplateEditor/elements/render.client'
import { checkLayerInsideMultiLayout } from '~/modules/TemplateEditor/elements/fns'
import { GroupableItemList } from '~/modules/GroupableItemList/index'
import { createLayerStore, getLayerStoreById, type TLayerStore } from '~/stores/modules/layer'
import type { LayerDocument } from '~/models/Layer.server'
import { TemplateEditorStore } from '~/stores/modules/template'
import { uuid } from '~/utils/uuid'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useStore } from '~/libs/external-store'
import {
  MUTATION_LAYER_FROM_INSPECTOR_EVENTS,
  TEMPLATE_EDITOR_TRANSMISSION_EVENTS,
} from '~/modules/TemplateEditor/constants'
import { showToast } from '~/utils/toastEvents'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import type { Layer } from '~/types/psd'
import { ELayerType, EOptionSet, MULTI_LAYOUT_OPTION_TYPE } from '~/types/psd'
import type { WithKeyboardShortcutProps } from '~/bootstrap/hoc/withKeyboardShortcut'
import { EmptyLayerState } from '../EmptyLayerState'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import type { IImageQuery } from '~/types/shopify-files'
import { getFileNameWithoutExtension } from '~/utils/file-types'
import { SubInspectorStore, subInspectorStoreActions } from '~/stores/canvas/subInspector'
import { Button, Icon, InlineStack, Tooltip } from '@shopify/polaris'
import { ImageIcon, MagicIcon, PlusCircleIcon, SlideshowIcon } from '@shopify/polaris-icons'
import { useChatBot } from '~/providers/ChatBotContext'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { useLayerActions } from '~/modules/TemplateEditor/hooks/useLayerActions'
import ImageSelectorComponent from '../Header/ImageSelectorComponent'
import { useElementActions } from '../../Editor/hooks/useElementActions'

type ILayerListingProps = WithKeyboardShortcutProps & {
  t: (key: string) => string
  items: TLayerStore[]
  setRef?: (ref: HTMLDivElement | null) => void
}

const queryKey = ['label', 'legacyName']

function LayerListing(props: ILayerListingProps) {
  const { t, items, setRef } = props

  const { validationErrors, setValidationErrors } = useContext(TemplateEditorContext)
  const extractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const { onDuplicateItem, onDeleteItem } = useLayerActions()
  const { addElements } = useElementActions()

  // Close stale library-tools SubInspector on mount.
  // On mobile, the SubInspector portals into #tool-sidebar. If the store still has
  // key='library-tools' from a previous interaction, it would render immediately
  // when the ToolSidebar appears, making it look like the panel auto-opened.
  useEffect(() => {
    const { key } = SubInspectorStore.getState()
    if (key === 'library-tools') {
      subInspectorStoreActions.closeSubInspector()
    }
  }, [])

  // Image replacement modal state
  const { openModal } = useModal()

  // Get selected layers
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)
  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)

  const _items = useMemo(
    () =>
      items.map((item: TLayerStore) => {
        const { label, legacyName, ...rest } = item.getState()

        return {
          ...rest,
          label: label || legacyName,
        }
      }),
    [items]
  )

  const onClearValidationErrors = useCallback(
    (_layers: LayerDocument[], validationErrors: { [key: string]: string }) => {
      // Clear validation error if item exists errors
      _layers.forEach(layer => {
        const _id = layer._id

        const validationKeys = Object.keys(validationErrors).filter(key => key.includes(_id))

        validationKeys.forEach(validationKey => {
          if (validationKey) {
            delete validationErrors[validationKey]

            setValidationErrors(validationKey, '', null)
          }
        })
      })
    },
    [setValidationErrors]
  )

  const renderItem = useCallback(
    (item: LayerDocument) => {
      const layerStore = getLayerStoreById(item._id)
      return (
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <RenderElementOutline
              validationErrors={validationErrors}
              clickedLayerStore={clickedLayerStore}
              layerStore={layerStore}
            />
          </div>
        </div>
      )
    },
    [clickedLayerStore, validationErrors]
  )

  const onSetCheckedLayerStores = useCallback((ids: string[]) => {
    const _checkedLayerStores: TLayerStore[] = []

    ids.forEach(id => {
      // Get affected layer store
      const checkedLayerStore = getLayerStoreById(id)

      const layerState = checkedLayerStore.getState()

      _checkedLayerStores.push(checkedLayerStore)

      const { type } = layerState

      // Select all layers inside selected layout
      if (type === 'multi-layout') {
        const multiLayoutOptionSet = layerState.optionSet?.find(ot => ot.type === EOptionSet['MULTI_LAYOUT_OPTION'])

        if (multiLayoutOptionSet) {
          // @ts-ignore
          const multiLayoutOptionSetData = multiLayoutOptionSet.data[MULTI_LAYOUT_OPTION_TYPE]

          const layoutIdSelected = multiLayoutOptionSetData.layoutSelected
          const multiLayoutOptionSetLayouts = multiLayoutOptionSetData.layouts
          const layerIds = multiLayoutOptionSetLayouts.find(layout => layout._id === layoutIdSelected)?.layerIds || []

          _checkedLayerStores.push(...layerIds.map(layerId => getLayerStoreById(layerId)))
        }
      }
    })

    // Update selected layer store
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: {
        checkedLayerStores: _checkedLayerStores,
        // Clear clicked layer store
        clickedLayerStore: null,
      },
    })
  }, [])

  const onClick = useCallback(
    (clickedId?: string) => {
      // Get affected layer store
      const clickedLayerStore = clickedId && getLayerStoreById(clickedId)

      if (!clickedLayerStore) {
        LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: {
            clickedLayerStore: null,
            checkedLayerStores: [],
          },
        })
        return
      }

      const clickedLayerState = clickedLayerStore.getState()
      const allLayers = extractedLayerStores.map(ls => ls.getState()) as Layer[]

      // Check if clicked layer is inside a multi-layout
      const { isLayerInsideMultiLayout, multiLayoutLayerId } = checkLayerInsideMultiLayout(
        clickedLayerState as Layer,
        allLayers
      )

      let newCheckedLayerStores: TLayerStore[] = []

      // If clicking a multi-layout element, select all layers in the current layout
      if (clickedLayerState.type === 'multi-layout') {
        const multiLayoutOptionSet = clickedLayerState.optionSet?.find(ot => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)

        if (multiLayoutOptionSet) {
          // @ts-ignore
          const multiLayoutOptionSetData = multiLayoutOptionSet.data[MULTI_LAYOUT_OPTION_TYPE]
          const layoutIdSelected = multiLayoutOptionSetData.layoutSelected
          const layerIds
            = multiLayoutOptionSetData.layouts.find(layout => layout._id === layoutIdSelected)?.layerIds || []

          newCheckedLayerStores = layerIds.map(layerId => getLayerStoreById(layerId)).filter(Boolean)
        }
      }
      // If clicking a layer inside a multi-layout, select just that layer
      else if (isLayerInsideMultiLayout && multiLayoutLayerId) {
        newCheckedLayerStores = [clickedLayerStore]
      }
      // For regular layers, clear checked stores (single selection mode)
      else {
        newCheckedLayerStores = []
      }

      // Update selected layer store
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore,
          checkedLayerStores: newCheckedLayerStores,
        },
      })
    },
    [extractedLayerStores]
  )

  const onCheck = useCallback(
    (checkedIds: string[]) => {
      // Update selected layer store
      onSetCheckedLayerStores(checkedIds)
    },
    [onSetCheckedLayerStores]
  )

  const onItemChange = useCallback((id: string, state: any) => {
    // Read current selection from store to avoid race conditions
    // when multiple onItemChange calls happen rapidly (e.g., hiding a group with selected children)
    const currentSelection = LayerStoreSelection.getState()
    let _clickedLayerStore = currentSelection.clickedLayerStore
    let _checkLayerStores = currentSelection.checkedLayerStores
    let selectionUpdated = false

    // Check if visibility is changing to false - clear selection BEFORE state update
    if (state.visible === false) {
      _clickedLayerStore = _clickedLayerStore?.getState()?._id === id ? null : _clickedLayerStore
      _checkLayerStores = _checkLayerStores.filter(
        (checkedLayerStore: TLayerStore) => checkedLayerStore.getState()._id !== id
      )
      selectionUpdated = true
    }

    // Check if locked is changing to true - clear selection BEFORE state update
    if (state.locked === true) {
      _clickedLayerStore = _clickedLayerStore?.getState()?._id === id ? null : _clickedLayerStore
      _checkLayerStores = _checkLayerStores.filter(
        (checkedLayerStore: TLayerStore) => checkedLayerStore.getState()._id !== id
      )
      selectionUpdated = true
    }

    // Clear selection immediately to prevent flickering
    if (selectionUpdated) {
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: _clickedLayerStore,
          checkedLayerStores: _checkLayerStores,
        },
      })
    }

    const layerStore = getLayerStoreById(id)

    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: { state },
    })

    Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
      id,
      elementData: layerStore.getState(),
    })
  }, [])

  const onListChange = useCallback((ids: string[], skipTrace?: boolean) => {
    TemplateEditorStore.dispatch({
      type: 'SET_EXTRACTED_LAYER_IDS',
      payload: {
        extractedLayerStores: ids.map((id: string) => getLayerStoreById(id)),
      },
      skipTrace,
    })
  }, [])

  const onItemVisibleChange = useCallback((_id: string, _visible: boolean) => {
    // Selection clearing is now handled in onItemChange to prevent flickering
    // This callback is kept for GroupableItemList compatibility but no longer needed
  }, [])

  const onItemLockChange = useCallback((_id: string, _locked: boolean) => {
    // Selection clearing is now handled in onItemChange to prevent flickering
    // This callback is kept for GroupableItemList compatibility but no longer needed
  }, [])

  const getItemLabel = useCallback((layer: LayerDocument) => layer.label || layer.legacyName, [])

  const isDroppable = useCallback((layer: LayerDocument) => layer.type !== 'multi-layout', [])

  const { toggleChatBot } = useChatBot()
  const { trackAction } = useFeatureTracking('ai_assistant')

  const onAddElements = useCallback(() => {
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, {
      toolId: 'elements',
    })
  }, [])

  const generateGroup = useCallback(
    () =>
      createLayerStore({
        _id: uuid(),
        type: ELayerType.GROUP,
        label: t('group'),
      } as LayerDocument).getState(),
    [t]
  )

  const onDeleteItems = useCallback(
    (_layers: LayerDocument[]) => {
      // Delete layer stores
      _layers.forEach(_layer => onDeleteItem(_layer._id))

      const allLayerStores = TemplateEditorStore.getState().extractedLayerStores

      const removedLayerIds = _layers.map(_layer => _layer._id)
      // Remove layer from extracted layer stores
      TemplateEditorStore.dispatch({
        type: 'SET_EXTRACTED_LAYER_IDS',
        payload: {
          extractedLayerStores: allLayerStores.filter(
            _layerStore => !removedLayerIds.includes(_layerStore.getState()._id)
          ),
        },
      })

      // Clear all layer stores because we only delete layer when selecting layer
      // That means all layers selected will be deleted and no longer in store selection
      const currentCheckedLayerStores = LayerStoreSelection.getState().checkedLayerStores
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: null,
          checkedLayerStores: currentCheckedLayerStores.filter(
            _layerStore => !removedLayerIds.includes(_layerStore.getState()._id)
          ),
        },
      })

      // Clear validation errors
      onClearValidationErrors(_layers, validationErrors)
    },
    [onDeleteItem, onClearValidationErrors, validationErrors]
  )

  const onReplaceImage = useCallback(
    (layerId: string) => {
      // Open the existing image selector modal with replacement context
      openModal(MODAL_ID.IMAGE_SELECTOR_MODAL, {
        mode: 'replace',
        layerId,
        onReplaceImage: (imageSelected: IImageQuery[] | null) => {
          if (!imageSelected) {
            return
          }
          const {
            alt,
            image: { originalSrc, width, height },
          } = imageSelected[0]

          if (originalSrc) {
            const layerStore = getLayerStoreById(layerId)
            layerStore.dispatch({
              type: 'UPDATE_LAYER',
              payload: {
                state: {
                  image: {
                    _id: uuid(),
                    width,
                    height,
                    src: originalSrc!,
                    originalSrc: originalSrc!,
                    imageName: getFileNameWithoutExtension(alt),
                  },
                },
              },
            })
          }
        },
      })
    },
    [openModal]
  )

  const checkedLayerState = useMemo(
    () => checkedLayerStores.filter((c: TLayerStore) => Boolean(c?.getState())).map((c: TLayerStore) => c.getState()),
    [checkedLayerStores]
  )

  const checkedItems = useMemo(
    () =>
      checkedLayerStores
        .filter((checkedLayerStore: TLayerStore) => {
          // Exclude layers inside multi layout out of outline
          const layerState = checkedLayerStore?.getState() as Layer
          const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(layerState, checkedLayerState as Layer[])

          return layerState && !isLayerInsideMultiLayout
        })
        .map((checkedLayerStore: TLayerStore) => checkedLayerStore.getState()._id),
    [checkedLayerState, checkedLayerStores]
  )

  const highlightedItems = useMemo(() => {
    if (clickedLayerStore) {
      const { multiLayoutLayerId } = checkLayerInsideMultiLayout(
        clickedLayerStore?.getState() as Layer,
        extractedLayerStores.map(layerStore => layerStore.getState()) as Layer[]
      )

      const multiLayoutLayerStore = multiLayoutLayerId ? getLayerStoreById(multiLayoutLayerId) : null

      return [(multiLayoutLayerStore || clickedLayerStore).getState()._id]
    }

    return []
  }, [clickedLayerStore, extractedLayerStores])

  // Track counts in refs so closures always read the latest value.
  // GroupableItemList caches extra bulk actions once (extrasInjected flag),
  // so closure-captured values from useMemo would go stale.
  const checkedCountRef = useRef(0)
  checkedCountRef.current = checkedLayerState.length
  const imageLayerCountRef = useRef(0)
  imageLayerCountRef.current = checkedLayerState.filter(l => l.type === ELayerType.IMAGE).length

  // Extra bulk actions to open library tools sub-inspector (always visible when layers selected).
  // Stable reference — functions read refs at render time.
  // Guard onAction with checkedCountRef to prevent accidental triggers on mobile
  // (visibility:hidden buttons can still receive click events and overlap with checkbox).
  const extraBulkActions = useMemo(() => {
    return [
      () => ({
        content: (
          <Tooltip content={t('create-clipart')}>
            <Button variant="plain" icon={<Icon source={SlideshowIcon} />} />
          </Tooltip>
        ),
        onAction: () => {
          if (checkedCountRef.current <= 0) return
          subInspectorStoreActions.openSubInspector('library-tools', {
            tool: 'clipart',
            title: t('create-clipart'),
          })
        },
      }),
      () => ({
        content: (
          <Tooltip content={t('create-image-option-set')}>
            <Button variant="plain" icon={<Icon source={ImageIcon} />} disabled={imageLayerCountRef.current < 2} />
          </Tooltip>
        ),
        onAction: () => {
          if (checkedCountRef.current <= 0 || imageLayerCountRef.current < 2) return
          subInspectorStoreActions.openSubInspector('library-tools', {
            tool: 'image-option-set',
            title: t('create-image-option-set'),
          })
        },
      }),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const onRegisterChangeListener = useCallback((cb: (e: any) => void) => {
    Transmitter.listen(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, cb)
  }, [])

  const onDeregisterChangeListener = useCallback((cb: (e: any) => void) => {
    Transmitter.remove(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, cb)
  }, [])

  const onRegisterClearValidationErrorsListener = useCallback(() => {
    Transmitter.listen(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.CLEAR_VALIDATION_ERRORS, e => {
      const layerIds = e.data.layerIds

      if (layerIds) {
        onClearValidationErrors(
          layerIds.map((id: string) => getLayerStoreById(id).getState()),
          validationErrors
        )
      }
    })
  }, [onClearValidationErrors, validationErrors])

  const onDeregisterClearValidationErrorsListener = useCallback(() => {
    Transmitter.remove(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.CLEAR_VALIDATION_ERRORS, () => {})
  }, [])

  const onRegisterShakeValidationErrorsListener = useCallback(() => {
    Transmitter.listen(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.SHAKE_VALIDATION_ERROR_LAYERS, () => {
      try {
        // Find all error keys to locate layer ids
        const errorKeys = Object.keys(validationErrors || {})
        // Build from actually rendered ids; error keys are `${id}-${dataKey}`
        const renderedIds = (_items || []).map((it: any) => it._id).filter(Boolean)
        const errorLayerIds = Array.from(
          new Set(
            errorKeys
              .map(key => renderedIds.find((rid: string) => key.startsWith(`${rid}-`)))
              .filter(Boolean) as string[]
          )
        )

        // Add shake class to each error row briefly
        errorLayerIds.forEach(id => {
          const li = document.querySelector(`.groupable--item[data-id="${id}"]`) as HTMLElement | null
          const label = li?.querySelector('.groupable--item-label') as HTMLElement | null
          const target = label || li
          if (!target) return
          target.classList.remove('groupable--shake')
          // Force reflow to restart animation if already present
          // eslint-disable-next-line no-unused-expressions
          void target.offsetWidth
          target.classList.add('groupable--shake')
          setTimeout(() => target.classList.remove('groupable--shake'), 600)
        })
      } catch (_) {
        // no-op
      }
    })
  }, [_items, validationErrors])

  const onDeregisterShakeValidationErrorsListener = useCallback(() => {
    Transmitter.remove(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.SHAKE_VALIDATION_ERROR_LAYERS, () => {})
  }, [])

  useEffect(() => {
    onRegisterClearValidationErrorsListener()
    onRegisterShakeValidationErrorsListener()

    return () => {
      onDeregisterClearValidationErrorsListener()
      onDeregisterShakeValidationErrorsListener()
    }
  }, [
    onDeregisterClearValidationErrorsListener,
    onRegisterClearValidationErrorsListener,
    onRegisterShakeValidationErrorsListener,
    onDeregisterShakeValidationErrorsListener,
  ])

  const onRenderError = useCallback((error: Error) => {
    return <ErrorBoundary error={error} />
  }, [])

  return (
    <div>
      {items?.length ? (
        <>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button icon={PlusCircleIcon} variant="primary" fullWidth onClick={onAddElements}>
              {t('add-elements')}
            </Button>
            <button
              onClick={() => {
                trackAction('elva_ai_clicked', { source: 'layer_listing' })
                toggleChatBot(true)
              }}
              type="button"
              style={{
                all: 'unset',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                padding: '7px 0',
                borderRadius: 'var(--p-border-radius-200)',
                background: 'linear-gradient(135deg, #7c3aed12, #a855f712)',
                border: '1px solid var(--p-color-border-magic)',
                cursor: 'pointer',
                boxSizing: 'border-box',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--p-color-text-magic)',
              }}
            >
              <InlineStack gap="100" align="center" blockAlign="center">
                <Icon source={MagicIcon} tone="magic" />
                <span>{t('generate-with-ai')}</span>
              </InlineStack>
            </button>
          </div>
          <GroupableItemList
            items={_items}
            setRef={setRef}
            checkedItems={checkedItems}
            highlightedItems={highlightedItems}
            extraBulkActions={extraBulkActions}
            onClick={onClick}
            onCheck={onCheck}
            generateId={uuid}
            renderItem={renderItem}
            showMessage={showToast}
            isDroppable={isDroppable}
            getItemLabel={getItemLabel}
            onItemChange={onItemChange}
            onListChange={onListChange}
            generateGroup={generateGroup}
            onDeleteItems={onDeleteItems}
            onDuplicateItem={onDuplicateItem}
            onItemLockChange={onItemLockChange}
            onItemVisibleChange={onItemVisibleChange}
            queryKey={queryKey}
            dataKeyToSyncChanges="data.elementData"
            renderError={onRenderError}
            registerChangeListener={onRegisterChangeListener}
            deregisterChangeListener={onDeregisterChangeListener}
            onReplaceImage={onReplaceImage}
          />
        </>
      ) : (
        <EmptyLayerState t={t} />
      )}
      <ImageSelectorComponent addElements={addElements} />
    </div>
  )
}

export default LayerListing
