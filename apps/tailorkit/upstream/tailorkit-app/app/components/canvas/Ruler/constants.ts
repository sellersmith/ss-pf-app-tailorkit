export const RULER_CONSTANTS = {
  // Coordinate display
  COORDINATE_PADDING: 6,
  COORDINATE_FONT_SIZE: 10,

  // Colors
  RULER_BACKGROUND_COLOR: '#f0f0f0',
  RULER_BORDER_COLOR: '#ddd',
  RULER_NORMAL_COLOR: 'rgba(0, 100, 255, 0.9)',
  RULER_DELETE_COLOR: 'rgba(255, 0, 0, 0.9)',
  RULER_TICK_COLOR: 'rgb(48, 48, 48)',
  RULER_HIT_STROKE_WIDTH: 10,
  RULER_STROKE_WIDTH: 1,

  // Ticks
  MAJOR_TICK_INTERVAL: 10,
  MAJOR_TICK_SIZE_RATIO: 4,
  MINOR_TICK_SIZE_RATIO: 8,
  TICK_FONT_SIZE: 8,

  // Guide appearance
  GUIDE_LINE_DASH_RATIO: 5,
  GUIDE_HIT_STROKE_WIDTH: 10,
  GUIDE_OPACITY: 0.8,
  GUIDE_OPACITY_HOVER: 1,

  // Snapping
  SNAP_THRESHOLD: 10,

  // Animation
  GUIDE_FADE_DURATION: 50,

  // Mouse interaction
  MOUSE_MOVE_THROTTLE: 16,

  // Guide movement
  GUIDE_MOVEMENT_ANIMATION_DURATION: 0.15,

  // Error messages
  ERRORS: {
    LAYER_NOT_FOUND: 'Layer not found for guide movement',
    DRAGGING_LINE_NOT_FOUND: 'Dragging guide line reference not found',
    NODES_NOT_FOUND: 'Required nodes not found in coordinate display group',
  } as const,

  // CSS classes
  CLASSES: {
    GUIDE_DRAGGING: 'guide-dragging',
    GUIDE_DELETING: 'guide-deleting',
  } as const,

  // DOM attributes
  ATTRIBUTES: {
    DATA_GUIDE_ID: 'data-guide-id',
    DATA_GUIDE_TYPE: 'data-guide-type',
  } as const,
} as const

export type RulerConstantsType = typeof RULER_CONSTANTS
