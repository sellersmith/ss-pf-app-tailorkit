const DEFAULT_CANVAS_SCALE = 0.3
const OUTLINE_WIDTH = 220
const CANVAS_WIDTH = 500
const CANVAS_HEIGHT = 500

export { DEFAULT_CANVAS_SCALE, CANVAS_WIDTH, CANVAS_HEIGHT, OUTLINE_WIDTH }

export const MAX_TEMPLATE_NAME_SIZE = 255
export const MAX_OPTION_SET_NAME_SIZE = 100
export const MAX_OPTION_SET_ITEM_NAME_SIZE = 512
export const MAX_LAYER_NAME_SIZE = 60
export const MAX_LABEL_ON_STOREFRONT = 100
export const MIN_OPTION_SET_ITEM_LENGTH = 1

export const MAX_ZOOM_SPEED = 25
export const MIN_SCALE = 0.01
export const SCALE_WORLD = 1.5

export const TEMPLATE_EDITOR_CANVAS_CONTAINER = 'template-editor-canvas-container'
export const TEMPLATE_CONTAINER_RENDERER = 'template-container'
export const LAYER_SELECTION_RENDERER = 'template-container'

export const CANVAS_EDITOR_STAGE = 'canvas-editor'
export const CANVAS_EDITOR_LAYER = 'canvas-editor-layer'
export const INTEGRATION_CANVAS_EDITOR_STAGE = 'integration-canvas-editor'

export const LAYER_STROKE_WIDTH = 2
export const LAYER_STROKE_COLOR = '#005BD3'
export const LAYER_STROKE_DASH_COLOR = 'rgba(4, 123, 93, 1)'
export const LAYER_STROKE_CAUTION_COLOR = '#FFEB78'
export const LAYER_STROKE_INNER_EDIT_COLOR = '#8B5CF6' // Purple color for inner edit mode
export const SELECTION_RECT_FILL_COLOR = 'rgba(0, 161, 255, 0.3)'
export const SELECTION_RECT_STROKE_COLOR = 'rgba(0, 161, 255, 0.8)'

export const MASK_LAYER_STROKE_COLOR = '#000'
export const PRODUCT_LAYER_STROKE_COLOR = '#0000000d'
export const PRODUCT_LAYER_STROKE_WIDTH = 2

/**
 * Layer name for identify the layer in the canvas
 */
export const LAYER_NAME = 'layer'
export const INNER_EDIT_NODE_NAME = 'inner-edit-node'

// Preview product image node name and canvas border styling
export const PREVIEW_IMAGE_NODE_NAME = 'preview-image-node'
export const CANVAS_BORDER_COLOR = '#000000'
export const CANVAS_BORDER_STROKE_WIDTH = 3
export const CANVAS_BORDER_DASH: number[] = [4, 4]

export const LAYER_MASK_NAME = 'mask-layer'
export const GROUP_LAYER_NAME = 'group-layer'

export const BASE_LAYERS = ['imageless', 'image', 'text']
export const LAYER_DUPLICATED_GAP = 50
export const MAX_LAYOUT_NAME_SIZE = 100
export const MAX_LAYOUT_NUMBER_SIZE = 100

export const ROTATION_SNAPS = Array.from({ length: 25 }, (_, index) => index * 15)

export const TOOL_LAYER_IDS = {
  GRID: 'grid-tool',
  RULER: 'ruler-tool',
}
