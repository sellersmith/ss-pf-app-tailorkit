/**
 * Grid Shape Definitions
 * Contains grid layout shapes with configurable tile types
 * Each grid is a unified shape (single path with multiple subpaths, one per tile)
 */

import type { UnifiedGridShapeDefinition, ShapeGroupDefinition } from './shapes'
import { createUnifiedGridShapeIcon } from './shapes'
import {
  // Unified canvas generators (24px gap) - single path with multiple subpaths
  generateSquareGridUnified2x2,
  generateSquareGridUnified2x3,
  generateSquareGridUnified3x3,
  generateSquareGridUnified3x4,
  generateSquareGridUnified4x4,
  generateCircleGridUnified2x2,
  generateCircleGridUnified2x3,
  generateCircleGridUnified3x3,
  generateCircleGridUnified3x4,
  generateCircleGridUnified4x4,
  generateHeartGridUnified2x2,
  generateHeartGridUnified2x3,
  generateHeartGridUnified3x3,
  generateHeartGridUnified3x4,
  generateHeartGridUnified4x4,
  generateHoneycombGridUnified2x2,
  generateHoneycombGridUnified2x3,
  generateHoneycombGridUnified3x3,
  generateHoneycombGridUnified3x4,
  generateHoneycombGridUnified4x4,
} from '../utils/shapes/grids'

// Grid group definitions
export const GRIDS_GROUPS: ShapeGroupDefinition[] = [
  { id: 'square', labelKey: 'Square' },
  { id: 'circle', labelKey: 'Circle' },
  { id: 'heart', labelKey: 'Heart' },
  { id: 'honeycomb', labelKey: 'Honeycomb' },
]

// Grid shape definitions - each grid is a single path with multiple subpaths
export const GRIDS_SHAPES: UnifiedGridShapeDefinition[] = [
  // Square Grids
  {
    id: 'square-grid-2x2',
    name: 'Square Grid 2x2',
    category: 'grids',
    group: 'square',
    icon: createUnifiedGridShapeIcon(generateSquareGridUnified2x2),
    generator: generateSquareGridUnified2x2,
    isUnifiedGrid: true,
  },
  {
    id: 'square-grid-2x3',
    name: 'Square Grid 2x3',
    category: 'grids',
    group: 'square',
    icon: createUnifiedGridShapeIcon(generateSquareGridUnified2x3),
    generator: generateSquareGridUnified2x3,
    isUnifiedGrid: true,
  },
  {
    id: 'square-grid-3x3',
    name: 'Square Grid 3x3',
    category: 'grids',
    group: 'square',
    icon: createUnifiedGridShapeIcon(generateSquareGridUnified3x3),
    generator: generateSquareGridUnified3x3,
    isUnifiedGrid: true,
  },
  {
    id: 'square-grid-3x4',
    name: 'Square Grid 3x4',
    category: 'grids',
    group: 'square',
    icon: createUnifiedGridShapeIcon(generateSquareGridUnified3x4),
    generator: generateSquareGridUnified3x4,
    isUnifiedGrid: true,
  },
  {
    id: 'square-grid-4x4',
    name: 'Square Grid 4x4',
    category: 'grids',
    group: 'square',
    icon: createUnifiedGridShapeIcon(generateSquareGridUnified4x4),
    generator: generateSquareGridUnified4x4,
    isUnifiedGrid: true,
  },

  // Circle Grids
  {
    id: 'circle-grid-2x2',
    name: 'Circle Grid 2x2',
    category: 'grids',
    group: 'circle',
    icon: createUnifiedGridShapeIcon(generateCircleGridUnified2x2),
    generator: generateCircleGridUnified2x2,
    isUnifiedGrid: true,
  },
  {
    id: 'circle-grid-2x3',
    name: 'Circle Grid 2x3',
    category: 'grids',
    group: 'circle',
    icon: createUnifiedGridShapeIcon(generateCircleGridUnified2x3),
    generator: generateCircleGridUnified2x3,
    isUnifiedGrid: true,
  },
  {
    id: 'circle-grid-3x3',
    name: 'Circle Grid 3x3',
    category: 'grids',
    group: 'circle',
    icon: createUnifiedGridShapeIcon(generateCircleGridUnified3x3),
    generator: generateCircleGridUnified3x3,
    isUnifiedGrid: true,
  },
  {
    id: 'circle-grid-3x4',
    name: 'Circle Grid 3x4',
    category: 'grids',
    group: 'circle',
    icon: createUnifiedGridShapeIcon(generateCircleGridUnified3x4),
    generator: generateCircleGridUnified3x4,
    isUnifiedGrid: true,
  },
  {
    id: 'circle-grid-4x4',
    name: 'Circle Grid 4x4',
    category: 'grids',
    group: 'circle',
    icon: createUnifiedGridShapeIcon(generateCircleGridUnified4x4),
    generator: generateCircleGridUnified4x4,
    isUnifiedGrid: true,
  },

  // Heart Grids
  {
    id: 'heart-grid-2x2',
    name: 'Heart Grid 2x2',
    category: 'grids',
    group: 'heart',
    icon: createUnifiedGridShapeIcon(generateHeartGridUnified2x2),
    generator: generateHeartGridUnified2x2,
    isUnifiedGrid: true,
  },
  {
    id: 'heart-grid-2x3',
    name: 'Heart Grid 2x3',
    category: 'grids',
    group: 'heart',
    icon: createUnifiedGridShapeIcon(generateHeartGridUnified2x3),
    generator: generateHeartGridUnified2x3,
    isUnifiedGrid: true,
  },
  {
    id: 'heart-grid-3x3',
    name: 'Heart Grid 3x3',
    category: 'grids',
    group: 'heart',
    icon: createUnifiedGridShapeIcon(generateHeartGridUnified3x3),
    generator: generateHeartGridUnified3x3,
    isUnifiedGrid: true,
  },
  {
    id: 'heart-grid-3x4',
    name: 'Heart Grid 3x4',
    category: 'grids',
    group: 'heart',
    icon: createUnifiedGridShapeIcon(generateHeartGridUnified3x4),
    generator: generateHeartGridUnified3x4,
    isUnifiedGrid: true,
  },
  {
    id: 'heart-grid-4x4',
    name: 'Heart Grid 4x4',
    category: 'grids',
    group: 'heart',
    icon: createUnifiedGridShapeIcon(generateHeartGridUnified4x4),
    generator: generateHeartGridUnified4x4,
    isUnifiedGrid: true,
  },

  // Honeycomb Grids
  {
    id: 'honeycomb-grid-2x2',
    name: 'Honeycomb Grid 2x2',
    category: 'grids',
    group: 'honeycomb',
    icon: createUnifiedGridShapeIcon(generateHoneycombGridUnified2x2),
    generator: generateHoneycombGridUnified2x2,
    isUnifiedGrid: true,
  },
  {
    id: 'honeycomb-grid-2x3',
    name: 'Honeycomb Grid 2x3',
    category: 'grids',
    group: 'honeycomb',
    icon: createUnifiedGridShapeIcon(generateHoneycombGridUnified2x3),
    generator: generateHoneycombGridUnified2x3,
    isUnifiedGrid: true,
  },
  {
    id: 'honeycomb-grid-3x3',
    name: 'Honeycomb Grid 3x3',
    category: 'grids',
    group: 'honeycomb',
    icon: createUnifiedGridShapeIcon(generateHoneycombGridUnified3x3),
    generator: generateHoneycombGridUnified3x3,
    isUnifiedGrid: true,
  },
  {
    id: 'honeycomb-grid-3x4',
    name: 'Honeycomb Grid 3x4',
    category: 'grids',
    group: 'honeycomb',
    icon: createUnifiedGridShapeIcon(generateHoneycombGridUnified3x4),
    generator: generateHoneycombGridUnified3x4,
    isUnifiedGrid: true,
  },
  {
    id: 'honeycomb-grid-4x4',
    name: 'Honeycomb Grid 4x4',
    category: 'grids',
    group: 'honeycomb',
    icon: createUnifiedGridShapeIcon(generateHoneycombGridUnified4x4),
    generator: generateHoneycombGridUnified4x4,
    isUnifiedGrid: true,
  },
]
