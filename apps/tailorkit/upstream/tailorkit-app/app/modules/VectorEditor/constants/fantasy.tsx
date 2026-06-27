/**
 * Fantasy Shapes Constants
 * Contains icons and shape definitions for fantasy-themed shapes (wings and halos)
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition, ShapeGroupDefinition } from './shapes'

// Import fantasy shape generators (wings and halos only)
import {
  generateAngelWingLeftCartoon,
  generateAngelWingRightCartoon,
  generateAngelWingPairCartoon,
  generateHaloCartoon,
  generateDivineHaloCartoon,
} from '../utils/shapes/fantasy'

// =============================================================================
// Fantasy Shape Icons
// Wing colors: primary=#FFFFFF, secondary=#F5F5DC
// Halo colors: primary=#FFD700 (gold), glow=#FFF8DC
// =============================================================================

// Wing Icons - White with soft beige outline
const WingLeftIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#E8E8E8" strokeWidth="1.5">
    <path d="M18 12C18 12 14 8 10 8C6 8 4 10 4 12C4 14 6 18 12 20C12 20 14 16 14 14C14 12 16 12 18 12Z" />
    <path d="M10 10C10 10 8 12 8 14" stroke="#F5F5DC" strokeLinecap="round" fill="none" />
  </svg>
)

const WingRightIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#E8E8E8" strokeWidth="1.5">
    <path d="M6 12C6 12 10 8 14 8C18 8 20 10 20 12C20 14 18 18 12 20C12 20 10 16 10 14C10 12 8 12 6 12Z" />
    <path d="M14 10C14 10 16 12 16 14" stroke="#F5F5DC" strokeLinecap="round" fill="none" />
  </svg>
)

const WingPairIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#E8E8E8" strokeWidth="1.5">
    <path d="M12 16C12 16 8 14 6 12C4 10 4 8 6 7C8 6 10 7 12 9" />
    <path d="M12 16C12 16 16 14 18 12C20 10 20 8 18 7C16 6 14 7 12 9" />
    <path d="M12 16V20" stroke="#E8E8E8" strokeLinecap="round" fill="none" />
  </svg>
)

// Halo Icons - Gold color (#FFD700)
const HaloIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <ellipse cx="12" cy="8" rx="8" ry="3" fill="#FFF8DC" stroke="#FFD700" strokeWidth="1.5" />
    <ellipse cx="12" cy="8" rx="5" ry="2" fill="none" stroke="#DAA520" strokeWidth="1" strokeDasharray="2 2" />
  </svg>
)

const DivineHaloIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <ellipse cx="12" cy="10" rx="7" ry="2.5" fill="#FFF8DC" stroke="#FFD700" strokeWidth="1.5" />
    {/* Light rays */}
    <line x1="12" y1="2" x2="12" y2="5" stroke="#FFD700" strokeWidth="1.5" />
    <line x1="6" y1="4" x2="8" y2="6" stroke="#FFD700" strokeWidth="1.5" />
    <line x1="18" y1="4" x2="16" y2="6" stroke="#FFD700" strokeWidth="1.5" />
    <line x1="4" y1="10" x2="2" y2="10" stroke="#FFD700" strokeWidth="1.5" />
    <line x1="22" y1="10" x2="20" y2="10" stroke="#FFD700" strokeWidth="1.5" />
  </svg>
)

// =============================================================================
// Fantasy Shape Group Definitions
// =============================================================================

export const FANTASY_GROUPS: ShapeGroupDefinition[] = [
  { id: 'wings', labelKey: 'Angel Wings' },
  { id: 'halos', labelKey: 'Halos & Nimbus' },
]

// =============================================================================
// Fantasy Shape Definitions
// =============================================================================

export const FANTASY_SHAPES: CompositeShapeDefinition[] = [
  // Wings
  {
    id: 'angel-wing-left',
    name: 'Left Wing',
    category: 'fantasy',
    group: 'wings',
    icon: WingLeftIcon,
    generator: generateAngelWingLeftCartoon,
    isComposite: true,
  },
  {
    id: 'angel-wing-right',
    name: 'Right Wing',
    category: 'fantasy',
    group: 'wings',
    icon: WingRightIcon,
    generator: generateAngelWingRightCartoon,
    isComposite: true,
  },
  {
    id: 'angel-wing-pair',
    name: 'Wing Pair',
    category: 'fantasy',
    group: 'wings',
    icon: WingPairIcon,
    generator: generateAngelWingPairCartoon,
    isComposite: true,
  },

  // Halos
  {
    id: 'halo',
    name: 'Halo',
    category: 'fantasy',
    group: 'halos',
    icon: HaloIcon,
    generator: generateHaloCartoon,
    isComposite: true,
  },
  {
    id: 'divine-halo',
    name: 'Divine Halo',
    category: 'fantasy',
    group: 'halos',
    icon: DivineHaloIcon,
    generator: generateDivineHaloCartoon,
    isComposite: true,
  },
]
