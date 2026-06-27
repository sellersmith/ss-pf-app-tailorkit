import type { ReactNode } from 'react'
import type { ItemList, SortableItem, SortableItemListProps, SortableItemListState } from './types'
import isEqual from 'lodash/isEqual'
import isEmpty from 'lodash/isEmpty'
import { t } from 'i18next'
import { uuid } from '~/utils/uuid'
import { PureComponent, Fragment } from 'react'
import { getObjectValueByKeyPath } from '~/bootstrap/fns/misc'
import { SortableList } from '~/components/common/SortableList'
import { AlertCircleIcon, DeleteIcon, PlusIcon } from '@shopify/polaris-icons'
import {
  BlockStack,
  Box,
  Button,
  Icon,
  InlineError,
  InlineStack,
  Scrollable,
  Text,
  Thumbnail,
  Tooltip,
} from '@shopify/polaris'
import { getShopifyThumbnail } from '~/utils/loadImage'
import TextFieldComponent from '~/components/common/TextFieldComponent'

export default class SortableItemList<P, S> extends PureComponent<
  P & SortableItemListProps,
  S & SortableItemListState
> {
  declare props: P & SortableItemListProps

  declare hasImage: boolean

  static defaultProps: SortableItemListProps = {
    items: [],
    disabled: false,
    canEditItems: true,
    blockItemGap: '200',
    inlineItemGap: '200',
    canAddNewItems: true,
    canDeleteItems: true,
    itemBoxPadding: '100',
    editingClass: 'editing',
    containerHeight: '220px',
    addNewItemLabel: 'Add item',
    dataKeyToSyncChanges: 'data',
    deleteItemLabel: 'Delete item',
    inputPlaceholder: 'Input text',
    editingHtmlClass: 'editing',
    actionsAlwaysVisible: false,
  }

  state: S & SortableItemListState = { items: [] }

  static getDerivedStateFromError(error: Error): any {
    return { error }
  }

  static getDerivedStateFromProps(props: SortableItemListProps, state: SortableItemListState) {
    let newState: SortableItemListState = null

    const { items } = state
    const isItemsChanged = !isEqual(props.items, items)
    const isExternalUpdate = [typeof props.onItemChange, typeof props.onListChange].includes('function')

    if (isExternalUpdate && isItemsChanged) {
      // Build the fresh state object starting from the existing one but without
      // any stale cached "name-*" or "name-* -focus" keys, so the UI can pick
      // up new values coming from props immediately.
      const cleanedState: any = {}

      Object.keys(state).forEach(key => {
        // Keep everything except the cached name values
        if (!key.startsWith('name-')) {
          cleanedState[key] = state[key]
        }
      })

      // Inject the updated items array coming from props, deep cloning so
      // further external mutations do not tamper with equality checks
      cleanedState.items = props.items.map((item: any) => ({ ...item }))

      // Reset per-item input caches so TextField picks up new name values
      props.items.forEach((item: any) => {
        const id = typeof props.getItemId === 'function' ? props.getItemId(item) : item.id || item._id
        cleanedState[`name-${id}`] = undefined
        cleanedState[`name-${id}-focus`] = false
      })

      newState = cleanedState
    }

    // Remove internalUpdate flag (if any) on every pass so that subsequent
    // updates are detected correctly.
    const result = newState || { ...state }
    if ('internalUpdate' in result) {
      delete (result as any).internalUpdate
    }

    return result
  }

  constructor(props: P & SortableItemListProps) {
    super(props)

    if (this.props.items) {
      // Deep clone each item so that external in-place mutations do not make
      // our internal state equal by reference – this is critical for
      // getDerivedStateFromProps to detect future updates correctly.
      this.state.items = this.props.items.map((item: any) => ({ ...item }))
    }
  }

  render(): ReactNode {
    const { error, items = [] } = this.state

    const {
      className,
      disabled,
      renderError,
      customFooter,
      customHeader,
      blockItemGap,
      canEditItems,
      canAddNewItems,
      addNewItemLabel,
      containerHeight,
      dataInfoMessage,
    } = this.props

    return error ? (
      typeof renderError === 'function' && renderError(error)
    ) : (
      <BlockStack gap={blockItemGap}>
        {customHeader}

        <Scrollable
          {...(className ? { className } : {})}
          height={containerHeight}
          style={{ maxHeight: containerHeight }}
        >
          <SortableList
            renderItem={this.renderItem}
            onChange={(items: any[]) => !disabled && canEditItems && this.setListData(items)}
            items={items.map((item: SortableItem) => Object.assign(item, { id: this.getItemId(item) }))}
          />

          {dataInfoMessage && (
            <Box paddingBlockStart={'100'}>
              <InlineStack gap={'100'} wrap={false} blockAlign="start">
                <span style={{ width: '16px' }}>
                  <Icon source={AlertCircleIcon} />
                </span>
                <Text as="p" variant="bodySm" tone="subdued">
                  {dataInfoMessage}
                </Text>
              </InlineStack>
            </Box>
          )}
        </Scrollable>

        {canAddNewItems
          && (typeof addNewItemLabel === 'string' ? (
            <div className="add-item-sortable">
              <InlineStack align="end">
                <Button variant="plain" icon={PlusIcon} onClick={this.addItem} disabled={disabled}>
                  {t(addNewItemLabel)}
                </Button>
              </InlineStack>
            </div>
          ) : (
            addNewItemLabel
          ))}

        {customFooter}
      </BlockStack>
    )
  }

  getItemStyles = (item: SortableItem) => {
    const { getItemStyles } = this.props

    return typeof getItemStyles === 'function' ? getItemStyles(item) : {}
  }

  renderItem = (item: SortableItem) => {
    const {
      disabled,
      renderItem,
      customThumb,
      renderImage,
      canEditItems,
      getItemError,
      inlineItemGap,
      itemHtmlClass,
      renderActions,
      canDeleteItems,
      itemBoxPadding,
      maxLabelLength,
      deleteItemLabel,
      inputFieldLabel,
      inputPlaceholder,
      sortableItemStyle,
      customExtraActions,
      actionsAlwaysVisible,
    } = this.props

    if (typeof renderItem === 'function') {
      return renderItem({ ...this.props, item, listRef: this })
    }

    const id = this.getItemId(item)
    const image = this.getItemImage(item)
    const label = this.getItemLabel(item)
    const defaultLabel = this.getItemDefaultLabel(item)
    const thumb = typeof customThumb === 'function' ? customThumb(item) : customThumb

    this.hasImage = Boolean(image || thumb)

    const errorMsg = typeof getItemError === 'function' ? getItemError(item) : null

    const diff = this.hasImage ? (disabled || !canEditItems ? '84px' : '112px') : disabled ? '0px' : '68px'

    const labelWidth = `calc(100% - ${diff})`

    const isLabelTruncated = label && !this.state[`name-${id}-focus`]

    const renderInputField = canEditItems ? (
      <InlineStack gap="200" wrap={false} align="space-between">
        <div style={{ flex: 1 }}>
          <Tooltip content={isLabelTruncated ? label : ''}>
            <TextFieldComponent
              size="slim"
              id={`name-${id}`}
              value={this.state[`name-${id}`] ?? label}
              label={inputFieldLabel}
              labelHidden
              autoComplete="off"
              customStyles={this.getItemStyles(item)}
              maxLength={maxLabelLength}
              placeholder={inputPlaceholder}
              disabled={disabled}
              focused={this.state[`name-${id}-focus`]}
              onChange={value => {
                this.setState({ [`name-${id}`]: value })
                this.setItemLabel(id, value)

                if (errorMsg) {
                  this.validateItem({ ...item, name: value })
                }
              }}
              onBlur={() => {
                const name = this.state[`name-${id}`] || label || defaultLabel
                this.setState({ [`name-${id}`]: name })
                this.setItemLabel(id, name)
                this.validateItem({ ...item, name })
                this.setState({ [`name-${id}-focus`]: false })
              }}
              onFocus={() => {
                this.setState({ [`name-${id}-focus`]: true })
              }}
            />
          </Tooltip>
        </div>
        {customExtraActions && customExtraActions(item)}
      </InlineStack>
    ) : (
      <h3 style={{ ...this.getItemStyles(item) }}>{label}</h3>
    )

    const extraClass = actionsAlwaysVisible ? 'always-visible-actions' : ''

    return (
      <SortableList.Item
        className={extraClass}
        id={id}
        key={id}
        onClick={() => this.onClick(id)}
        styles={{ padding: '0px', ...sortableItemStyle }}
      >
        <div
          style={{ width: '100%' }}
          className={itemHtmlClass}
          onClick={e => {
            e && e.stopPropagation()
            !disabled && canEditItems && this.setEditing(id)
          }}
        >
          <Box padding={itemBoxPadding}>
            <InlineStack gap={inlineItemGap} blockAlign="center" wrap={false}>
              {disabled ? <Fragment /> : <SortableList.DragHandle />}

              {thumb
                || (image
                  && (typeof renderImage === 'function' ? (
                    renderImage(item)
                  ) : (
                    <Box paddingBlock={'100'}>
                      <Thumbnail source={getShopifyThumbnail(image)} alt={label} size="extraSmall" />
                    </Box>
                  )))}

              <Box width={labelWidth}>{renderInputField}</Box>

              {typeof renderActions === 'function'
                ? renderActions(item, this)
                : !disabled
                  && canDeleteItems && (
                    <Button
                      variant="tertiary"
                      disabled={disabled}
                      accessibilityLabel={deleteItemLabel}
                      icon={<Icon source={DeleteIcon} tone="base" />}
                      onClick={(e?: any) => {
                        e && e.stopPropagation()
                        this.deleteItem(id)
                      }}
                    />
                  )}
            </InlineStack>
            {errorMsg && (
              <div style={{ paddingLeft: this.hasImage ? '74px' : '40px' }}>
                <InlineError fieldID={`name-${id}`} message={errorMsg} />
              </div>
            )}
          </Box>
        </div>
        <Scrollable.ScrollTo />
      </SortableList.Item>
    )
  }

  componentDidMount(): void {
    const { items, canAddNewItems, registerChangeListener, addNewItemLabel } = this.props

    if (typeof registerChangeListener === 'function') {
      registerChangeListener(this.handleChangesFromOutside)
    }

    // Auto-add the first item if the item list is empty
    if (!items?.length && canAddNewItems && typeof addNewItemLabel === 'string') {
      this.addItem(true)
    }
  }

  componentWillUnmount(): void {
    const { deregisterChangeListener } = this.props

    if (typeof deregisterChangeListener === 'function') {
      deregisterChangeListener(this.handleChangesFromOutside)
    }
  }

  protected handleChangesFromOutside = (e: any) => {
    const { items } = this.state
    const { dataKeyToSyncChanges } = this.props

    // Get ID of the changed item
    const data = getObjectValueByKeyPath(e, dataKeyToSyncChanges)
    const id = this.getItemId(data)

    // Update appropriate item in the component state
    for (let i = 0; i < items.length; i++) {
      if (this.getItemId(items[i]) === id) {
        this.state.items.splice(i, 1, Object.assign(items[i], data))

        return this.forceUpdate()
      }
    }
  }

  private onClick(id: string) {
    const { onClick } = this.props

    if (typeof onClick === 'function') {
      onClick(id)
    }
  }

  private setEditing(id: string) {
    const { onEditing } = this.props

    this.updateState({ editing: id })

    if (typeof onEditing === 'function') {
      onEditing(id)
    }
  }

  getItemId(item: SortableItem): string {
    const { getItemId } = this.props

    return typeof getItemId === 'function' ? getItemId(item) : item.id || item._id
  }

  getItemImage(item: SortableItem): string {
    const { getItemImage } = this.props

    return typeof getItemImage === 'function' ? getItemImage(item) : item.image?.src || item.image?.dataSrc || item.src
  }

  getItemLabel(item: SortableItem): string {
    const { getItemLabel } = this.props
    const _label = item.name || item.label || item.title

    return typeof getItemLabel === 'function'
      ? getItemLabel(item)
      : typeof _label === 'string'
        ? _label
        : item.legacyName || ''
  }

  getItemDefaultLabel(item: SortableItem): string {
    const { getItemDefaultLabel } = this.props
    return typeof getItemDefaultLabel === 'function' ? getItemDefaultLabel(item) : item.defaultName || ''
  }

  private setItemLabel(id: string, label: string): void {
    const { setItemLabel } = this.props

    if (typeof setItemLabel === 'function') {
      setItemLabel(id, label)
    } else {
      this.setItemData(id, { name: label })
    }
  }

  protected addItem = (skipTrace?: boolean): void => {
    const { onAddItem } = this.props

    const newItem = typeof onAddItem === 'function' ? onAddItem(skipTrace) : { id: uuid() }

    // Ensure cloned array and object
    this.setListData([...this.state.items, { ...newItem }], skipTrace)
  }

  private deleteItem(id: string): void {
    const { onDeleteItem } = this.props

    this.setListData(this.state.items.filter((item: any) => this.getItemId(item) !== id))

    if (typeof onDeleteItem === 'function') {
      onDeleteItem(id)
    }
  }

  private validateItem(item: SortableItem): undefined | string {
    const { validateItem } = this.props

    return typeof validateItem === 'function'
      ? validateItem(item)
      : isEmpty(this.getItemLabel(item))
        ? t('item-label-is-required')
        : undefined
  }

  private updateState(newState: any) {
    Object.assign(this.state, { ...newState, internalUpdate: true })
    this.forceUpdate()
  }

  private setItemData(id: string, data: SortableItem) {
    // Get current state
    const { items } = this.state
    const { onItemChange } = this.props

    // Update component state
    this.updateState({
      items: items.map((item: SortableItem) => (this.getItemId(item) === id ? { ...item, ...data } : item)),
    })

    if (typeof onItemChange === 'function') {
      onItemChange(id, data)
    }
  }

  private setListData(data: ItemList, skipTrace?: boolean) {
    const { onListChange } = this.props

    // Update component state (deep clone to maintain immutability contract)
    this.updateState({ items: data.map((item: any) => ({ ...item })) })

    if (typeof onListChange === 'function') {
      onListChange(data, skipTrace)
    }
  }
}
