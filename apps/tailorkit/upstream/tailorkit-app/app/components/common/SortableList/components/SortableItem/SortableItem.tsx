import type { DraggableSyntheticListeners, UniqueIdentifier } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@shopify/polaris'
import { DragHandleIcon } from '@shopify/polaris-icons'
import type { CSSProperties, PropsWithChildren } from 'react'
import { createContext, useContext, useMemo } from 'react'

interface Props {
  id: UniqueIdentifier
  styles?: CSSProperties
  className?: string
}

interface Context {
  attributes: Record<string, any>
  listeners: DraggableSyntheticListeners
  ref(node: HTMLElement | null): void
}

export const SortableItemContext = createContext<Context>({
  attributes: {},
  listeners: undefined,
  ref() {},
})

export function SortableItem({
  children,
  id,
  styles,
  className,
  ...otherProps
}: PropsWithChildren<Props & React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>>) {
  const { attributes, isDragging, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id,
  })
  const context = useMemo(
    () => ({
      attributes,
      listeners,
      ref: setActivatorNodeRef,
    }),
    [attributes, listeners, setActivatorNodeRef]
  )
  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : undefined,
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <SortableItemContext.Provider value={context}>
      <li
        className={`SortableItem ${className ?? ''}`}
        role="button"
        ref={setNodeRef}
        style={{ ...style, ...styles }}
        {...otherProps}
      >
        {children}
      </li>
    </SortableItemContext.Provider>
  )
}

export function DragHandle({ style, 'aria-label': ariaLabel }: { style?: CSSProperties; 'aria-label'?: string }) {
  const { attributes, listeners, ref } = useContext(SortableItemContext)

  const isDragging = attributes['aria-pressed']

  return (
    <button
      className="DragHandle"
      style={{ cursor: `${isDragging ? 'grabbing' : 'grab'}`, ...(style ?? {}) }}
      {...attributes}
      {...listeners}
      ref={ref}
      aria-label={ariaLabel}
    >
      <Icon source={DragHandleIcon} tone="subdued" />
    </button>
  )
}
