export type GroupableItem = {
  id?: string
  open?: boolean
  parent?: string
  type: 'group' | string
  // And other optional data as well
  [key: string]: any
}

export type ItemAction =
  | {
      style?: any
      className?: string
      onAction?: (item: GroupableItem) => GroupableItem
      content: ReactNode | ((item: GroupableItem) => ReactNode)
    }
  | (() => {
      style?: any
      className?: string
      onAction?: (item: GroupableItem) => GroupableItem
      content: ReactNode | ((item: GroupableItem) => ReactNode)
    })

// TODO: Item list must follow the following 2 rules:
// - Items belonging to a group must set the ID of the group as the value for the `parent` prop.
// - Group items must be placed after/below the related group in the list of items.
export type ItemList = GroupableItem[]

// TODO: When a specific use case needs to be handled, please do not update the code
// of the component. Instead, you can use the following JSX props to customize the
// component to fit individual use cases.
export type GroupableItemListProps = ComponentProps<any> & {
  items: ItemList
  // Define actions for individual item
  actions?: ItemAction[]
  // Define actions for multiple items
  bulkActions?: ItemAction[]
  // Additional bulk actions to append after defaults (before select-all checkbox)
  extraBulkActions?: ItemAction[]
  // Define actions for context menu
  contextMenuActions?: ItemAction[]
  // Define data keys for searching
  queryKey?: string[]
  // Define keyword to filter the item list at the first render
  queryValue?: string
  // Define IDs of items that should be highlighted on the item list
  highlightedItems?: string[]
  // Whether to create a new group when dropping an item on another item?
  dropOnItemCreateGroup?: boolean
  // Define a CSS class to highlight the drop target when dragging over
  dropTargetHighlightClass?: string
  // Define the event name to watch changes from outside in item data
  eventToWatchChangesFromOutside?: string
  // Define the data key to synchronize changes from outside in item data
  dataKeyToSyncChanges?: string
  // Whether to automatically open a group when dragging over and stay
  // for a predefined number of milliseconds?
  autoOpenGroupOnDragOver?: false | number
  // Define a function to register event listener to watch for item changes from outside
  registerChangeListener: (cb: (e: any) => void) => void
  // Define a function to deregister event listener to watch for item changes from outside
  deregisterChangeListener: (cb: (e: any) => void) => void
  // Define a function to check whether an item is a group
  isGroup?: (item: GroupableItem) => boolean
  // Define a function to check whether an item is renderable
  isRenderable?: (item: GroupableItem) => boolean
  // Define a function to check whether an item is draggable
  isDraggable?: (item: GroupableItem) => boolean
  // Define a function to check whether an item is droppable
  isDroppable?: (item: GroupableItem, dropAction: string, dragItem?: GroupableItem) => boolean
  // Define a function to generate item ID
  generateId?: () => string
  // Define a function to generate data for a new group
  generateGroup?: () => GroupableItem
  // Define a function to get the ID of an item
  getItemId?: (item: GroupableItem) => string
  // Define a function to get the label of an item
  getItemLabel?: (item: GroupableItem) => string
  // Define a function to show messages to users
  showMessage?: (message: string) => void
  // Define a function to render an item
  renderItem?: (item: GroupableItem, level: number) => ReactNode
  // Define a function to render a group
  renderGroup?: (group: GroupableItem, level: number) => ReactNode
  // Define a function to render error boundary
  renderError?: (error: Error, errorInfo: ErrorInfo) => ReactNode
  // Define a function to handle changes in item data
  onItemChange?: (item: GroupableItem) => void
  // Define a function to duplicate an item
  onDuplicateItem?: (item: GroupableItem) => GroupableItem
  // Define a function to handle changes in the item list
  onListChange?: (items: ItemList) => void
  // Define a function to handle click action on an item
  onClick?: (clickedId: string) => string
  // Define a function to handle check action on an item
  onCheck?: (checkedIds: string[]) => string
  // Define a function to handle image replacement for image layers
  onReplaceImage?: (layerId: string) => void
}

export type GroupableItemListState = ComponentState & {
  error?: Error
  items: ItemList
  queryKey?: string[]
  queryValue?: string
  dragItem?: HTMLElement
  checkedItems?: ItemList
  dropTarget?: HTMLElement
  confirmBulkAction?: string
  confirmBulkActionLabel?: string
  scrollToLastHighlightedItem?: boolean
  confirmDestructiveBulkAction?: boolean
  clearSelectionAfterBulkActions?: boolean
  confirmBulkActionCallback?: (...args: any[]) => void
  dropAction?: 'insert-before' | 'insert-after' | 'create-group'
  contextMenuOpen?: boolean
  contextMenuAnchor?: { x: number; y: number }
}
