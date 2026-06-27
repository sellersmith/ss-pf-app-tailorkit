import type { CSSProperties, PropsWithChildren } from 'react'
import { DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core'
import type { DropAnimation } from '@dnd-kit/core'

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
}

interface Props {
  sortableListOverlayStyle?: CSSProperties
}

export function SortableOverlay({ children, sortableListOverlayStyle }: PropsWithChildren<Props>) {
  return (
    <DragOverlay dropAnimation={dropAnimationConfig} style={sortableListOverlayStyle || {}}>
      {children}
    </DragOverlay>
  )
}
