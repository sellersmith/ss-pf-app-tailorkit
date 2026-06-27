export type TooltipPosition =
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right'

export type TooltipTrigger = 'hover' | 'click' | 'focus' | 'manual'

export interface TooltipOptions {
  content: string
  position?: TooltipPosition
  trigger?: TooltipTrigger
  delay?: number
  hideDelay?: number
  className?: string
  maxWidth?: number
  disabled?: boolean
  offset?: number
  zIndex?: number
  appendTo?: HTMLElement | string
  onShow?: () => void
  onHide?: () => void
  onToggle?: (visible: boolean) => void
}
