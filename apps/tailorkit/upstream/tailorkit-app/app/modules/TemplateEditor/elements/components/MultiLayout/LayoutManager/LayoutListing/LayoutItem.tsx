import {
  BlockStack,
  Box,
  Button,
  Checkbox,
  Divider,
  Icon,
  InlineError,
  InlineStack,
  Thumbnail,
  Tooltip,
} from '@shopify/polaris'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DeleteIcon,
  ReplaceIcon,
  SkeletonIcon,
  TextIcon,
} from '@shopify/polaris-icons'
import type { Layer, Layout } from '~/types/psd'
import type { ILayoutManagerProps } from '..'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TLayerStore } from '~/stores/modules/layer'
import { getLayerStoreById } from '~/stores/modules/layer'
import ContentEditableField from '~/components/common/ContentEditableField'
import { MAX_LAYER_NAME_SIZE, MAX_LAYOUT_NAME_SIZE } from '~/constants/canvas'
import SortableItemList from '~/modules/SortableItemList'
import { LayerThumbnail } from '~/modules/TemplateEditor/components/Outline/LayerThumbnail'
import type { SortableItemListProps } from '~/modules/SortableItemList/types'
import { SortableList } from '~/components/common/SortableList'
import { useStore } from '~/libs/external-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useTranslation } from 'react-i18next'

function LayoutItem(
  props: Layout & { index: number } & Omit<
      ILayoutManagerProps,
      | 'layouts'
      | 'onAddMoreLayout'
      | 'onAddStaticLayers'
      | 'checkExistedLayerHasNoOptionSet'
      | 'onNavigateToOutlineToCreateOptionSet'
    >
) {
  const {
    multiLayoutElementId,
    name,
    _id,
    thumbnail,
    layoutSelected,
    layerIds,
    onChangeLayoutSelected,
    onChangeLayersOrderOfLayout,
    onClickLayer,
    onChangeNameLayerSelected,
    onDeleteLayout,
    onChangeNameLayoutSelected,
    toggleSelectThumbnailModal,
    onChangeLayer,
    onDeleteLayer,
  } = props
  const [layoutName, setLayoutName] = useState(name)
  const selected = _id === layoutSelected
  const { t } = useTranslation()
  const [layoutChecked, setLayoutChecked] = useState(false)

  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)

  const memoItems = useMemo(() => {
    const items: Array<Layer & { id: string }> = []

    for (const layerId of layerIds) {
      const store = getLayerStoreById(layerId)
      if (!store) {
        continue
      }
      const layerState = store.getState()
      items.push({ ...layerState, id: layerState._id } as Layer & { id: string })
    }

    return items
  }, [layerIds])

  // Use ref to track checkedLayerStores and memoItems to avoid re-render multiple times
  const checkedLayerStoresRef = useRef(checkedLayerStores)
  const memoItemsRef = useRef(memoItems)

  /**
   * Utility function to handle toggling checked state for both layout and layer items
   * @param itemIds Array of item IDs to toggle
   * @param checked New checked state
   * @param clearCheckedLayerStore Whether to clear existing checked stores before adding new ones
   */
  const handleToggleCheckedState = useCallback(
    (itemIds: string[], checked: boolean, clearCheckedLayerStore?: boolean) => {
      const multiLayoutElementStore = getLayerStoreById(multiLayoutElementId)
      if (!multiLayoutElementStore) return

      setTimeout(() => {
        const checkedLayerStores = checkedLayerStoresRef.current || []
        const currentSelection = LayerStoreSelection.getState()
        const currentClickedLayerStore = currentSelection.clickedLayerStore

        const _checkedLayerStores = checked
          ? Array.from(
              new Set([
                ...(clearCheckedLayerStore ? [] : checkedLayerStores),
                ...itemIds.map(id => getLayerStoreById(id)),
              ])
            )
          : [...checkedLayerStores.filter((ls: TLayerStore) => !itemIds.includes(ls.getState()._id))]

        // Determine clickedLayerStore based on checked items count
        let clickedLayerStore: TLayerStore | null = null
        if (_checkedLayerStores.length === 0) {
          // When all items are unchecked, preserve MultiLayout element to keep inspector visible
          clickedLayerStore = multiLayoutElementStore
        } else if (_checkedLayerStores.length === 1) {
          // When exactly one item is checked, set it as clickedLayerStore
          clickedLayerStore = _checkedLayerStores[0]
        } else {
          // When multiple items are checked, preserve current clickedLayerStore if it's the MultiLayout element
          // Otherwise, don't modify it (keep current value)
          if (currentClickedLayerStore && currentClickedLayerStore.getState()._id === multiLayoutElementId) {
            clickedLayerStore = multiLayoutElementStore
          }
          // If current clickedLayerStore is not MultiLayout element, don't change it
        }

        LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: {
            checkedLayerStores: _checkedLayerStores,
            ...(clickedLayerStore !== null ? { clickedLayerStore } : {}),
          },
        })
      }, 0)
    },
    [multiLayoutElementId]
  )

  const toggleLayoutItemCheckedState = useCallback(
    (_id: string, checked: boolean) => {
      const memoItemsIds = memoItemsRef.current.map(item => item._id)
      setLayoutChecked(checked)
      // All state updates are handled by handleToggleCheckedState in a single dispatch
      handleToggleCheckedState(memoItemsIds, checked)
    },
    [handleToggleCheckedState]
  )

  const onChangeLayersOrderHandler = useCallback(
    (items: Layer[]) => {
      onChangeLayersOrderOfLayout(
        _id,
        items.map(item => item._id)
      )
    },
    [_id, onChangeLayersOrderOfLayout]
  )

  const onBlur = useCallback(
    (value: string) => {
      const realValue = value.trim() || name || t('option-index', { index: memoItems.length + 1 })
      setLayoutName(realValue)
      onChangeNameLayoutSelected(realValue)
    },
    [name, onChangeNameLayoutSelected, memoItems, t]
  )

  useEffect(() => {
    checkedLayerStoresRef.current = checkedLayerStores
  }, [checkedLayerStores])

  useEffect(() => {
    memoItemsRef.current = memoItems
  }, [memoItems])

  // Effect to track the state of child checkboxes and update the parent checkbox accordingly
  useEffect(() => {
    if (selected && memoItems.length > 0) {
      const allItemIds = memoItems.map(item => item._id)
      const allChecked = allItemIds.every(id => checkedLayerStores.some(ls => ls.getState()._id === id))
      setLayoutChecked(allChecked)
    }
  }, [selected, memoItems, checkedLayerStores])

  return (
    <div
      style={{ cursor: 'pointer' }}
      onClick={() => {
        if (selected) return

        const multiLayoutElementStore = getLayerStoreById(multiLayoutElementId)
        if (!multiLayoutElementStore) return

        LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: {
            clickedLayerStore: multiLayoutElementStore,
          },
        })
        onChangeLayoutSelected(_id)
      }}
    >
      <Box padding={'200'} background={selected ? 'bg-fill-active' : 'bg-fill'} borderRadius="100">
        <InlineStack align="space-between">
          <InlineStack gap={'100'} blockAlign="center" align="start">
            <div
              style={{
                overflow: 'hidden',
                borderWidth: 'var(--p-border-width-025)',
                borderRadius: 'var(--p-border-radius-150)',
                borderColor: 'var(--p-color-border)',
                borderStyle: 'solid',
              }}
              onClick={() => {
                toggleSelectThumbnailModal()
              }}
            >
              {thumbnail.includes('svg') ? (
                <Icon source={thumbnail} />
              ) : (
                <Thumbnail size="extraSmall" source={getShopifyThumbnail(thumbnail)} alt={name} />
              )}
            </div>
            <InlineStack>
              <Icon source={selected ? ChevronDownIcon : ChevronRightIcon} />
            </InlineStack>
            <Box maxWidth="192px">
              <ContentEditableField
                title={layoutName}
                maxLength={MAX_LAYOUT_NAME_SIZE}
                classEditing="editing"
                maxWidth={'192px'}
                contentEditable={selected}
                stopPropagation={selected}
                setTitle={setLayoutName}
                onBlur={onBlur}
              />
            </Box>
          </InlineStack>

          <InlineStack wrap={false} blockAlign="center" gap={'050'}>
            <div
              onClick={e => {
                e.stopPropagation()

                const checkedLayerIds = checkedLayerStores.map((ls: TLayerStore) => ls.getState()._id)

                // If no layers are checked, delete all layers in the layout
                const layersToDelete
                  = checkedLayerIds.length > 0 ? layerIds.filter(id => checkedLayerIds.includes(id)) : layerIds

                onDeleteLayout(_id, layersToDelete)
              }}
            >
              <Icon source={DeleteIcon} tone="subdued" />
            </div>
            <Checkbox
              id={_id}
              label=""
              labelHidden={true}
              onChange={() => toggleLayoutItemCheckedState(_id, !layoutChecked)}
              checked={selected && layoutChecked}
            />
          </InlineStack>
        </InlineStack>
      </Box>

      {selected && (
        <Box paddingBlockStart={'200'}>
          <BlockStack gap={'200'}>
            <Divider borderColor="border" />
            <Box paddingInlineStart={'600'}>
              <SortableItemList
                items={memoItems}
                onClick={onClickLayer}
                canAddNewItems={false}
                maxLabelLength={MAX_LAYER_NAME_SIZE}
                onListChange={onChangeLayersOrderHandler}
                sortableItemStyle={{ background: 'white' }}
                onItemChange={(id: string, data: any) => onChangeNameLayerSelected(id, data.name)}
                renderItem={(props: any) => (
                  <SortableLayoutItem
                    {...props}
                    key={props.item._id}
                    items={memoItems}
                    onChangeLayer={onChangeLayer}
                    onDeleteLayer={onDeleteLayer}
                    onToggleCheckedLayerItem={handleToggleCheckedState}
                  />
                )}
              />
            </Box>
          </BlockStack>
        </Box>
      )}
    </div>
  )
}

function SortableLayoutItem(
  props: SortableItemListProps &
    Partial<ILayoutManagerProps> & {
      listRef: SortableItemList<void, void>
      item: any
      onToggleCheckedLayerItem: (itemIds: string[], checked: boolean, clearCheckedLayerStore?: boolean) => void
    }
) {
  const {
    item,
    listRef,
    disabled,
    canEditItems,
    getItemError,
    inlineItemGap,
    itemHtmlClass,
    itemBoxPadding,
    maxLabelLength,
    editingHtmlClass,
    sortableItemStyle,
    onChangeLayer,
    onDeleteLayer,
    onToggleCheckedLayerItem,
  } = props

  const id = listRef.getItemId(item)
  const label = listRef.getItemLabel(item)
  const errorMsg = typeof getItemError === 'function' ? getItemError(item) : null

  const diff = disabled || !canEditItems ? '28px' : label ? '140px' : '84px'

  const labelWidth = `calc(100% - ${diff})`

  const visible = useStore(getLayerStoreById(id), state => state.visible)
  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)

  const checkedLayerStoreIds = useMemo(
    () => checkedLayerStores.map((ls: TLayerStore) => ls.getState()._id),
    [checkedLayerStores]
  )

  const handleClick = useCallback(
    (e: any) => {
      e && e.stopPropagation()

      // Check if the click target is a checkbox, button, or icon (user is interacting with controls)
      const isInteractingWithControls
        = e.target.closest('input[type="checkbox"]') || e.target.closest('button') || e.target.closest('.Polaris-Icon')

      // If not interacting with controls, check the layer
      if (!isInteractingWithControls) {
        onToggleCheckedLayerItem([id], true, true)
      }

      !disabled && canEditItems && listRef.setEditing(id)
    },
    [canEditItems, disabled, id, listRef, onToggleCheckedLayerItem]
  )

  const toggleItemCheckedState = useCallback(
    (checked: boolean) => {
      // All state updates are handled by onToggleCheckedLayerItem (which calls handleToggleCheckedState) in a single dispatch
      onToggleCheckedLayerItem([id], checked)
    },
    [id, onToggleCheckedLayerItem]
  )

  // Use label or fallback to legacyName or _id - match LayersSearchable.tsx behavior
  // This ensures we always have a display label, even if label is empty string
  const displayLabel = label || item.legacyName || item._id || ''

  return (
    <SortableList.Item
      id={id}
      key={id}
      onClick={() => listRef.onClick(id)}
      styles={{ padding: '0px', opacity: visible ? 1 : 0.5, ...sortableItemStyle }}
    >
      <div style={{ width: '100%' }} className={itemHtmlClass} onClick={handleClick}>
        <Box padding={itemBoxPadding} paddingInlineEnd="200">
          <InlineStack gap={inlineItemGap} blockAlign="center" wrap={false}>
            {disabled ? <div style={{ width: '30px' }} /> : <SortableList.DragHandle />}
            {item.type === 'text' ? (
              <Thumbnail source={TextIcon} alt="text-icon" size="extraSmall" />
            ) : item.type === 'imageless' ? (
              <Thumbnail source={SkeletonIcon} alt="text-icon" size="extraSmall" />
            ) : item.type === 'image' ? (
              <LayerThumbnail src={getShopifyThumbnail(item.image?.src || item.image?.dataSrc || '')} />
            ) : (
              <Fragment></Fragment>
            )}
            <Box width={labelWidth}>
              <Tooltip content={displayLabel}>
                <ContentEditableField
                  title={displayLabel}
                  maxLength={maxLabelLength}
                  classEditing={editingHtmlClass}
                  contentEditable={!disabled && canEditItems}
                  stopPropagation={!disabled && canEditItems}
                  showTooltip={false}
                  setTitle={name => {
                    listRef.setItemLabel(id, name)
                    listRef.validateItem({ ...item, name })
                  }}
                />
              </Tooltip>
            </Box>
            <InlineStack wrap={false} gap="050" align="end" blockAlign="center">
              <Button
                variant="plain"
                onClick={() => onChangeLayer(id)}
                icon={<Icon source={ReplaceIcon} tone="subdued" />}
              />
              <Button
                variant="plain"
                onClick={() => onDeleteLayer(id)}
                icon={<Icon source={DeleteIcon} tone="subdued" />}
              />
              <Checkbox
                id={id}
                label=""
                labelHidden={true}
                disabled={!visible}
                onChange={toggleItemCheckedState}
                checked={checkedLayerStoreIds.includes(id)}
              />
            </InlineStack>
          </InlineStack>

          {errorMsg && (
            <Box paddingInlineStart={'800'}>
              <InlineError fieldID={id} message={errorMsg} />
            </Box>
          )}
        </Box>
      </div>
    </SortableList.Item>
  )
}

export default LayoutItem
