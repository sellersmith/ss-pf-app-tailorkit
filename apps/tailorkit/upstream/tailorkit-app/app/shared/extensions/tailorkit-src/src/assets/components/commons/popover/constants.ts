// Define position constants to match the provided list
export const POSITIONS = {
  TOP: 'top',
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  TOP_CENTER: 'top-center',

  BOTTOM: 'bottom',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_CENTER: 'bottom-center',

  LEFT: 'left',
  LEFT_TOP: 'left-top',
  LEFT_BOTTOM: 'left-bottom',
  LEFT_CENTER: 'left-center',

  RIGHT: 'right',
  RIGHT_TOP: 'right-top',
  RIGHT_BOTTOM: 'right-bottom',
  RIGHT_CENTER: 'right-center',
} as const

export type PopoverPosition = (typeof POSITIONS)[keyof typeof POSITIONS]

export const POPOVER_TYPES = {
  AI_GENERATE_CONTENT: 'ai-generate-content',
} as const
