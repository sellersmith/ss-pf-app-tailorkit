/**
 * Pre-made mask option sets for different aspect ratios
 * Provides a centralized configuration for mask shapes with dynamic URL generation
 */

// Base CDN configuration
const CDN_BASE_URL = 'https://cdn.shopify.com/s/files/1/0705/9383/9319/files'
const VERSION = '1'

/**
 * Ratio configuration interface
 */
export interface RatioConfig {
  keyLabel: string
  value: string
  urlSuffix: string
}

/**
 * Mask shape interface
 */
export interface MaskShape {
  _id: string
  name: string
  src: string
  ratio: string
}

/**
 * Shape configuration for URL generation
 */
interface ShapeConfig {
  name: string
  fileName: string
  versions?: {
    [key: string]: string // ratio -> version
  }
}

/**
 * Aspect ratio configurations
 */
export const PRE_MADE_MASK_OPTION_SET_RATIO: Record<string, RatioConfig> = {
  SQUARE: {
    keyLabel: 'Square 1:1',
    value: '1:1',
    urlSuffix: 'Square_1_1',
  },
  LANDSCAPE_4_3: {
    keyLabel: 'Landscape 4:3',
    value: '4:3',
    urlSuffix: 'Landscape_4_3',
  },
  LANDSCAPE_16_9: {
    keyLabel: 'Landscape 16:9',
    value: '16:9',
    urlSuffix: 'Landscape_16_9',
  },
  PORTRAIT_3_4: {
    keyLabel: 'Portrait 3:4',
    value: '3:4',
    urlSuffix: 'Portrait_3_4',
  },
  PORTRAIT_9_16: {
    keyLabel: 'Portrait 9:16',
    value: '9:16',
    urlSuffix: 'Portrait_9_16',
  },
} as const

export const DEFAULT_MASK_OPTION_SHAPE_NAME = 'Circle'

const COMMON_SHAPES = [
  'Arch',
  'Arrow',
  'Badge',
  'Circle',
  'Cloud',
  'Diamond',
  'Flower',
  'Heart',
  'Hexagon',
  'House',
  'Octagon',
  'Oval A',
  'Oval B',
  'Parallelogram',
  'Rectangle A',
  'Rectangle B',
  'Square',
  'Star',
  'Starburst',
  'Triangle',
]

/**
 * Shape configurations with proper naming and versioning
 */
const SHAPE_CONFIGS: ShapeConfig[] = COMMON_SHAPES.map(shape => ({
  name: shape,
  fileName: shape.replaceAll(' ', '_'),
}))

/**
 * Generates a CDN URL for a given shape and ratio
 * @param shapeConfig - The shape configuration
 * @param ratioConfig - The ratio configuration
 * @param customVersion - Optional custom version override
 * @returns The generated CDN URL
 */
const generateMaskUrl = (shapeConfig: ShapeConfig, ratioConfig: RatioConfig): string => {
  return `${CDN_BASE_URL}/${shapeConfig.fileName}_${ratioConfig.urlSuffix}.png?v=${VERSION}`
}

/**
 * Creates mask option set for a specific ratio
 * @param ratioKey - The ratio key from PRE_MADE_MASK_OPTION_SET_RATIO
 * @param shapeNames - Array of shape names to include
 * @returns Array of mask shapes with generated URLs
 */
const createMaskOptionSet = (
  ratioKey: keyof typeof PRE_MADE_MASK_OPTION_SET_RATIO,
  shapeNames: readonly string[]
): MaskShape[] => {
  const ratioConfig = PRE_MADE_MASK_OPTION_SET_RATIO[ratioKey]

  return shapeNames
    .map(shapeName => {
      const shapeConfig = SHAPE_CONFIGS.find(config => config.name === shapeName)
      if (!shapeConfig) {
        console.warn(`Shape config not found for: ${shapeName}`)
        return null
      }

      return {
        _id: `_TLK_PRE_MADE_MASK_${shapeName}_${ratioConfig.urlSuffix}`,
        name: shapeName,
        src: generateMaskUrl(shapeConfig, ratioConfig),
        ratio: ratioConfig.value,
      }
    })
    .filter((shape): shape is MaskShape => shape !== null)
}

/**
 * Shape availability per ratio (some shapes may not be available for all ratios)
 */
const SHAPES_BY_RATIO = {
  LANDSCAPE_4_3: [...COMMON_SHAPES],
  LANDSCAPE_16_9: [...COMMON_SHAPES],
  PORTRAIT_3_4: [...COMMON_SHAPES],
  PORTRAIT_9_16: [...COMMON_SHAPES],
  SQUARE: [...COMMON_SHAPES],
} as const

/**
 * Generated mask option sets with corrected data
 */
export const PRE_MADE_MASK_OPTION_SET_LANDSCAPE_4_3 = createMaskOptionSet(
  'LANDSCAPE_4_3',
  SHAPES_BY_RATIO.LANDSCAPE_4_3
)

export const PRE_MADE_MASK_OPTION_SET_LANDSCAPE_16_9 = createMaskOptionSet(
  'LANDSCAPE_16_9',
  SHAPES_BY_RATIO.LANDSCAPE_16_9
)

export const PRE_MADE_MASK_OPTION_SET_PORTRAIT_3_4 = createMaskOptionSet('PORTRAIT_3_4', SHAPES_BY_RATIO.PORTRAIT_3_4)

export const PRE_MADE_MASK_OPTION_SET_PORTRAIT_9_16 = createMaskOptionSet(
  'PORTRAIT_9_16',
  SHAPES_BY_RATIO.PORTRAIT_9_16
)

export const PRE_MADE_MASK_OPTION_SET_SQUARE = createMaskOptionSet('SQUARE', SHAPES_BY_RATIO.SQUARE)

/**
 * Combined mask option sets including all ratios
 */
export const PRE_MADE_MASK_OPTION_SET = [
  ...PRE_MADE_MASK_OPTION_SET_LANDSCAPE_4_3,
  ...PRE_MADE_MASK_OPTION_SET_LANDSCAPE_16_9,
  ...PRE_MADE_MASK_OPTION_SET_PORTRAIT_3_4,
  ...PRE_MADE_MASK_OPTION_SET_PORTRAIT_9_16,
  ...PRE_MADE_MASK_OPTION_SET_SQUARE,
]

/**
 * Utility function to get mask options by ratio
 * @param ratio - The aspect ratio string (e.g., '4:3', '16:9')
 * @returns Array of mask shapes for the specified ratio
 */
export const getMaskOptionsByRatio = (ratio: string): MaskShape[] => {
  switch (ratio) {
    case '4:3':
      return PRE_MADE_MASK_OPTION_SET_LANDSCAPE_4_3
    case '16:9':
      return PRE_MADE_MASK_OPTION_SET_LANDSCAPE_16_9
    case '3:4':
      return PRE_MADE_MASK_OPTION_SET_PORTRAIT_3_4
    case '9:16':
      return PRE_MADE_MASK_OPTION_SET_PORTRAIT_9_16
    case '1:1':
      return PRE_MADE_MASK_OPTION_SET_SQUARE
    default:
      return []
  }
}

export const getDefaultMaskOptionByRatio = (ratio: string): MaskShape | undefined => {
  const maskOptions = getMaskOptionsByRatio(ratio)
  return maskOptions.find(option => option.name === DEFAULT_MASK_OPTION_SHAPE_NAME)
}

/**
 * Utility function to get available ratios
 * @returns Array of all available ratio configurations
 */
export const getAvailableRatios = (): RatioConfig[] => {
  return Object.values(PRE_MADE_MASK_OPTION_SET_RATIO)
}
