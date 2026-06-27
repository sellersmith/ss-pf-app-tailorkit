/**
 * Predefined Shape Definitions
 * Contains shape metadata, icons, and generator references
 */

import type { FC } from 'react'
import type { ShapeGenerator } from '../utils/shapes/shapeGenerators'
import type { CompositeShapeGenerator, CompositePathResult, UnifiedGridGenerator } from '../utils/shapes/compositeTypes'
import { shapeGenerators } from '../utils/shapes/shapeGenerators'
import { serializePathCommands } from '../utils/svg/pathParsing'
import { NATURE_SHAPES } from './nature'
import { PATTERN_SHAPES } from './patterns'
import { OBJECTS_SHAPES } from './objects'
import { FANTASY_SHAPES, FANTASY_GROUPS } from './fantasy'
import { ZODIAC_SIGNS_SHAPES } from './zodiacSigns'
import { ZODIAC_ANIMALS_SHAPES } from './zodiacAnimals'
import { CONSTELLATIONS_SHAPES } from './constellations'
import { PETS_SHAPES, PETS_GROUPS } from './pets'
import { GRIDS_SHAPES, GRIDS_GROUPS } from './grids'
import { BIRTHDAY_SHAPES } from './birthday'
import { VALENTINE_SHAPES } from './valentine'
import { WEDDING_SHAPES } from './wedding'

// =============================================================================
// Dynamic Shape Icon Generator
// Creates icon components that match the actual shape generator output
// =============================================================================

const ICON_SIZE = 24
const ICON_PADDING = 2
const ICON_VIEWBOX_SIZE = ICON_SIZE - ICON_PADDING * 2 // 20x20 usable area

/**
 * Creates a dynamic icon component from a simple shape generator
 * The icon will match the exact formation and use a stroke-based style
 * @param generator - The shape generator function
 * @param aspectRatio - Optional aspect ratio override { width, height } for non-square icons
 */
function createShapeIcon(generator: ShapeGenerator, aspectRatio?: { width: number; height: number }): FC {
  return function ShapeIcon() {
    // Use custom aspect ratio if provided, otherwise use square dimensions
    const iconWidth = aspectRatio ? aspectRatio.width : ICON_VIEWBOX_SIZE
    const iconHeight = aspectRatio ? aspectRatio.height : ICON_VIEWBOX_SIZE

    // Generate the shape at icon size
    const commands = generator(ICON_SIZE / 2, ICON_SIZE / 2, iconWidth, iconHeight)
    const pathD = serializePathCommands(commands)

    return (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}>
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    )
  }
}

/**
 * Creates a dynamic icon component from a composite shape generator
 * The icon will match the exact formation AND show actual fill/stroke colors
 */
function createCompositeShapeIcon(generator: CompositeShapeGenerator): FC {
  return function CompositeShapeIcon() {
    // Generate the composite shape at icon size
    const parts = generator(ICON_SIZE / 2, ICON_SIZE / 2, ICON_VIEWBOX_SIZE, ICON_VIEWBOX_SIZE)

    // Sort by zIndex (lower first = rendered behind)
    const sortedParts = [...parts].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

    return (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}>
        {sortedParts.map((part, index) => {
          const pathD = serializePathCommands(part.commands)
          return (
            <path
              key={`${part.id}-${index}`}
              d={pathD}
              fill={part.fill || 'none'}
              stroke={part.stroke || 'currentColor'}
              strokeWidth={part.strokeWidth ? Math.min(part.strokeWidth, 1) : 0.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
    )
  }
}

/**
 * Creates a dynamic icon component from a unified grid generator
 * The icon shows all tiles as a single path with the unified generator's colors
 */
function createUnifiedGridShapeIcon(generator: UnifiedGridGenerator): FC {
  return function UnifiedGridShapeIcon() {
    // Generate the unified grid at icon size
    const result = generator(ICON_SIZE / 2, ICON_SIZE / 2, ICON_VIEWBOX_SIZE, ICON_VIEWBOX_SIZE)
    const pathD = serializePathCommands(result.commands)

    return (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}>
        <path
          d={pathD}
          fill={result.fill || 'none'}
          stroke={result.stroke || 'currentColor'}
          strokeWidth={result.strokeWidth ? Math.min(result.strokeWidth, 1) : 0.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    )
  }
}

// Shape categories for filtering
export type ShapeCategory =
  | 'basic'
  | 'nature'
  | 'patterns'
  | 'objects'
  | 'fantasy'
  | 'zodiac'
  | 'pets'
  | 'grids'
  | 'occasions'

// Shape group definition for sub-categories
export interface ShapeGroupDefinition {
  id: string
  labelKey: string
  collapsed?: boolean // Default collapsed state in UI
}

export interface ShapeCategoryDefinition {
  id: ShapeCategory
  labelKey: string
  groups?: ShapeGroupDefinition[] // Optional sub-groups within category
  deprecated?: boolean // Mark deprecated categories
}

export interface ShapeDefinition {
  id: string
  name: string
  category: Exclude<ShapeCategory, 'all'>
  group?: string // Sub-group within category
  icon: FC
  generator: ShapeGenerator
  isComposite?: false
}

export interface CompositeShapeDefinition {
  id: string
  name: string
  category: Exclude<ShapeCategory, 'all'>
  group?: string // Sub-group within category
  icon: FC
  generator: CompositeShapeGenerator
  isComposite: true
}

export interface UnifiedGridShapeDefinition {
  id: string
  name: string
  category: Exclude<ShapeCategory, 'all'>
  group?: string // Sub-group within category
  icon: FC
  generator: UnifiedGridGenerator
  isUnifiedGrid: true
}

// Pattern configuration for scatter effects
export interface PatternConfig {
  seed?: number // Random seed for reproducibility
  count?: number // Number of scattered instances
  density?: number // Distribution density (0-1)
  rotation?: { min: number; max: number } // Rotation range in degrees
  scale?: { min: number; max: number } // Scale variation
  colors?: string[] // Color palette for variation
  distribution?: 'random' | 'grid' | 'radial' | 'spiral' // Distribution type
}

// Pattern generator type
export type PatternShapeGenerator = (
  cx: number,
  cy: number,
  width: number,
  height: number,
  config?: PatternConfig
) => CompositePathResult[]

export interface PatternShapeDefinition {
  id: string
  name: string
  category: 'patterns'
  group?: string
  icon: FC
  generator: PatternShapeGenerator
  isPattern: true
  defaultConfig?: PatternConfig
}

export type AnyShapeDefinition =
  | ShapeDefinition
  | CompositeShapeDefinition
  | PatternShapeDefinition
  | UnifiedGridShapeDefinition

// Nature group definitions
export const NATURE_GROUPS: ShapeGroupDefinition[] = [
  { id: 'basic', labelKey: 'Basic' },
  { id: 'leaves', labelKey: 'Leaves' },
  { id: 'flowers', labelKey: 'Flowers' },
]

// Objects group definitions
export const OBJECTS_GROUPS: ShapeGroupDefinition[] = [
  { id: 'sports', labelKey: 'Sports' },
  { id: 'vehicles', labelKey: 'Vehicles' },
  { id: 'stationery', labelKey: 'Stationery' },
  { id: 'furniture', labelKey: 'Furniture' },
  { id: 'containers', labelKey: 'Containers' },
  { id: 'electronics', labelKey: 'Electronics' },
]

// Pattern group definitions
export const PATTERN_GROUPS: ShapeGroupDefinition[] = [
  { id: 'scatter', labelKey: 'Scatter Effects' },
  { id: 'burst', labelKey: 'Burst Effects' },
]

// Zodiac group definitions (combines Zodiac Signs, Constellations, and Chinese Zodiac)
export const ZODIAC_GROUPS: ShapeGroupDefinition[] = [
  { id: 'zodiac-signs', labelKey: 'Zodiac Signs' },
  { id: 'constellations', labelKey: 'Constellations' },
  { id: 'chinese-zodiac', labelKey: 'Chinese Zodiac' },
]

// Occasions group definitions (Birthday, Valentine, Wedding, etc.)
export const OCCASIONS_GROUPS: ShapeGroupDefinition[] = [
  { id: 'birthday', labelKey: 'Birthday' },
  { id: 'wedding', labelKey: 'Wedding' },
  { id: 'valentine', labelKey: 'Valentine' },
]

// Category definitions for the select box
export const SHAPE_CATEGORIES: ShapeCategoryDefinition[] = [
  { id: 'basic', labelKey: 'Basic' },
  { id: 'grids', labelKey: 'Grids', groups: GRIDS_GROUPS },
  { id: 'pets', labelKey: 'Pets', groups: PETS_GROUPS },
  { id: 'nature', labelKey: 'Nature', groups: NATURE_GROUPS },
  { id: 'objects', labelKey: 'Objects', groups: OBJECTS_GROUPS },
  { id: 'patterns', labelKey: 'Patterns', groups: PATTERN_GROUPS },
  { id: 'occasions', labelKey: 'Occasions', groups: OCCASIONS_GROUPS },
  { id: 'zodiac', labelKey: 'Zodiac', groups: ZODIAC_GROUPS },
  { id: 'fantasy', labelKey: 'Fantasy', groups: FANTASY_GROUPS },
]

// Freehand drawing icon (kept as static since it represents a concept, not a generatable shape)
const FreehandIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 17C5 15 8 10 12 12C16 14 18 8 21 6" strokeLinecap="round" />
    <circle cx="3" cy="17" r="2" fill="currentColor" />
    <circle cx="21" cy="6" r="2" fill="currentColor" />
  </svg>
)

// =============================================================================
// Shape Definitions Array
// =============================================================================

export const PREDEFINED_SHAPES: ShapeDefinition[] = [
  // Basic shapes - ordered: Quarter Arc, Semicircle, Three Quarter Arc, Circle, Ellipse, Triangle, Square, Rectangle
  {
    id: 'quarter-arc',
    name: 'Quarter Arc',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators['quarter-arc']),
    generator: shapeGenerators['quarter-arc'],
  },
  {
    id: 'semicircle',
    name: 'Semicircle',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.semicircle),
    generator: shapeGenerators.semicircle,
  },
  {
    id: 'three-quarter-arc',
    name: 'Three Quarter Arc',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators['three-quarter-arc']),
    generator: shapeGenerators['three-quarter-arc'],
  },
  {
    id: 'circle',
    name: 'Circle',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.circle),
    generator: shapeGenerators.circle,
  },
  {
    id: 'ellipse',
    name: 'Ellipse',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.ellipse, { width: ICON_VIEWBOX_SIZE, height: ICON_VIEWBOX_SIZE * 0.6 }),
    generator: shapeGenerators.ellipse,
  },
  {
    id: 'triangle',
    name: 'Triangle',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.triangle),
    generator: shapeGenerators.triangle,
  },
  {
    id: 'square',
    name: 'Square',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.square),
    generator: shapeGenerators.square,
  },
  {
    id: 'rectangle',
    name: 'Rectangle',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.rectangle, { width: ICON_VIEWBOX_SIZE, height: ICON_VIEWBOX_SIZE * 0.6 }),
    generator: shapeGenerators.rectangle,
  },

  // Polygons (merged into Basic)
  {
    id: 'pentagon',
    name: 'Pentagon',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.pentagon),
    generator: shapeGenerators.pentagon,
  },
  {
    id: 'hexagon',
    name: 'Hexagon',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.hexagon),
    generator: shapeGenerators.hexagon,
  },
  {
    id: 'heptagon',
    name: 'Heptagon',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.heptagon),
    generator: shapeGenerators.heptagon,
  },
  {
    id: 'octagon',
    name: 'Octagon',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.octagon),
    generator: shapeGenerators.octagon,
  },

  // Stars (merged into Basic)
  {
    id: 'star',
    name: 'Star',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.star),
    generator: shapeGenerators.star,
  },
  {
    id: 'nine-point-star',
    name: '9-Point Star',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators['nine-point-star']),
    generator: shapeGenerators['nine-point-star'],
  },
  {
    id: 'heart',
    name: 'Heart',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.heart),
    generator: shapeGenerators.heart,
  },

  // Arrows (merged into Basic)
  {
    id: 'arrow',
    name: 'Arrow',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators.arrow),
    generator: shapeGenerators.arrow,
  },
  {
    id: 'double-arrow',
    name: 'Double Arrow',
    category: 'basic',
    icon: createShapeIcon(shapeGenerators['double-arrow']),
    generator: shapeGenerators['double-arrow'],
  },

  // Nature - Basic (existing shapes)
  {
    id: 'waterdrop',
    name: 'Waterdrop',
    category: 'nature',
    group: 'basic',
    icon: createShapeIcon(shapeGenerators.waterdrop),
    generator: shapeGenerators.waterdrop,
  },
  {
    id: 'moon',
    name: 'Moon',
    category: 'nature',
    group: 'basic',
    icon: createShapeIcon(shapeGenerators.moon),
    generator: shapeGenerators.moon,
  },
  {
    id: 'sun',
    name: 'Sun',
    category: 'nature',
    group: 'basic',
    icon: createShapeIcon(shapeGenerators.sun),
    generator: shapeGenerators.sun,
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    category: 'nature',
    group: 'basic',
    icon: createShapeIcon(shapeGenerators.snowflake),
    generator: shapeGenerators.snowflake,
  },
  {
    id: 'mountain',
    name: 'Mountain',
    category: 'nature',
    group: 'basic',
    icon: createShapeIcon(shapeGenerators.mountain),
    generator: shapeGenerators.mountain,
  },

  // Weather shapes (merged into Nature Basic)
  {
    id: 'wave',
    name: 'Wave',
    category: 'nature',
    group: 'basic',
    icon: createShapeIcon(shapeGenerators.wave),
    generator: shapeGenerators.wave,
  },
  {
    id: 'thunder',
    name: 'Thunder',
    category: 'nature',
    group: 'basic',
    icon: createShapeIcon(shapeGenerators.thunder),
    generator: shapeGenerators.thunder,
  },
  {
    id: 'wind',
    name: 'Wind',
    category: 'nature',
    group: 'basic',
    icon: createShapeIcon(shapeGenerators.wind),
    generator: shapeGenerators.wind,
  },
]

// Export freehand icon for use in popover
export { FreehandIcon }

// Export icon creator functions for use in other shape definition files
export { createShapeIcon, createCompositeShapeIcon, createUnifiedGridShapeIcon }

// Combined array of all shapes (simple + composite + nature + patterns + objects + grids + fantasy + zodiac + constellations + pets + occasions)
export const ALL_SHAPES: AnyShapeDefinition[] = [
  ...PREDEFINED_SHAPES,
  ...BIRTHDAY_SHAPES,
  ...WEDDING_SHAPES,
  ...VALENTINE_SHAPES,
  ...NATURE_SHAPES,
  ...PATTERN_SHAPES,
  ...OBJECTS_SHAPES,
  ...GRIDS_SHAPES,
  ...FANTASY_SHAPES,
  ...ZODIAC_SIGNS_SHAPES,
  ...ZODIAC_ANIMALS_SHAPES,
  ...CONSTELLATIONS_SHAPES,
  ...PETS_SHAPES,
]

// Helper to get shape by ID (searches both simple and composite shapes)
export function getShapeById(id: string): AnyShapeDefinition | undefined {
  return ALL_SHAPES.find(shape => shape.id === id)
}

// Helper to check if a shape is a pattern type
export function isPatternShape(shape: AnyShapeDefinition): shape is PatternShapeDefinition {
  return 'isPattern' in shape && shape.isPattern === true
}

// Helper to check if a shape is a composite type
export function isCompositeShape(shape: AnyShapeDefinition): shape is CompositeShapeDefinition {
  return 'isComposite' in shape && shape.isComposite === true
}

// Helper to check if a shape is a unified grid type
export function isUnifiedGridShape(shape: AnyShapeDefinition): shape is UnifiedGridShapeDefinition {
  return 'isUnifiedGrid' in shape && shape.isUnifiedGrid === true
}

// Helper to get shapes by category
export function getShapesByCategory(category: ShapeCategory): AnyShapeDefinition[] {
  return ALL_SHAPES.filter(shape => shape.category === category)
}

// Helper to get shapes by category and group
export function getShapesByGroup(category: ShapeCategory, group: string): AnyShapeDefinition[] {
  return ALL_SHAPES.filter(shape => shape.category === category && shape.group === group)
}

// Helper to get category definition
export function getCategoryDefinition(categoryId: ShapeCategory): ShapeCategoryDefinition | undefined {
  return SHAPE_CATEGORIES.find(c => c.id === categoryId)
}

// Helper to get non-deprecated categories
export function getActiveCategories(): ShapeCategoryDefinition[] {
  return SHAPE_CATEGORIES.filter(c => !c.deprecated)
}
