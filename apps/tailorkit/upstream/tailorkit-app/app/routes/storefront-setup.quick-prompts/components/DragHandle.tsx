import { useContext } from 'react'
import { Icon } from '@shopify/polaris'
import { DragHandleIcon } from '@shopify/polaris-icons'
import { SortableItemContext } from '~/components/common/SortableList/components/SortableItem/SortableItem'

export function DragHandle() {
  const { attributes, listeners, ref } = useContext(SortableItemContext)

  const isDragging = attributes['aria-pressed']

  return (
    <div
      {...listeners}
      {...attributes}
      ref={ref}
      style={{ display: 'flex', alignItems: 'center', cursor: `${isDragging ? 'grabbing' : 'grab'}` }}
    >
      <Icon source={DragHandleIcon} />
    </div>
  )
}
