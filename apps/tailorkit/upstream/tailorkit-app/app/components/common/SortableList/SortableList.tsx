import type { Active, UniqueIdentifier, Modifier } from '@dnd-kit/core'
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { CSSProperties, ReactNode } from 'react'
import React, { Fragment, useMemo, useState } from 'react'
import { DragHandle, SortableItem, SortableOverlay } from './components'

interface BaseItem {
  id: UniqueIdentifier
}

interface Props<T extends BaseItem> {
  items: T[]
  onChange(items: T[]): void
  renderItem(item: T): ReactNode
  onDragStart?(active: Active): void
  modifiers?: Modifier[]
  direction?: 'vertical' | 'horizontal'
  sortableListOverlayStyle?: CSSProperties
}

export function SortableList<T extends BaseItem>({
  items,
  onChange,
  renderItem,
  onDragStart,
  modifiers,
  direction = 'vertical',
  sortableListOverlayStyle,
}: Props<T>) {
  const [active, setActive] = useState<Active | null>(null)
  const activeItem = useMemo(() => items.find(item => item.id === active?.id), [active, items])
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Local horizontal-axis restriction to avoid extra dependency on @dnd-kit/modifiers
  const restrictToHorizontalAxisLocal: Modifier = ({ transform }) => ({ ...transform, y: 0 })

  const computedModifiers = useMemo<Modifier[] | undefined>(() => {
    if (modifiers && modifiers.length > 0) return modifiers
    if (direction === 'horizontal') return [restrictToHorizontalAxisLocal]
    return undefined
  }, [direction, modifiers])

  return (
    <Fragment>
      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          modifiers={computedModifiers}
          onDragStart={({ active }) => {
            setActive(active)
            onDragStart?.(active)
          }}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over?.id) {
              const activeIndex = items.findIndex(({ id }) => id === active.id)
              const overIndex = items.findIndex(({ id }) => id === over.id)

              onChange(arrayMove(items, activeIndex, overIndex))
            }
            setActive(null)
          }}
          onDragCancel={() => {
            setActive(null)
          }}
        >
          <SortableContext
            items={items}
            strategy={direction === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy}
          >
            <ul className={`SortableList ${direction === 'horizontal' ? 'is-horizontal' : ''}`} role="application">
              {items.map(item => {
                return <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>
              })}
            </ul>
          </SortableContext>
          <SortableOverlay sortableListOverlayStyle={sortableListOverlayStyle || {}}>
            {activeItem ? renderItem(activeItem) : null}
          </SortableOverlay>
        </DndContext>
      )}
    </Fragment>
  )
}

SortableList.Item = SortableItem
SortableList.DragHandle = DragHandle
