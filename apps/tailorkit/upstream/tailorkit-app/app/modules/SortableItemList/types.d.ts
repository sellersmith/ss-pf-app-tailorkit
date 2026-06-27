import type { OptionPricing } from '~/models/OptionSet'

export type SortableItem = {
  id?: string
  name: string
  value?: string
  additionalPricing?: OptionPricing
  defaultName?: string
  // And other optional data as well
  [key: string]: any
}

export type ItemList = SortableItem[]

export type SortableItemListProps = ComponentProps<any> & {
  className?: string
  disabled?: boolean
  addItemStyle?: any
  items: SortableItem[]
  blockItemGap?: string
  canEditItems?: boolean
  inlineItemGap?: string
  itemHtmlClass?: string
  customThumb?: ReactNode
  customExtraActions?: (item: SortableItem) => ReactNode
  itemBoxPadding?: string
  maxLabelLength?: number
  sortableItemStyle?: any
  customHeader?: ReactNode
  customFooter?: ReactNode
  canAddNewItems?: boolean
  canDeleteItems?: boolean
  containerHeight?: string
  inputFieldLabel?: string
  inputPlaceholder?: string
  editingHtmlClass?: string
  dataKeyToSyncChanges?: string
  addNewItemLabel?: string | ReactNode
  deleteItemLabel?: string | ReactNode
  dataInfoMessage?: string | ReactNode
  /**
   * When true, drag handle and other action icons are always visible instead of only on hover.
   * Default: false
   */
  actionsAlwaysVisible?: boolean
  // Define a function to render a list item
  renderItem?: (item: SortableItem) => ReactNode
  // Define a function to render a list item image
  renderImage?: (item: SortableItem) => ReactNode
  // Define a function to render actions to manipulate a list item
  renderActions?: (item: SortableItem) => ReactNode
  // Define a function to render error boundary
  renderError?: (error: Error, errorInfo: ErrorInfo) => ReactNode
  // Define a function to get a list item
  getItem?: (id: string) => SortableItem
  // Define a function to get the ID of a list item
  getItemId?: (item: SortableItem) => string
  // Define a function to get the image of a list item
  getItemImage?: (item: SortableItem) => string
  // Define a function to get the label of a list item
  getItemLabel?: (item: SortableItem) => string
  // Define a function to get the default label of a list item
  getItemDefaultLabel?: (item: SortableItem) => string
  // Define a function to set label for a list item
  setItemLabel?: (id: string, label: string) => void
  // Define a function to get item errors
  getItemError?: (item: SortableItem) => ReactNode
  // Define a function to validate item after edit
  validateItem?: (item: SortableItem) => undefined | string
  // Define a function to handle click action on a list item
  onClick?: (id: SortableItem) => void
  // Define a function to update editing state
  onEditing?: (id: SortableItem) => void
  // Define a function to add a new list item
  onAddItem?: () => string
  // Define a function to delete a list item
  onDeleteItem?: (id: string) => void
  // Define a function to handle changes in item data
  onItemChange?: (item: SortableItem) => void
  // Define a function to handle changes in the item list
  onListChange?: (items: ItemList) => void
  // Define a function to register event listener to watch for item changes from outside
  registerChangeListener: (cb: (e: any) => void) => void
  // Define a function to deregister event listener to watch for item changes from outside
  deregisterChangeListener: (cb: (e: any) => void) => void
}

export type SortableItemListState = ComponentState & {
  error?: Error
  editing?: string
  items: SortableItem[]
}
