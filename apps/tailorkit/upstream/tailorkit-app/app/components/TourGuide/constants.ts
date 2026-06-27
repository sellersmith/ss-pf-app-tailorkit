import type { HighlightRect, TourGuideArrowProps } from './types'

export enum ECardPlacement {
  TOP = 'top',
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  TOP_CENTER = 'top-center',

  BOTTOM = 'bottom',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right',
  BOTTOM_CENTER = 'bottom-center',

  LEFT = 'left',
  LEFT_TOP = 'left-top',
  LEFT_BOTTOM = 'left-bottom',
  LEFT_CENTER = 'left-center',

  RIGHT = 'right',
  RIGHT_TOP = 'right-top',
  RIGHT_BOTTOM = 'right-bottom',
  RIGHT_CENTER = 'right-center',

  CENTER = 'center',
}

export const INITIAL_ONBOARDING_FLOW = {
  id: '',
  steps: [],
}

export const HELP_CARD_POSITION = {
  MOBILE: {
    bottom: 75,
    right: 75,
  },
  DESKTOP: {
    bottom: 80,
    right: 95,
  },
}

export const CARD_TARGET_SPACING = 10

export const DEFAULT_HIGH_LIGHT_RECT: HighlightRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  rx: 10,
  ry: 10,
  padding: 10,
  disableActiveInteraction: false,
}

export const DEFAULT_ARROW_CONFIG: TourGuideArrowProps = {
  color: '#000000',
  size: 'medium',
  animationStyle: 'draw',
  startPosition: 'bottom',
  offset: [0, 0],
  placement: ECardPlacement.CENTER,
  animationDuration: 1000,
}

export const ARROW_SIZE_MAP = {
  small: { strokeWidth: 3, markerSize: 6 },
  medium: { strokeWidth: 4, markerSize: 8 },
  large: { strokeWidth: 5, markerSize: 10 },
}

export const DEFAULT_RECURSIVE_QUERY_COUNT = 0
export const DEFAULT_RECURSIVE_QUERY_TIME = 150

/**
 * The key to identify an element can be bypass the prevent interaction while the tour guide is active.
 * This is useful for elements that are not interactable or not be highlighted by default.
 */
export const TRIGGER_ELEMENT = 'trigger-element'

/** Tour errors */
export const TOUR_ERRORS = {
  INVALID_TOUR: 'Invalid tour',
}
