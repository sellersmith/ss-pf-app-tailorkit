import type { MouseHandlerParams } from './mouse-handler-types'
import { useMouseDown } from './use-mouse-down'
import { useMouseMove } from './use-mouse-move'
import { useMouseUp } from './use-mouse-up'

export type { MouseHandlerParams as UseMouseHandlersParams }

export function useMouseHandlers(p: MouseHandlerParams) {
  const handleMouseDown = useMouseDown(p)
  const handleMouseMove = useMouseMove(p)
  const handleMouseUp = useMouseUp(p)
  return { handleMouseDown, handleMouseMove, handleMouseUp }
}
