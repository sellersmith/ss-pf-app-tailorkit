import type { TouchHandlerParams } from './touch-handler-types'
import { useTouchTap } from './use-touch-tap'
import { useTouchStart } from './use-touch-start'
import { useTouchMove } from './use-touch-move'
import { useTouchEnd } from './use-touch-end'

export type { TouchHandlerParams as UseTouchHandlersParams }

export function useTouchHandlers(p: TouchHandlerParams) {
  const { handleTouchTap, handleTouchTapAndHold } = useTouchTap(p)
  const handleTouchStart = useTouchStart(p)
  const handleTouchMove = useTouchMove(p)
  const handleTouchEnd = useTouchEnd(p)
  return { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchTap, handleTouchTapAndHold }
}
