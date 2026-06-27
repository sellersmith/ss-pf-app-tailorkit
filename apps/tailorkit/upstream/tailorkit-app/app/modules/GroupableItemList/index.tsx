/* eslint-disable max-lines */
import type { ErrorInfo, ReactNode, RefObject } from 'react'
import type { ActionListItemDescriptor } from '@shopify/polaris'
import type { GroupableItem, GroupableItemListProps, GroupableItemListState, ItemAction, ItemList } from './types'
import isEqual from 'lodash/isEqual'
import { t } from 'i18next'
import { duplicateLabel } from '~/utils/duplicateLabel'
import { createRef, Fragment, PureComponent } from 'react'
import { getObjectValueByKeyPath } from '~/bootstrap/fns/misc'
import {
  ActionList,
  BlockStack,
  Box,
  Button,
  Checkbox,
  Divider,
  Icon,
  InlineStack,
  Modal,
  Popover,
  Scrollable,
  Text,
  TextField,
  Tooltip,
} from '@shopify/polaris'
import {
  DeleteIcon,
  DuplicateIcon,
  HideIcon,
  LayoutBlockIcon,
  LockFilledIcon,
  LockIcon,
  ReplaceIcon,
  SearchIcon,
  ViewIcon,
} from '@shopify/polaris-icons'
import { ItemRenderer } from './components/ItemRenderer'
import GroupRenderer from './components/GroupRenderer'
import { getAncestorVisible } from './fns'

export class GroupableItemList<P, S> extends PureComponent<P & GroupableItemListProps, S & GroupableItemListState> {
  declare props: P & GroupableItemListProps

  declare actions: ItemAction[]
  declare bulkActions: ItemAction[]
  declare contextMenuActions: ItemAction[]

  declare ref: RefObject<HTMLUListElement>
  declare placeholderRef: RefObject<HTMLHRElement>
  declare contextMenuActivatorRef: RefObject<HTMLDivElement>

  declare extrasInjected: boolean

  declare openGroupTimer: any
  declare hidePlaceholderTimer: any
  declare restoreInlineEditableTimer: any

  // Define default component props
  static defaultProps: GroupableItemListProps = {
    items: [],
    queryKey: ['name', 'label'],
    dropOnItemCreateGroup: true,
    autoOpenGroupOnDragOver: 1000,
    clearSelectionAfterBulkActions: true,
    dropTargetHighlightClass: 'groupable-drop-target',
  }

  state: S & GroupableItemListState = { items: [], checkedItems: [], queryValue: '' }

  static getDerivedStateFromError(error: Error): any {
    return { error }
  }

  static getDerivedStateFromProps(props: GroupableItemListProps, state: GroupableItemListState) {
    let newState: GroupableItemListState = null

    if (
      [typeof props.onItemChange, typeof props.onListChange].includes('function')
      && !isEqual(props.items, state.items)
    ) {
      newState = Object.assign(newState || {}, {
        items: [...props.items],
      })
    }

    if (typeof props.onCheck === 'function' && !isEqual(props.checkedItems, state.checkedItems)) {
      newState = Object.assign(newState || {}, {
        checkedItems: [
          ...props.checkedItems.filter((id: string) =>
            (newState?.items || state?.items || []).find((item: GroupableItem) => [item.id, item._id].includes(id))
          ),
        ],
      })
    }

    if (typeof props.onClick === 'function' && !isEqual(props.highlightedItems, state.highlightedItems)) {
      newState = Object.assign(newState || {}, {
        highlightedItems: [...props.highlightedItems],
      })

      if (props.highlightedItems.length) {
        newState.scrollToLastHighlightedItem = true
      }
    }

    return newState || state
  }

  constructor(props: P & GroupableItemListProps) {
    super(props)

    // Extract necessary data from props
    const { items, setRef, queryKey, queryValue, checkedItems, highlightedItems } = this.props

    if (items) {
      this.state.items = [...items]
    }

    if (queryKey) {
      this.state.queryKey = queryKey
    }

    if (queryValue) {
      this.state.queryValue = queryValue
    }

    if (checkedItems) {
      this.state.checkedItems = [...checkedItems]
    }

    if (highlightedItems) {
      this.state.highlightedItems = [...highlightedItems]
    }

    if (typeof setRef === 'function') {
      setRef(this)
    }

    this.ref = createRef()
    this.contextMenuActivatorRef = createRef()
    this.placeholderRef = createRef()
  }

  render(): ReactNode {
    const { renderError, isRenderable } = this.props

    const {
      error,
      items,
      queryValue,
      checkedItems,
      confirmBulkAction,
      confirmBulkActionLabel,
      confirmBulkActionCallback,
      confirmDestructiveBulkAction,
    } = this.state

    return error ? (
      typeof renderError === 'function' && renderError(error)
    ) : (
      <div className="groupable--container">
        <div>
          <div>
            <BlockStack gap="050">
              <Box paddingBlock="300" paddingInline="400">
                <BlockStack gap="200">
                  <TextField
                    label=""
                    autoComplete="off"
                    value={queryValue}
                    clearButton={true}
                    labelHidden={true}
                    prefix={<Icon source={SearchIcon} tone="base" />}
                    onChange={queryValue => this.updateState({ queryValue })}
                    onClearButtonClick={() => this.updateState({ queryValue: '' })}
                    placeholder={t('search-layers')}
                  />
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {checkedItems.length > 0
                        ? t('selecting-num-items', { num: checkedItems.length })
                        : t('num-items', { num: queryValue ? this.countQueryResults() : items.length })}
                    </Text>
                    <Box>{this.renderBulkActions()}</Box>
                  </InlineStack>
                </BlockStack>
              </Box>

              <Divider />

              <Scrollable className="groupable--scrollable-list-container">
                <Box paddingBlock="100" paddingInline="200">
                  <div className="groupable--list-container">
                    <ul ref={this.ref} className="groupable--item-list">
                      {items
                        .filter((item: GroupableItem) => !item.parent && this.isItemMatchQuery(item))
                        .map(
                          (item: GroupableItem) =>
                            (typeof isRenderable !== 'function' || isRenderable(item)) && (
                              <Fragment key={this.getItemId(item)}>
                                {this.isGroup(item) ? this.renderGroup(item) : this.renderItem(item)}
                              </Fragment>
                            )
                        )}
                    </ul>
                    <div ref={this.placeholderRef} className="groupable-placeholder" />
                  </div>
                </Box>
              </Scrollable>
            </BlockStack>
          </div>
        </div>
        {confirmBulkAction && (
          <Modal
            open={true}
            title={t('confirmation-required')}
            onClose={() => this.updateState({ confirmBulkAction: '' })}
            primaryAction={{
              content: confirmBulkActionLabel,
              destructive: confirmDestructiveBulkAction,
              onAction: () => {
                confirmBulkActionCallback()
                this.updateState({ confirmBulkAction: '' })
              },
            }}
            secondaryActions={[
              {
                content: t('close'),
                onAction: () => this.updateState({ confirmBulkAction: '' }),
              },
            ]}
          >
            <Modal.Section>{confirmBulkAction}</Modal.Section>
          </Modal>
        )}
        {this.renderContextMenu()}
      </div>
    )
  }

  protected renderBulkActions(): ReactNode {
    const { bulkActions, extraBulkActions } = this.props
    const { checkedItems } = this.state

    // Define a list of default actions
    this.bulkActions = this.bulkActions
      || bulkActions || [
        {
          content: (
            <Tooltip content={t('group-layers')}>
              <Button variant="plain" icon={<Icon source={LayoutBlockIcon} />} />
            </Tooltip>
          ),
          onAction: () => this.createGroup(),
        },
        {
          content: (
            <Tooltip content={t('duplicate-layers')}>
              <Button variant="plain" icon={<Icon source={DuplicateIcon} />} />
            </Tooltip>
          ),
          onAction: () => this.duplicateItems(),
        },
        () => ({
          content: (
            <Tooltip content={t('delete-layers')}>
              <Button
                tone="critical"
                variant="plain"
                icon={<Icon source={DeleteIcon} />}
                disabled={!this.state.checkedItems.find((id: string) => !this.getItemById(id)?.locked)}
              />
            </Tooltip>
          ),
          onAction: this.state.checkedItems.find((id: string) => !this.getItemById(id)?.locked)
            ? () => this.deleteItems(this.state.checkedItems, true)
            : undefined,
        }),
        {
          content: () => (
            <Checkbox
              labelHidden
              label={t('bulk-action-addon')}
              checked={
                this.state.checkedItems.length
                  ? this.state.checkedItems.length < this.state.items.length
                    ? 'indeterminate'
                    : true
                  : false
              }
              onChange={() => {
                this.syncListData(
                  {
                    checkedItems:
                      this.state.checkedItems.length === this.state.items.length
                        ? []
                        : this.state.items.map((item: GroupableItem) => this.getItemId(item)),
                  },
                  false,
                  true
                )
              }}
            />
          ),
        },
      ]

    // Prepend extra bulk actions (once) so they appear first; select-all stays last naturally
    if (!this.extrasInjected && extraBulkActions && extraBulkActions.length > 0) {
      this.bulkActions = [...extraBulkActions, ...this.bulkActions]
      this.extrasInjected = true
    }

    return (
      <InlineStack gap="050" align="end" blockAlign="center">
        {this.bulkActions.map((action: any, index: number) => {
          const { className, style, content, onAction } = typeof action === 'function' ? action() : action

          return (
            <div
              key={index}
              className={`groupable--bulk-action ${className}`}
              style={{
                ...style,
                visibility: checkedItems.length > 0 || index + 1 === this.bulkActions.length ? 'visible' : 'hidden',
              }}
              onClick={() => {
                if (typeof onAction === 'function') {
                  onAction(checkedItems)
                }
              }}
            >
              {typeof content === 'function' ? content() : content}
            </div>
          )
        })}
      </InlineStack>
    )
  }

  protected renderContextMenu(): ReactNode {
    const { contextMenuActions } = this.props
    const { contextMenuOpen = false, contextMenuAnchor = { x: 0, y: 0 } } = this.state

    this.contextMenuActions = this.contextMenuActions
      || contextMenuActions || [
        {
          content: t('group'),
          onAction: () => this.createGroup(),
        },
        () => ({
          content: t('ungroup'),
          disabled: !this.state.checkedItems.find((id: string) => {
            const item = this.getItemById(id)
            return (item && this.isGroup(item)) || item?.parent
          }),
          onAction: () => {
            if (this.state.checkedItems.length > 1) {
              this.updateState({
                confirmDestructiveBulkAction: false,
                confirmBulkActionLabel: t('ungroup'),
                confirmBulkActionCallback: () => this.ungroup(),
                confirmBulkAction: t(
                  'are-you-sure-you-want-to-ungroup-the-selected-items-selected-groups-will-be-deleted'
                ),
              })
            } else {
              this.ungroup()
            }
          },
        }),
        {
          content: t('duplicate'),
          onAction: () => this.duplicateItems(),
        },
        () => ({
          content: t('delete'),
          onAction: () => this.deleteItems(this.state.checkedItems, true),
          disabled: !this.state.checkedItems.find((id: string) => !this.getItemById(id)?.locked),
        }),
      ]

    // Map actions and wrap onAction to close menu after execution
    const actions = this.contextMenuActions.map(action => {
      const resolvedAction = typeof action === 'function' ? action() : action
      return {
        ...resolvedAction,
        onAction: (item?: any) => {
          this.hideContextMenu()
          resolvedAction.onAction?.(item)
        },
      }
    }) as ActionListItemDescriptor[]

    // Hidden activator div positioned at the click coordinates
    const activator = (
      <div
        ref={this.contextMenuActivatorRef}
        style={{
          position: 'fixed',
          top: contextMenuAnchor.y,
          left: contextMenuAnchor.x,
          width: 0,
          height: 0,
          zIndex: 9999,
        }}
      />
    )

    return (
      <Popover
        zIndexOverride={519}
        active={contextMenuOpen}
        activator={activator}
        onClose={this.hideContextMenu}
        preferredPosition="below"
      >
        <ActionList items={actions} />
      </Popover>
    )
  }

  protected renderItem(item: GroupableItem, level: number = 0, _ancestorVisible?: boolean): ReactNode {
    const id = this.getItemId(item)

    const { renderItem } = this.props
    const { checkedItems, highlightedItems } = this.state

    const ancestorVisible = getAncestorVisible(_ancestorVisible, item.visible)

    return (
      <ItemRenderer
        id={id}
        item={item}
        level={level}
        highlightedItems={highlightedItems}
        checkedItems={checkedItems}
        dragItem={this.state.dragItem}
        renderItem={renderItem}
        isDraggable={this.isDraggable(item)}
        itemLabel={this.getItemLabel(item)}
        actionRenderer={this.renderActions(item)}
        ancestorVisible={ancestorVisible}
      />
    )
  }

  protected renderGroup(group: GroupableItem, level: number = 0, _ancestorVisible?: boolean): ReactNode {
    const { queryValue } = this.state
    const { renderItem, renderGroup, highlightedItems } = this.props

    const id = this.getItemId(group)
    const customRenderer = renderGroup || renderItem

    // Get the ancestor visible status
    const ancestorVisible = getAncestorVisible(_ancestorVisible, group.visible)

    // Always open a group if it has child items match the current query value
    const isGroupOpen = group.open || (queryValue.trim() && this.countQueryResults(this.getGroupItems(group, true)))

    return (
      <GroupRenderer
        isGroupOpen={isGroupOpen}
        isDraggable={this.isDraggable(group)}
        group={group}
        level={level}
        ancestorVisible={ancestorVisible}
        queryValue={queryValue}
        highlightedItems={highlightedItems}
        id={id}
        dragItem={this.state.dragItem}
        itemLabel={this.getItemLabel(group)}
        actionRenderer={this.renderActions(group)}
        groupItems={this.getGroupItems(group)}
        customRenderer={customRenderer}
        toggleGroup={this.toogleGroup.bind(this)}
        isItemMatchQuery={this.isItemMatchQuery.bind(this)}
        getItemId={this.getItemId.bind(this)}
        isGroup={this.isGroup.bind(this)}
        getItemLabel={this.getItemLabel.bind(this)}
        renderGroup={this.renderGroup.bind(this)}
        renderItem={this.renderItem.bind(this)}
      />
    )
  }

  protected renderActions(item: GroupableItem): ReactNode {
    const { actions: _actions } = this.props

    // Define a list of default actions
    this.actions = this.actions
      || _actions || [
        {
          onAction: (item: GroupableItem) => {
            // Only handle image replacement for image layers
            if (item.type === 'image') {
              // Use the same pattern as other actions - update the item with a special trigger
              return this.updateItem(item, { __triggerReplaceImage: true })
            }
            return item
          },
          content: (item: GroupableItem) => {
            // Only show replace button for image layers
            if (item.type !== 'image') {
              return null
            }

            return (
              <Tooltip content={t('replace-the-base-image-while-keeping-all-option-sets-you-ve-created')}>
                <div className="emtlkit--d-flex">
                  <Button
                    accessibilityLabel={t('replace-image')}
                    variant="plain"
                    icon={<Icon source={ReplaceIcon} />}
                  />
                </div>
              </Tooltip>
            )
          },
        },
        {
          onAction: (item: GroupableItem) => (item = this.updateItem(item, { locked: !item.locked, selectedTab: 0 })),
          content: (item: GroupableItem) => {
            // If the item belongs to a group and that group is locked, disable the action
            const group = item.parent && this.getItemById(item.parent)
            const disabled = group && group.locked

            return (
              <Button
                disabled={disabled}
                variant="plain"
                icon={<Icon source={item.locked ? LockFilledIcon : LockIcon} />}
              />
            )
          },
        },
        {
          onAction: (item: GroupableItem) => (item = this.updateItem(item, { visible: !item.visible })),
          content: (item: GroupableItem) => (
            <Button variant="plain" icon={<Icon source={item.visible ? ViewIcon : HideIcon} />} />
          ),
        },
        ...(this.bulkActions?.length > 0
          ? [
              {
                content: (item: GroupableItem) => {
                  const nestedItems = this.getGroupItems(item)
                  const checked
                    = this.state.checkedItems.includes(this.getItemId(item))
                    || (this.isGroup(item)
                      && nestedItems.length > 0
                      && nestedItems.every(item => this.state.checkedItems.includes(this.getItemId(item))))

                  return (
                    <Checkbox
                      labelHidden
                      checked={checked}
                      label={t('bulk-action-addon')}
                      onChange={newChecked => this.handleCheck(item, newChecked)}
                    />
                  )
                },
              },
            ]
          : []),
      ]

    return (
      <div className={`groupable-actions${this.state.checkedItems.includes(this.getItemId(item)) ? ' checked' : ''}`}>
        <InlineStack gap={'050'} align="end" blockAlign="center" wrap={false}>
          {this.actions.map((action: any, index: number) => {
            const { className, style, content, onAction } = action

            return (
              <div
                key={index}
                style={style}
                className={`groupable--action ${className}`}
                onClick={() => {
                  if (typeof onAction === 'function') {
                    this.state.items.splice(this.state.items.indexOf(item), 1, onAction(item))
                    this.forceUpdate()
                  }
                }}
              >
                {typeof content === 'function' ? content(item) : content}
              </div>
            )
          })}
        </InlineStack>
      </div>
    )
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console
    console.error(error, errorInfo)
  }

  componentDidMount(): void {
    // Watch changes from outside in item data
    const { registerChangeListener } = this.props

    if (registerChangeListener) {
      registerChangeListener(this.handleChangesFromOutside)
    }

    // Listen to context menu event
    window.addEventListener('contextmenu', this.handleContextMenu)

    // Listen to click event on document and list items
    document.addEventListener('click', this.handleClick)
    this.ref.current?.addEventListener('click', this.handleClick)

    // Listen to necessary events to handle drag and drop actions
    this.ref.current?.addEventListener('dragstart', this.handleDragStart)
    this.ref.current?.addEventListener('dragenter', this.handleDragEnter)
    this.ref.current?.addEventListener('dragleave', this.handleDragLeave)
    this.ref.current?.addEventListener('dragover', this.handleDragOver)
    this.ref.current?.addEventListener('dragend', this.handleDragEnd)
    this.ref.current?.addEventListener('drop', this.handleDrop)
  }

  componentDidUpdate(prevProps: any, prevState: any, snapshot?: any): void {
    if (this.state.scrollToLastHighlightedItem) {
      const { highlightedItems } = this.state
      const lastHighlightedItemId = highlightedItems[highlightedItems.length - 1]
      const element = this.ref.current?.querySelector(`[data-id="${lastHighlightedItemId}"]`) as HTMLElement

      // Automatically expand groups to reveal highlighted items
      highlightedItems.forEach((id: string) => {
        const item = this.getItemById(id)
        let parent = item?.parent

        while (parent) {
          const group = this.getItemById(parent)

          if (!group?.open) {
            this.toogleGroup(group)
          }

          parent = group?.parent
        }
      })

      setTimeout(() => {
        // Check if the highlighted element is off the view
        const scrollable = this.ref.current?.closest('.groupable--scrollable-list-container') as HTMLElement

        if (element && scrollable) {
          if (
            element.offsetTop + element.offsetHeight < scrollable.scrollTop
            || scrollable.scrollTop + scrollable.offsetHeight < element.offsetTop
          ) {
            // @ts-ignore
            if (typeof element.scrollIntoViewIfNeeded === 'function') {
              // @ts-ignore
              element.scrollIntoViewIfNeeded()
            } else if (typeof element.scrollIntoView === 'function') {
              element.scrollIntoView()
            }
          }
        }
      }, 100)

      delete this.state.scrollToLastHighlightedItem
    }
  }

  componentWillUnmount(): void {
    const { deregisterChangeListener } = this.props

    // Stop watching changes from outside in item data
    if (deregisterChangeListener) {
      deregisterChangeListener(this.handleChangesFromOutside)
    }

    // Stop listening to context menu event
    window.removeEventListener('contextmenu', this.handleContextMenu)

    // Stop listening to click event on list items
    this.ref.current?.removeEventListener('click', this.handleClick)

    // Stop listening to necessary events to handle drag and drop actions
    this.ref.current?.removeEventListener('dragstart', this.handleDragStart)
    this.ref.current?.removeEventListener('dragover', this.handleDragOver)
    this.ref.current?.removeEventListener('dragend', this.handleDragEnd)
    this.ref.current?.removeEventListener('drop', this.handleDrop)
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

  protected handleClick = (e: MouseEvent) => {
    // Validate target
    const target: any = e.target as HTMLElement

    if (target.nodeName === 'INPUT' || target.closest('.groupable--group-toggler')) {
      return
    }

    // Find affected item
    const affectedItem = target.closest('.groupable--item')

    // Only process clicks on items, not on actions (checkboxes, buttons, etc.)
    if (!target.closest('.groupable-actions') && affectedItem) {
      const { onClick } = this.props
      const itemId = affectedItem.getAttribute('data-id')

      // Hide context menu when clicking on an item (Popover will handle other outside clicks)
      this.hideContextMenu()

      // Highlight clicked item and clear all checked items
      this.updateState({ highlightedItems: e.metaKey ? [] : [itemId], checkedItems: [] })

      if (typeof onClick === 'function') {
        setTimeout(() => onClick(e.metaKey ? null : itemId), 10)
      }
    }
  }

  protected handleCheck = (item?: GroupableItem, newChecked?: boolean) => {
    if (item) {
      const { onCheck } = this.props
      const { checkedItems } = this.state

      // Get the ID of the checked/unchecked item and nested items as well
      const id = this.getItemId(item)

      const nestedItems = this.isGroup(item) ? this.getGroupItems(item, true).map(item => this.getItemId(item)) : []

      // Prepare the new checked state
      newChecked = newChecked ?? !checkedItems.includes(id)

      if (newChecked) {
        if (!checkedItems.includes(id)) {
          checkedItems.push(id)
        }

        // Check nested items also when a group is checked, regardless of their current state
        if (this.isGroup(item) && nestedItems && nestedItems.length) {
          // Add all nested items that aren't already checked
          const itemsToAdd = nestedItems.filter(nestedId => !checkedItems.includes(nestedId))
          if (itemsToAdd.length > 0) {
            checkedItems.splice(checkedItems.length, 0, ...itemsToAdd)
          }
        }
      } else {
        if (checkedItems.includes(id)) {
          checkedItems.splice(checkedItems.indexOf(id), 1)
        }

        // Uncheck nested items also when a group is unchecked
        if (this.isGroup(item) && nestedItems && nestedItems.length) {
          nestedItems.forEach(nestedId => {
            const index = checkedItems.indexOf(nestedId)
            if (index !== -1) {
              checkedItems.splice(index, 1)
            }
          })
        }
      }

      // After modifying checked items, update parent groups' checked state
      this.updateParentGroupsCheckedState(item)

      // Update checked items and clear any highlighted items
      this.updateState({ checkedItems, highlightedItems: [] })

      if (typeof onCheck === 'function') {
        const updatedCheckedItems = Array.from(new Set(this.state.checkedItems))

        setTimeout(() => onCheck(updatedCheckedItems), 10)
      }
    }
  }

  /**
   * Updates the checked state of parent groups based on their children's checked state
   * If all children are checked, the parent group is checked
   * If any child is unchecked, the parent group is unchecked
   */
  private updateParentGroupsCheckedState = (item: GroupableItem) => {
    const { checkedItems } = this.state
    let parent = item.parent ? this.getItemById(item.parent) : null

    // Traverse up the group hierarchy
    while (parent) {
      const parentId = this.getItemId(parent)
      const groupItems = this.getGroupItems(parent, false)
      const groupItemIds = groupItems.map(groupItem => this.getItemId(groupItem))

      // Check if all group items are checked
      // Only check if group has items and all items are checked
      const allGroupItemsChecked = groupItemIds.length > 0 && groupItemIds.every(id => checkedItems.includes(id))

      // Update parent group checked state
      if (allGroupItemsChecked && !checkedItems.includes(parentId)) {
        // Add parent to checked items if all children are checked
        checkedItems.push(parentId)
      } else if (!allGroupItemsChecked && checkedItems.includes(parentId)) {
        // Remove parent from checked items if any child is unchecked
        checkedItems.splice(checkedItems.indexOf(parentId), 1)
      }

      // Move up to the next parent
      parent = parent.parent ? this.getItemById(parent.parent) : null
    }
  }

  protected handleContextMenu = (e: MouseEvent) => {
    this.hideContextMenu()

    // Check if context menu is triggered on an item of the groupable item list
    const target = (e.target as HTMLElement).closest('.groupable--item')

    if (target) {
      e.preventDefault()

      // Check the target item if no item is checked
      if (!this.state.checkedItems.length) {
        const id = target.getAttribute('data-id') as string
        // Select only the target item without propagating to parents to avoid accidental multi-duplication
        this.updateState({ checkedItems: [id], highlightedItems: [] })

        // Inform external listeners if provided
        if (typeof this.props.onCheck === 'function') {
          const updatedCheckedItems = Array.from(new Set(this.state.checkedItems))
          setTimeout(() => this.props.onCheck!(updatedCheckedItems), 10)
        }
      }

      // Show the context menu at the triggered point
      this.showContextMenu(e.clientX, e.clientY)
    }
  }

  protected handleDragStart = (e: DragEvent) => {
    // Find dragging item
    const target = e.target as HTMLElement
    const dragItem = target?.closest('li.groupable--item') as HTMLElement
    const item = this.getItemById(dragItem.getAttribute('data-id'))

    if (item && this.isDraggable(item)) {
      // Temporary disable inline editable elements
      this.ref.current?.querySelectorAll('[contenteditable]').forEach((e: Element) => {
        e.removeAttribute('contenteditable')
        e.setAttribute('data-contenteditable', '')
      })

      // Save dragging item to component state
      Object.assign(this.state, { dragItem })

      // Create a ghost image
      const ghost = dragItem.cloneNode(true) as HTMLElement

      ghost.className = 'groupable--drag-image'
      ghost.style.width = `${dragItem.offsetWidth}px`

      document.body.appendChild(ghost)

      // Set transferring data
      e.dataTransfer?.setDragImage(ghost, e.offsetX, e.offsetY)
      e.dataTransfer?.setData('text', dragItem.getAttribute('data-id') as string)

      // Schedule to remove the ghost image after 500ms
      setTimeout(() => ghost.parentNode?.removeChild(ghost), 500)
    }
  }

  protected handleDragEnter = (e: DragEvent) => this.handleDragEnd(e)

  protected handleDragLeave = (e: DragEvent) => this.handleDragEnd(e)

  protected handleDragOver = (e: DragEvent) => {
    if (this.restoreInlineEditableTimer) {
      clearTimeout(this.restoreInlineEditableTimer)
    }

    // Get dragging item
    const { dragItem } = this.state

    if (!dragItem) {
      return this.clearToggleGroupTimer()
    }

    // Find droppable target
    const { clientY } = e
    const dropTarget = (e.target as HTMLElement)?.closest('li.groupable--item') as HTMLElement
    const item = this.getItemById(dropTarget.getAttribute('data-id'))

    if (item && this.isDroppable(item, this.getItemById(dragItem.getAttribute('data-id')))) {
      // Do not allow dropping an item into itself
      if (dragItem === dropTarget) {
        return this.clearToggleGroupTimer()
      }

      // Do not allow moving a parent group to its child group
      if (
        dragItem.classList.contains('groupable--group')
        && dragItem.querySelector(`[data-id="${dropTarget.getAttribute('data-id')}"]`)
      ) {
        return this.clearToggleGroupTimer()
      }

      // State that this place is droppable
      e.preventDefault()

      // Save droppable target to component state
      Object.assign(this.state, { dropTarget })

      // Get the target bounding rectangle
      const { top, height } = dropTarget.getBoundingClientRect()
      const childHeight = dropTarget.querySelector('ul')?.offsetHeight || 0

      // Split the target into 3 parts from top to bottom
      const firstOneThirdEndAt = top + (height - childHeight) / 3
      const secondOneThirdEndAt = top + height - (height - childHeight) / 3

      // Set drop action to `insert-before` if the pointer is in the first one third of the target
      if (clientY > top && clientY < firstOneThirdEndAt) {
        Object.assign(this.state, { dropAction: 'insert-before' })

        // Show the placeholder and move it to above the target
        this.highlightDropTarget('insert-before', dropTarget)

        return this.clearToggleGroupTimer()
      }

      // Set the drop action to `insert-after` if the pointer is in the last on third of the target
      if (clientY > secondOneThirdEndAt && clientY < top + height) {
        Object.assign(this.state, { dropAction: 'insert-after' })

        // Show the placeholder and move it to below the target
        this.highlightDropTarget('insert-after', dropTarget)

        return this.clearToggleGroupTimer()
      }

      // Otherwise, set the drop action to `create-group`
      if (dropTarget.classList.contains('groupable--group') || this.props.dropOnItemCreateGroup) {
        Object.assign(this.state, { dropAction: 'create-group' })

        // Hide the placeholder and add a class to highlight the target
        this.highlightDropTarget('create-group', dropTarget)

        // Set a time out to automatically open hovered group
        if (dropTarget.classList.contains('groupable--group')) {
          const { autoOpenGroupOnDragOver } = this.props

          if (autoOpenGroupOnDragOver && !this.openGroupTimer) {
            const group = this.getItemById(dropTarget.getAttribute('data-id'))

            if (group && !group.open) {
              this.openGroupTimer = setTimeout(() => {
                this.toogleGroup(group)
                this.clearToggleGroupTimer()
              }, autoOpenGroupOnDragOver)
            }
          }
        }
      }
    }
  }

  protected handleDragEnd = (e: DragEvent) => {
    e.preventDefault()

    this.dehighlightDropTarget()

    // Restore inline editable elements previously disabled
    if (this.restoreInlineEditableTimer) {
      clearTimeout(this.restoreInlineEditableTimer)
    }

    this.restoreInlineEditableTimer = setTimeout(
      () =>
        this.ref.current?.querySelectorAll('[data-contenteditable]').forEach((e: Element) => {
          e.setAttribute('contenteditable', '')
          e.removeAttribute('data-contenteditable')
        }),
      200
    )
  }

  protected handleDrop = (e: DragEvent) => {
    e.preventDefault()

    this.clearToggleGroupTimer()
    this.dehighlightDropTarget()

    // Get drag and drop action data
    const { items, dragItem, dropTarget, dropAction } = this.state

    // Do not allow dropping an item into itself
    if (dragItem === dropTarget) {
      return
    }

    // Do not allow moving a parent group to its child group
    if (
      dragItem.classList.contains('groupable--group')
      && dragItem.querySelector(`[data-id="${dropTarget.getAttribute('data-id')}"]`)
    ) {
      return
    }

    // Get affected items in the original item list
    const draggedItem = items.find((item: GroupableItem) => this.getItemId(item) === dragItem.getAttribute('data-id'))
    const targetItem = items.find((item: GroupableItem) => this.getItemId(item) === dropTarget.getAttribute('data-id'))

    if (!draggedItem || !targetItem) {
      return
    }

    // Apply drag and drop action to the original item list
    switch (dropAction) {
      case 'create-group': {
        if (dropTarget.classList.contains('groupable--group')) {
          // Move the dragged item to the target group
          this.moveItems([draggedItem], targetItem)
        } else if (this.props.dropOnItemCreateGroup) {
          // Do not allow a group create a new group with its child items
          const childItems = this.isGroup(draggedItem) ? this.getGroupItems(draggedItem, true) : []

          if (childItems.includes(targetItem)) {
            return
          }

          // Create a new group to contain both the moved item and the target item
          this.createGroup([targetItem, draggedItem])
        } else {
          return
        }

        break
      }

      case 'insert-before': {
        // Move the dragged item to before the target item. If the target item is in
        // a group then the dragged item will also be moved to that group.
        this.moveItems([draggedItem], targetItem, 'before')

        break
      }

      case 'insert-after': {
        // Move the dragged item to after the target item. If the target item is in
        // a group then the dragged item will also be moved to that group.
        this.moveItems([draggedItem], targetItem, 'after')

        break
      }

      default:
        return
    }
  }

  private showContextMenu(x: number, y: number) {
    this.updateState({
      contextMenuOpen: true,
      contextMenuAnchor: { x, y },
    })
  }

  private hideContextMenu = () => {
    this.updateState({
      contextMenuOpen: false,
    })
  }

  private clearToggleGroupTimer() {
    if (this.openGroupTimer) {
      clearTimeout(this.openGroupTimer)
    }

    this.openGroupTimer = null
  }

  private highlightDropTarget(dropAction: GroupableItemListState['dropAction'], target?: HTMLElement) {
    this.dehighlightDropTarget()

    target = target || this.state.dropTarget

    if (target && this.ref.current) {
      const { top, width, height } = target.getBoundingClientRect()
      const { top: containerTop = 0 } = this.ref.current.getBoundingClientRect()

      if (dropAction === 'create-group') {
        // Highlight drop target
        const { dropTargetHighlightClass } = this.props

        if (dropTargetHighlightClass) {
          target.classList.add(dropTargetHighlightClass)
        }
      } else {
        if (this.placeholderRef.current) {
          // Clear the timeout to hide the placeholder
          if (this.hidePlaceholderTimer) {
            clearTimeout(this.hidePlaceholderTimer)
          }

          if (dropAction === 'insert-before') {
            // Move the placeholder to above the target
            this.placeholderRef.current.style.top = `${top - containerTop}px`
          } else if (dropAction === 'insert-after') {
            // Move the placeholder to below the target
            this.placeholderRef.current.style.top = `${top - containerTop + height}px`
          }

          // Show the placeholder
          this.placeholderRef.current.style.display = 'block'
          this.placeholderRef.current.style.width = `${width}px`
        }
      }
    }
  }

  private dehighlightDropTarget(target?: HTMLElement | NodeListOf<any>) {
    const { dropTargetHighlightClass } = this.props
    target = target || this.ref.current?.querySelectorAll(`.${dropTargetHighlightClass.replace(/\s+/g, '.')}`)

    if (target) {
      // Dehighlight drop target
      if (dropTargetHighlightClass) {
        ;(target instanceof NodeList ? target : [target]).forEach(elm => {
          elm.classList.remove(dropTargetHighlightClass)
        })
      }
    }

    // Hide the placeholder
    if (this.placeholderRef.current) {
      this.hidePlaceholderTimer = setTimeout(() => {
        if (this.placeholderRef.current) {
          this.placeholderRef.current.style.display = 'none'
        }
      }, 100)
    }
  }

  private isGroup(item: GroupableItem): boolean {
    const { isGroup } = this.props

    return typeof isGroup === 'function' ? isGroup(item) : item.type === 'group'
  }

  private isDraggable(item: GroupableItem): boolean {
    const { isDraggable } = this.props

    return typeof isDraggable === 'function' ? isDraggable(item) : true
  }

  private isDroppable(item: GroupableItem, dragItem?: GroupableItem): boolean {
    const { dropAction } = this.state
    const { isDroppable } = this.props

    return typeof isDroppable === 'function' ? isDroppable(item, dropAction, dragItem) : true
  }

  createGroup(items?: ItemList | string[], indexInList?: number, silent?: boolean): void {
    const isBulkAction = !items

    // Verify items
    items = items || this.state.checkedItems

    if (!items?.length) {
      return
    }

    // Get items by their order in the original item list
    const _items = (typeof items[0] === 'string' ? this.getItemsByIds(items as string[]) : items) as ItemList

    // Create a group at the place of the first item in the specified list of items
    const newGroup: GroupableItem = this.generateGroup(_items[0].parent)

    let newGroupIndex = indexInList !== undefined ? indexInList : this.state.items.indexOf(_items[0])

    if (newGroupIndex < 0) {
      newGroupIndex = this.state.items.length
    }

    // We should keep the group structure when users select both a group and its nested items to create a new group
    const movedGroups: string[] = []

    ;[newGroup, ..._items].forEach((item, index) => {
      let allItems = [item]

      if (index > 0) {
        // Get all nested group items related to the item
        allItems = allItems.concat(this.isGroup(item) ? this.getGroupItems(item, true) : [])

        // Remove nested group items from the original item list
        allItems.forEach(item => this.state.items.splice(this.state.items.indexOf(item), 1))

        // Set the new group as parent of the current child item
        if (this.isGroup(item)) {
          movedGroups.push(this.getItemId(item))
        }

        if (!item.parent || !movedGroups.includes(item.parent)) {
          item = this.updateItem(item, { parent: this.getItemId(newGroup) })
        }

        // Get the current position of the new group in the original item list
        newGroupIndex = this.state.items.indexOf(newGroup)
      }

      // Insert the current child item after the new group at the relative
      // index based on its index in the specified list of child items.
      allItems.forEach((item: GroupableItem, indexInGroup: number) =>
        this.state.items.splice(newGroupIndex + indexInGroup + index, 0, item)
      )
    })

    // After creating a new group, ensure its visibility and lock statuses are consistent with its children
    this.updateGroupPropertyBasedOnChildren(this.getItemId(newGroup), 'visible')
    this.updateGroupPropertyBasedOnChildren(this.getItemId(newGroup), 'locked')

    if (!silent) {
      this.syncListData(undefined, isBulkAction)
    }
  }

  duplicateItems(items?: ItemList | string[], parent?: string, offset?: number, silent?: boolean) {
    const isBulkAction = !items

    const { onDuplicateItem } = this.props

    // Verify items
    items = items || this.state.checkedItems

    if (!items?.length) {
      return
    }

    // Get items by their order in the original item list
    const _items = (typeof items[0] === 'string' ? this.getItemsByIds(items as string[]) : items) as ItemList

    // Deduplicate selection: if a group is selected, exclude its descendants from direct duplication
    const selectedIdSet = new Set(_items.map((it: GroupableItem) => this.getItemId(it)))
    const itemsToDuplicate = _items.filter((it: GroupableItem) => {
      let parentId = it.parent
      while (parentId) {
        if (selectedIdSet.has(parentId)) {
          return false
        }
        const parentItem = this.getItemById(parentId)
        parentId = parentItem?.parent || ''
      }
      return true
    })

    itemsToDuplicate.forEach((item: GroupableItem | string, index: number) => {
      if (typeof item === 'string') {
        item = this.getItemById(item) as GroupableItem
      }

      // Generate a new item from the origin item
      const clonedItem
        = typeof onDuplicateItem === 'function'
          ? onDuplicateItem(this.getItemId(item))
          : Object.assign({ ...item, id: this.generateId() })

      if (parent) {
        clonedItem.parent = parent
      }

      // Refine label of the item cloned from the origin item
      clonedItem.label = this.refineLabel(this.getItemLabel(clonedItem))

      // Insert the new item right after the origin item
      const clonedItemIndex
        = 1
        + (offset
          ? offset + index
          : this.state.items.indexOf(item) + (this.isGroup(item) ? this.getGroupItems(item, true).length : 0))

      this.state.items.splice(clonedItemIndex, 0, clonedItem)

      // Duplicate child items also if the origin item is a group
      if (this.isGroup(item)) {
        this.duplicateItems(this.getGroupItems(item), this.getItemId(clonedItem), clonedItemIndex, true)
      }
    })

    if (!silent) {
      this.syncListData(undefined, isBulkAction)
    }
  }

  deleteItems(items?: ItemList | string[], silent?: boolean) {
    const isBulkAction = !items

    let deletedItems: ItemList = []

    const { onDeleteItems } = this.props

    // Verify items
    items = items || this.state.checkedItems

    if (!items?.length) {
      return
    }

    items.forEach(item => {
      if (typeof item === 'string') {
        item = this.getItemById(item) as GroupableItem
      }

      // Simply return if the item has already been deleted
      if (!item || deletedItems.includes(item)) {
        return
      }

      // Get all nested group items related to the item
      const allItems = [item, ...this.getGroupItems(item, true)]

      // Do not delete the item if itself or any child of it is locked
      if (allItems.filter((item: GroupableItem) => item.locked).length > 0) {
        return this.showMessage(
          t('the-item-label-cannot-be-deleted-because-it-is-locked-or-contains-locked-items', {
            label: this.getItemLabel(item),
          })
        )
      }

      allItems.forEach(item => this.state.items.splice(this.state.items.indexOf(item), 1))

      deletedItems = deletedItems.concat(allItems)
    })

    if (typeof onDeleteItems === 'function') {
      onDeleteItems(deletedItems)
    }

    if (!silent) {
      this.syncListData({ checkedItems: [] }, isBulkAction)
    }
  }

  ungroup(items?: ItemList | string[], silent?: boolean) {
    const isBulkAction = !items

    // Verify items
    items = items || this.state.checkedItems

    if (!items?.length) {
      return
    }

    // Get items by their reversed order in the original item list
    const _items = (typeof items[0] === 'string' ? this.getItemsByIds(items as string[]) : items).reverse() as ItemList

    _items.forEach((item: GroupableItem) => {
      if (this.isGroup(item)) {
        // Get child items of the current group
        const groupItems = this.getGroupItems(item)

        // Move child items to outside of the group
        this.moveItems(groupItems, item, 'before')

        // Remove the group from the original item list
        this.state.items.splice(this.state.items.indexOf(item), 1)
      } else if (item.parent) {
        // Move the current item to outside of its group
        const group = this.getItemById(item.parent)

        if (group) {
          this.moveItems([item], group, 'after')
        }
      }
    })

    if (!silent) {
      this.syncListData(undefined, isBulkAction)
    }
  }

  moveItems(items: ItemList | string[], target: GroupableItem, position?: 'before' | 'after', silent?: boolean) {
    // Get target group
    const group = !position && this.isGroup(target) ? target : this.getParent(target)

    // Refine item list
    items = items
      .map(item => (typeof item === 'string' ? this.getItemById(item)! : item))
      .filter(item => {
        // Do not allow moving a parent group to its child group
        if (!item || (this.isGroup(item) ? this.getGroupItems(item, true) : []).includes(group || target)) {
          return false
        }

        return true
      })

    // Get all affected items including nested group items
    const allItems = Array.from(
      new Set(
        items.reduce((_items: GroupableItem[], item: GroupableItem | string) => {
          item = typeof item === 'string' ? this.getItemById(item)! : item

          return item ? [..._items, item, ...this.getGroupItems(item, true)] : _items
        }, [])
      )
    )

    // Remove affected items from the original item list
    allItems.forEach(item => this.state.items.splice(this.state.items.indexOf(item), 1))

    // Re-insert affected items to the list at the specified position
    this.state.items.splice(this.state.items.indexOf(target) + (position === 'before' ? 0 : 1), 0, ...allItems)

    // Update parent for moved items if necessary
    items.forEach((item: GroupableItem) => this.updateItem(item, { parent: group && this.getItemId(group) }))

    if (!silent) {
      this.syncListData()
    }
  }

  getItemId = (item: GroupableItem) => {
    const { getItemId } = this.props

    return typeof getItemId === 'function' ? getItemId(item) : item?._id || item?.id
  }

  private getItemLabel = (item: GroupableItem) => {
    const { getItemLabel } = this.props

    return typeof getItemLabel === 'function'
      ? getItemLabel(item)
      : item.name || item.label || item.title || item.legacyName
  }

  private getItemById = (id: string | null): GroupableItem | undefined =>
    id && this.state.items.find((_item: GroupableItem) => this.getItemId(_item) === id)

  private getItemsByIds = (ids: string[]): ItemList => {
    const items: ItemList = []

    this.state.items.forEach((item: GroupableItem) => {
      if (ids.includes(this.getItemId(item))) {
        items.push(item)
      }
    })

    return items
  }

  private getParent = (item: GroupableItem): GroupableItem | '' | undefined =>
    item?.parent && this.getItemById(item.parent)

  private getGroupItems(group: GroupableItem | string, nested: boolean = false): ItemList {
    let groupItems: ItemList = []

    const { items } = this.state
    const groupId = typeof group === 'string' ? group : this.getItemId(group)
    const startIndex = items.indexOf(typeof group === 'string' ? this.getItemById(group) : group) + 1

    for (let i = startIndex; i < items.length; i++) {
      if (items[i].parent === groupId) {
        groupItems.push(items[i])

        if (nested && this.isGroup(items[i])) {
          groupItems = groupItems.concat(this.getGroupItems(items[i], nested))
        }
      }
    }

    return groupItems
  }

  private countQueryResults(items?: ItemList) {
    items = items || this.state.items

    return items?.filter((item: GroupableItem) => this.isItemMatchQuery(item)).length
  }

  private isItemMatchQuery(item: GroupableItem) {
    const { queryKey, queryValue } = this.state
    const refinedQueryValue = queryValue.trim().toLowerCase()

    if (refinedQueryValue) {
      if (this.getItemLabel(item)?.toLowerCase().indexOf(refinedQueryValue) > -1) {
        return true
      }

      for (let i = 0; i < queryKey.length; i++) {
        if (item[queryKey[i]]?.toLowerCase().indexOf(refinedQueryValue) > -1) {
          return true
        }

        if (this.isGroup(item) && this.countQueryResults(this.getGroupItems(item, true))) {
          return true
        }
      }
    }

    return refinedQueryValue ? false : true
  }

  private toogleGroup(group?: GroupableItem) {
    if (group && this.isGroup(group)) {
      // Toogle the group open state
      group = this.updateItem(group, { open: !group.open })

      this.state.items.splice(this.state.items.indexOf(group), 1, group)

      this.forceUpdate()
    }
  }

  private refineLabel(label: string) {
    // Check label for duplication
    const itemLabels = this.state.items.map((item: GroupableItem) => ({ label: this.getItemLabel(item) }))

    return duplicateLabel(label, itemLabels)
  }

  private generateId() {
    const { generateId } = this.props

    return typeof generateId === 'function' ? generateId() : (Math.random() * Date.now()).toString().substring(0, 16)
  }

  private generateGroup(parent?: string) {
    const { generateGroup } = this.props

    const newGroup
      = typeof generateGroup === 'function' ? generateGroup() : { label: t('group'), id: this.generateId() }

    const props: any = { parent, type: 'group', open: true, visible: true, label: this.refineLabel(newGroup.label) }

    return this.updateItem(newGroup, props)
  }

  private showMessage(message: string) {
    const { showMessage } = this.props

    return typeof showMessage === 'function' ? showMessage(message) : alert(message)
  }

  /**
   * Updates an item's properties and handles special propagation for visibility and lock states
   * @param item The item to update
   * @param data The data to update the item with
   * @returns The updated item
   */
  private updateItem(item: GroupableItem, data: any) {
    const { onItemChange } = this.props
    let modifiedData = { ...data } // Create a copy to avoid mutating the original data

    // Handle special triggers that shouldn't be persisted to the item
    const { __triggerReplaceImage, ...dataWithoutTriggers } = modifiedData
    modifiedData = dataWithoutTriggers

    // Handle visibility and lock changes with unified propagation approach
    const propagationProperties = [
      {
        property: 'visible',
        upwardPropagation: true, // parent must be visible if child is visible
        downwardPropagation: true, // children inherit parent's visibility
      },
      {
        property: 'locked',
        upwardPropagation: true, // parent will be locked only if ALL children are locked
        downwardPropagation: true, // When locking/unlocking a group, all children are also locked/unlocked
      },
    ]

    // Process each property that requires propagation
    const propertyChanges: Record<string, any> = {}

    propagationProperties.forEach(prop => {
      if (Object.prototype.hasOwnProperty.call(data, prop.property)) {
        const newValue = data[prop.property]

        // Skip if property isn't actually changing
        if (item[prop.property] === newValue) return

        // Store property for single batch update
        propertyChanges[prop.property] = newValue

        // Update the item's property directly
        item[prop.property] = newValue

        // Handle propagation logic without invoking callbacks yet
        this.handlePropertyPropagation(item, prop.property, newValue, prop.upwardPropagation, prop.downwardPropagation)

        // Remove the property from the modifiedData as it's handled separately
        const { [prop.property]: _, ...restData } = modifiedData
        modifiedData = restData
      }
    })

    // Update the item with remaining data
    Object.assign(item, modifiedData)

    // Collect all changes for a single callback
    const allChanges = { ...modifiedData, ...propertyChanges }

    // Execute specific callbacks FIRST to clear selections before state updates (prevents flickering)
    if (propertyChanges.visible !== undefined && typeof this.props.onItemVisibleChange === 'function') {
      this.props.onItemVisibleChange(this.getItemId(item), propertyChanges.visible)
    }

    if (propertyChanges.locked !== undefined && typeof this.props.onItemLockChange === 'function') {
      this.props.onItemLockChange(this.getItemId(item), propertyChanges.locked)
    }

    // Then notify about all changes at once
    if (typeof onItemChange === 'function' && Object.keys(allChanges).length > 0) {
      onItemChange(this.getItemId(item), allChanges)
    }

    // Handle special trigger for image replacement
    if (__triggerReplaceImage && typeof this.props.onReplaceImage === 'function') {
      this.props.onReplaceImage(this.getItemId(item))
    }

    // Defer UI update to a single operation
    this.deferredSyncListData()
    return item
  }

  /**
   * Helper method to update component state and trigger re-render
   */
  private updateState(newState: any) {
    Object.assign(this.state, newState)
    this.forceUpdate()
  }

  /**
   * Deferred list data sync to prevent multiple rapid updates
   */
  private deferredSyncListDataTimeout: NodeJS.Timeout | null = null

  private deferredSyncListData(additionalData?: Partial<S & GroupableItemListState>, isBulkAction?: boolean) {
    if (this.deferredSyncListDataTimeout) {
      clearTimeout(this.deferredSyncListDataTimeout)
    }

    this.deferredSyncListDataTimeout = setTimeout(() => {
      this.syncListData(additionalData, isBulkAction)
      this.deferredSyncListDataTimeout = null
    }, 0)
  }

  /**
   * Generic method to handle property propagation for visibility, lock status, etc.
   * This version avoids making callbacks during propagation
   *
   * @param item The item being changed
   * @param propertyName The name of the property (e.g., 'visible', 'locked')
   * @param newValue The new value to set
   * @param upwardPropagation Whether changes should propagate upward to parents
   * @param downwardPropagation Whether changes should propagate downward to children
   */
  private handlePropertyPropagation(
    item: GroupableItem,
    propertyName: string,
    newValue: boolean,
    upwardPropagation: boolean,
    downwardPropagation: boolean
  ) {
    // Apply bidirectional propagation based on property type and new value
    if (this.isGroup(item)) {
      // When changing a group, propagate to children based on property type
      if (downwardPropagation) {
        this.propagatePropertyToChildren(item, propertyName, newValue)
      }
    }

    // Handle upward propagation to parents differently based on property
    if (upwardPropagation) {
      if (propertyName === 'visible') {
        // For visibility: When setting to TRUE, force parents to be visible
        if (newValue) {
          this.propagatePropertyToParents(item, propertyName, true)
        } else if (item.parent) {
          // When setting to FALSE, update parent group based on its children
          this.updateGroupPropertyBasedOnChildren(item.parent, propertyName)
        }
      } else if (propertyName === 'locked') {
        // For locked:
        // - When LOCKING an item, check if all siblings are locked to determine parent's lock state
        // - When UNLOCKING an item, parent must always be unlocked
        if (newValue) {
          // When locking an item, check if ALL siblings are locked before locking the parent
          if (item.parent) {
            this.updateGroupPropertyBasedOnChildren(item.parent, propertyName)
          }
        } else {
          // When unlocking an item, force parent to be unlocked
          // This ensures ANY unlocked child makes the group unlocked
          this.propagatePropertyToParents(item, propertyName, false)
        }
      }
    }
    // When not explicitly handling upward propagation, still update parent group state
    else if (item.parent) {
      this.updateGroupPropertyBasedOnChildren(item.parent, propertyName)
    }
  }

  /**
   * Propagate property changes downward to children
   * This version avoids making callbacks during propagation
   *
   * @param group The group whose children's property should be updated
   * @param propertyName The name of the property to update
   * @param value The value to set
   */
  private propagatePropertyToChildren(group: GroupableItem, propertyName: string, value: boolean) {
    // Get all descendants (direct and nested children)
    const groupItems = this.getGroupItems(group, true)
    const changedItems: GroupableItem[] = []

    // Update each descendant's property based on the property type
    groupItems.forEach(item => {
      let shouldUpdate = false

      if (propertyName === 'visible') {
        // For visibility: Children always inherit parent's visibility
        shouldUpdate = item[propertyName] !== value
      } else if (propertyName === 'locked') {
        if (value === false) {
          // When unlocking a group, force all children to be unlocked
          shouldUpdate = item[propertyName] === true
        } else {
          // When locking a group, force all children to be locked
          shouldUpdate = item[propertyName] === false
        }
      }

      // Only update items that need to change
      if (shouldUpdate) {
        item[propertyName] = value
        changedItems.push(item)
      }
    })

    // Batch notify about changes
    if (changedItems.length > 0) {
      // Execute specific callbacks FIRST to clear selections before state updates (prevents flickering)
      changedItems.forEach(item => {
        if (propertyName === 'visible' && typeof this.props.onItemVisibleChange === 'function') {
          this.props.onItemVisibleChange(this.getItemId(item), item[propertyName])
        } else if (propertyName === 'locked' && typeof this.props.onItemLockChange === 'function') {
          this.props.onItemLockChange(this.getItemId(item), item[propertyName])
        }
      })

      // Then notify about general item changes
      if (typeof this.props.onItemChange === 'function') {
        changedItems.forEach(item => {
          this.props.onItemChange(this.getItemId(item), { [propertyName]: item[propertyName] })
        })
      }
    }
  }

  /**
   * Propagate property changes upward to parent groups
   * This version avoids making callbacks during propagation
   *
   * @param item The item whose parents' property should be updated
   * @param propertyName The name of the property to update
   * @param value The value to set
   */
  private propagatePropertyToParents(item: GroupableItem, propertyName: string, value: boolean) {
    let parent = item.parent ? this.getItemById(item.parent) : null
    const changedItems: GroupableItem[] = []

    // Walk up the tree to update all ancestor groups
    // For both properties, when needed, all parents must adopt the property value
    while (parent) {
      // Only update if parent's current value differs from the target value
      if (parent[propertyName] !== value) {
        parent[propertyName] = value
        changedItems.push(parent)
      }

      // Move up to the next parent in the hierarchy
      parent = parent.parent ? this.getItemById(parent.parent) : null
    }

    // Batch notify about changes
    if (changedItems.length > 0) {
      // Execute specific callbacks FIRST to clear selections before state updates (prevents flickering)
      changedItems.forEach(parent => {
        if (propertyName === 'visible' && typeof this.props.onItemVisibleChange === 'function') {
          this.props.onItemVisibleChange(this.getItemId(parent), parent[propertyName])
        } else if (propertyName === 'locked' && typeof this.props.onItemLockChange === 'function') {
          this.props.onItemLockChange(this.getItemId(parent), parent[propertyName])
        }
      })

      // Then notify about general item changes
      if (typeof this.props.onItemChange === 'function') {
        changedItems.forEach(parent => {
          this.props.onItemChange(this.getItemId(parent), { [propertyName]: parent[propertyName] })
        })
      }
    }
  }

  /**
   * Updates a group's property based on its children
   * Fixed to handle string IDs properly and reduce redundant updates
   *
   * @param groupId ID of the group to update
   * @param propertyName The name of the property to update
   */
  private updateGroupPropertyBasedOnChildren(groupId: string | undefined, propertyName: string) {
    // Early return if groupId is undefined
    if (!groupId) return

    // Convert parent to string ID if it's an object
    const actualGroupId = typeof groupId === 'object' ? this.getItemId(groupId as unknown as GroupableItem) : groupId

    if (!actualGroupId) return

    // Use an iterative approach with a queue to avoid recursion risks
    const groupsToProcess: string[] = [actualGroupId]
    const processedGroups: Set<string> = new Set() // Track processed groups to prevent cycles
    const changedGroups: Array<{ group: GroupableItem; property: string; value: boolean }> = []

    while (groupsToProcess.length > 0) {
      const currentGroupId = groupsToProcess.shift()

      // Skip if already processed to prevent infinite loops
      if (!currentGroupId || processedGroups.has(currentGroupId)) {
        continue
      }

      processedGroups.add(currentGroupId)

      const group = this.getItemById(currentGroupId)
      if (!group || !this.isGroup(group)) continue

      const children = this.getGroupItems(group, false)
      if (children.length === 0) continue

      // Determine children's property state
      const anyChildTrue = children.some(child => child[propertyName])
      const allChildrenFalse = children.every(child => !child[propertyName])

      let propertyChanged = false
      let newValue = false

      if (propertyName === 'visible') {
        // VISIBILITY RULES:
        // 1. If any child is visible, group must be visible
        // 2. If all children are hidden, group should be hidden
        if (anyChildTrue && !group[propertyName]) {
          // Update group to be visible if any child is visible
          group[propertyName] = true
          newValue = true
          propertyChanged = true
        } else if (allChildrenFalse && group[propertyName]) {
          // Update group to be hidden if all children are hidden
          group[propertyName] = false
          newValue = false
          propertyChanged = true
        }
      } else if (propertyName === 'locked') {
        // LOCKED RULES:
        // 1. If ALL children are locked, group should be locked
        // 2. If ANY child is unlocked, group must be unlocked
        const allChildrenLocked = children.every(child => child[propertyName])
        const anyChildUnlocked = children.some(child => !child[propertyName])

        if (allChildrenLocked && !group[propertyName]) {
          // Update group to be locked if ALL children are locked
          group[propertyName] = true
          newValue = true
          propertyChanged = true
        } else if (anyChildUnlocked && group[propertyName]) {
          // Update group to be unlocked if ANY child is unlocked
          group[propertyName] = false
          newValue = false
          propertyChanged = true
        }
      }

      // If the property was changed, track it and queue parent if needed
      if (propertyChanged) {
        changedGroups.push({ group, property: propertyName, value: newValue })

        // If there's a parent, enqueue the parent for processing
        if (group.parent) {
          groupsToProcess.push(group.parent)
        }
      }
    }

    // Batch notify about all changes at once
    if (changedGroups.length > 0) {
      // Execute specific callbacks FIRST to clear selections before state updates (prevents flickering)
      changedGroups.forEach(change => {
        if (change.property === 'visible' && typeof this.props.onItemVisibleChange === 'function') {
          this.props.onItemVisibleChange(this.getItemId(change.group), change.value)
        } else if (change.property === 'locked' && typeof this.props.onItemLockChange === 'function') {
          this.props.onItemLockChange(this.getItemId(change.group), change.value)
        }
      })

      // Then notify about general item changes
      if (typeof this.props.onItemChange === 'function') {
        changedGroups.forEach(change => {
          this.props.onItemChange(this.getItemId(change.group), { [change.property]: change.value })
        })
      }

      // Use deferred update to prevent multiple forceUpdates
      this.deferredSyncListData()
    }
  }

  private syncListData = (
    additionalData?: Partial<S & GroupableItemListState>,
    isBulkAction?: boolean,
    /**
     * Skip trace for skipping undo/redo
     */
    skipTrace?: boolean
  ) => {
    const { onCheck, onListChange, clearSelectionAfterBulkActions } = this.props

    // Clear selection after applying bulk actions
    if (isBulkAction && clearSelectionAfterBulkActions) {
      additionalData = Object.assign(additionalData || {}, { checkedItems: [] })
    }

    // Set additional data to component state
    if (additionalData) {
      Object.assign(this.state, additionalData)

      if (Object.prototype.hasOwnProperty.call(additionalData, 'checkedItems') && typeof onCheck === 'function') {
        const updatedCheckedItems = Array.from(new Set(this.state.checkedItems))
        setTimeout(() => onCheck(updatedCheckedItems), 10)
      }
    }

    if (typeof onListChange === 'function') {
      onListChange(
        this.state.items.map((item: GroupableItem) => this.getItemId(item)),
        skipTrace
      )
    }

    this.forceUpdate()
  }
}
