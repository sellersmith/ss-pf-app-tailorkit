/**
 * Nature Shapes Constants
 * Icon components and shape definitions for leaves and flowers
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition } from './shapes'
import {
  generateLeafOak,
  generateLeafMaple,
  generateLeafTropical,
  generateLeafSimple,
  generateLeafFern,
  generateFlowerRose,
  generateFlowerDaisy,
  generateFlowerTulip,
  generateFlowerSunflower,
  generateFlowerCherryBlossom,
  generateFlowerLotus,
} from '../utils/shapes/nature'

// ============================================================================
// LEAF ICONS - Using LEAF_COLORS from types.ts
// Green: fill=#4CAF50, stroke=#2E7D32, vein=#388E3C
// ============================================================================

const LeafOakIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path
      d="M12 2c-1 2-2 3-4 4s-3 3-3 5c0 1 0.5 2 1 3s1.5 2 2 3l1 3h2v-6h2v6h2l1-3c0.5-1 1.5-2 2-3s1-2 1-3c0-2-1-4-3-5s-3-2-4-4z"
      fill="#4CAF50"
      stroke="#2E7D32"
      strokeWidth="0.5"
    />
    <line x1="12" y1="6" x2="12" y2="18" stroke="#388E3C" strokeWidth="1" />
  </svg>
)

const LeafMapleIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path
      d="M12 2l-2 4-4-1 2 4-3 2 4 1-1 4 4-2 4 2-1-4 4-1-3-2 2-4-4 1-2-4z"
      fill="#4CAF50"
      stroke="#2E7D32"
      strokeWidth="0.5"
    />
    <rect x="11" y="14" width="2" height="8" fill="#795548" stroke="#5D4037" strokeWidth="0.3" />
  </svg>
)

const LeafTropicalIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path
      d="M12 2c-2 3-5 5-7 8 0 2 1 4 2 5l-2 2 3 1 1 4h2l1-4 3-1-2-2c1-1 2-3 2-5-2-3-5-5-7-8h4z"
      fill="#00BFA5"
      stroke="#00897B"
      strokeWidth="0.5"
    />
    <line x1="12" y1="6" x2="12" y2="20" stroke="#009688" strokeWidth="1.5" />
  </svg>
)

const LeafSimpleIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <ellipse cx="12" cy="10" rx="6" ry="8" fill="#4CAF50" stroke="#2E7D32" strokeWidth="0.5" />
    <line x1="12" y1="4" x2="12" y2="16" stroke="#388E3C" strokeWidth="1" />
    <rect x="11" y="16" width="2" height="6" fill="#795548" stroke="#5D4037" strokeWidth="0.3" />
  </svg>
)

const LeafFernIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path
      d="M12 2v20M8 6l4 2M16 6l-4 2M7 10l5 2M17 10l-5 2M8 14l4 2M16 14l-4 2M9 18l3 1M15 18l-3 1"
      stroke="#4CAF50"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
)

// ============================================================================
// FLOWER ICONS - Using FLOWER_COLORS from types.ts
// Red: petal=#F44336, petalStroke=#C62828, center=#FFEB3B
// ============================================================================

const FlowerRoseIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    {/* Outer petals */}
    <circle cx="12" cy="10" r="6" fill="#F44336" stroke="#C62828" strokeWidth="0.5" />
    {/* Inner spiral petals */}
    <path d="M12 6c-2 1-3 2-3 4s1 3 3 3 3-1 3-3-1-3-3-4z" fill="#C62828" stroke="none" />
    {/* Center highlight */}
    <circle cx="12" cy="10" r="2" fill="#C62828" stroke="#B71C1C" strokeWidth="0.3" />
    {/* Stem */}
    <rect x="11" y="15" width="2" height="7" fill="#4CAF50" stroke="#2E7D32" strokeWidth="0.3" />
  </svg>
)

const FlowerDaisyIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <g fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="0.5">
      <ellipse cx="12" cy="5" rx="2" ry="4" />
      <ellipse cx="12" cy="15" rx="2" ry="4" />
      <ellipse cx="7" cy="10" rx="4" ry="2" />
      <ellipse cx="17" cy="10" rx="4" ry="2" />
      <ellipse cx="8" cy="6" rx="2" ry="3" transform="rotate(-45 8 6)" />
      <ellipse cx="16" cy="6" rx="2" ry="3" transform="rotate(45 16 6)" />
      <ellipse cx="8" cy="14" rx="2" ry="3" transform="rotate(45 8 14)" />
      <ellipse cx="16" cy="14" rx="2" ry="3" transform="rotate(-45 16 14)" />
    </g>
    <circle cx="12" cy="10" r="3" fill="#FFEB3B" stroke="#F9A825" strokeWidth="0.5" />
    <rect x="11" y="18" width="2" height="4" fill="#4CAF50" stroke="#2E7D32" strokeWidth="0.3" />
  </svg>
)

const FlowerTulipIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path
      d="M9 3c0 3-1 6-1 8 0 2 2 4 4 4s4-2 4-4c0-2-1-5-1-8-1 1-2 2-3 2s-2-1-3-2z"
      fill="#E91E63"
      stroke="#AD1457"
      strokeWidth="0.5"
    />
    <rect x="11" y="14" width="2" height="8" fill="#4CAF50" stroke="#2E7D32" strokeWidth="0.3" />
    <path d="M13 16c2-1 4 0 5 2" stroke="#4CAF50" strokeWidth="2" fill="none" />
  </svg>
)

const FlowerSunflowerIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <g fill="#FFEB3B" stroke="#F9A825" strokeWidth="0.3">
      <ellipse cx="12" cy="4" rx="2" ry="3" />
      <ellipse cx="12" cy="16" rx="2" ry="3" />
      <ellipse cx="6" cy="10" rx="3" ry="2" />
      <ellipse cx="18" cy="10" rx="3" ry="2" />
      <ellipse cx="7" cy="5" rx="2" ry="2.5" transform="rotate(-45 7 5)" />
      <ellipse cx="17" cy="5" rx="2" ry="2.5" transform="rotate(45 17 5)" />
      <ellipse cx="7" cy="15" rx="2" ry="2.5" transform="rotate(45 7 15)" />
      <ellipse cx="17" cy="15" rx="2" ry="2.5" transform="rotate(-45 17 15)" />
    </g>
    <circle cx="12" cy="10" r="4" fill="#795548" stroke="#5D4037" strokeWidth="0.5" />
    <rect x="11" y="18" width="2" height="4" fill="#4CAF50" stroke="#2E7D32" strokeWidth="0.3" />
  </svg>
)

const FlowerCherryBlossomIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    {/* 5 petals with notched tips - matching the generator output */}
    <g fill="#FFCDD2" stroke="#F48FB1" strokeWidth="0.5">
      {/* Top petal with notch */}
      <path d="M12 12 C10 10 9.5 5 10.5 4 L12 5 L13.5 4 C14.5 5 14 10 12 12 Z" />
      {/* Upper right petal with notch */}
      <path d="M12 12 C14 10 18 8 19 9.5 L17.5 11 L19 12.5 C18 14 14 13 12 12 Z" />
      {/* Lower right petal with notch */}
      <path d="M12 12 C14 14 16 18 15 19.5 L13 18.5 L12.5 20.5 C11 20 11 15 12 12 Z" />
      {/* Lower left petal with notch */}
      <path d="M12 12 C10 14 8 18 9 19.5 L11 18.5 L11.5 20.5 C13 20 13 15 12 12 Z" />
      {/* Upper left petal with notch */}
      <path d="M12 12 C10 10 6 8 5 9.5 L6.5 11 L5 12.5 C6 14 10 13 12 12 Z" />
    </g>
    {/* Yellow center */}
    <circle cx="12" cy="12" r="2" fill="#FFEB3B" stroke="#F9A825" strokeWidth="0.5" />
    {/* Stamens radiating from center with small circles at tips */}
    <g stroke="#F48FB1" strokeWidth="0.5" fill="none">
      <line x1="12" y1="10" x2="12" y2="8" />
      <line x1="13.7" y1="10.8" x2="15" y2="9.5" />
      <line x1="13.7" y1="13.2" x2="15" y2="14.5" />
      <line x1="12" y1="14" x2="12" y2="16" />
      <line x1="10.3" y1="13.2" x2="9" y2="14.5" />
      <line x1="10.3" y1="10.8" x2="9" y2="9.5" />
    </g>
    {/* Small circles at stamen tips */}
    <g fill="none" stroke="#F48FB1" strokeWidth="0.5">
      <circle cx="12" cy="7.5" r="1" />
      <circle cx="15.3" cy="9.2" r="1" />
      <circle cx="15.3" cy="14.8" r="1" />
      <circle cx="12" cy="16.5" r="1" />
      <circle cx="8.7" cy="14.8" r="1" />
      <circle cx="8.7" cy="9.2" r="1" />
    </g>
  </svg>
)

const FlowerLotusIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <g fill="#F8BBD9" stroke="#F06292" strokeWidth="0.5">
      <path d="M12 4c1 3 1 6 0 8-1-2-1-5 0-8z" />
      <path d="M8 5c2 2 3 5 2 7-2-1-3-4-2-7z" />
      <path d="M16 5c-2 2-3 5-2 7 2-1 3-4 2-7z" />
      <path d="M5 8c3 1 5 3 5 5-2 0-4-2-5-5z" />
      <path d="M19 8c-3 1-5 3-5 5 2 0 4-2 5-5z" />
    </g>
    <circle cx="12" cy="13" r="2" fill="#FFEB3B" stroke="#FFC107" strokeWidth="0.3" />
  </svg>
)

// ============================================================================
// NATURE SHAPE DEFINITIONS
// ============================================================================

export const NATURE_SHAPES: CompositeShapeDefinition[] = [
  // Leaves
  {
    id: 'leaf-oak',
    name: 'Oak Leaf',
    category: 'nature',
    group: 'leaves',
    icon: LeafOakIcon,
    generator: generateLeafOak,
    isComposite: true,
  },
  {
    id: 'leaf-maple',
    name: 'Maple Leaf',
    category: 'nature',
    group: 'leaves',
    icon: LeafMapleIcon,
    generator: generateLeafMaple,
    isComposite: true,
  },
  {
    id: 'leaf-tropical',
    name: 'Tropical Leaf',
    category: 'nature',
    group: 'leaves',
    icon: LeafTropicalIcon,
    generator: generateLeafTropical,
    isComposite: true,
  },
  {
    id: 'leaf-simple',
    name: 'Simple Leaf',
    category: 'nature',
    group: 'leaves',
    icon: LeafSimpleIcon,
    generator: generateLeafSimple,
    isComposite: true,
  },
  {
    id: 'leaf-fern',
    name: 'Fern',
    category: 'nature',
    group: 'leaves',
    icon: LeafFernIcon,
    generator: generateLeafFern,
    isComposite: true,
  },
  // Flowers
  {
    id: 'flower-rose',
    name: 'Rose',
    category: 'nature',
    group: 'flowers',
    icon: FlowerRoseIcon,
    generator: generateFlowerRose,
    isComposite: true,
  },
  {
    id: 'flower-daisy',
    name: 'Daisy',
    category: 'nature',
    group: 'flowers',
    icon: FlowerDaisyIcon,
    generator: generateFlowerDaisy,
    isComposite: true,
  },
  {
    id: 'flower-tulip',
    name: 'Tulip',
    category: 'nature',
    group: 'flowers',
    icon: FlowerTulipIcon,
    generator: generateFlowerTulip,
    isComposite: true,
  },
  {
    id: 'flower-sunflower',
    name: 'Sunflower',
    category: 'nature',
    group: 'flowers',
    icon: FlowerSunflowerIcon,
    generator: generateFlowerSunflower,
    isComposite: true,
  },
  {
    id: 'flower-cherry-blossom',
    name: 'Cherry Blossom',
    category: 'nature',
    group: 'flowers',
    icon: FlowerCherryBlossomIcon,
    generator: generateFlowerCherryBlossom,
    isComposite: true,
  },
  {
    id: 'flower-lotus',
    name: 'Lotus',
    category: 'nature',
    group: 'flowers',
    icon: FlowerLotusIcon,
    generator: generateFlowerLotus,
    isComposite: true,
  },
]
