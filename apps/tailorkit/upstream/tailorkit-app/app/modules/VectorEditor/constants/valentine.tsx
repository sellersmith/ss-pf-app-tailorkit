/**
 * Valentine Objects Constants
 * Icon components and shape definitions for Valentine's Day-related objects
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition } from './shapes'
import {
  generateDecorativeHeart,
  generateCupidArrow,
  generateLoveLetter,
  generateRose,
  generateRing,
  generateChocolateBox,
} from '../utils/shapes/objects'

// ============================================================================
// VALENTINE ICONS
// ============================================================================

const DecorativeHeartIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Heart body */}
    <path
      d="M12 21 C8 17 3 13 3 8.5 C3 5 6 3 8.5 3 C10 3 11.5 4 12 5.5 C12.5 4 14 3 15.5 3 C18 3 21 5 21 8.5 C21 13 16 17 12 21"
      fill="#E91E63"
      stroke="#AD1457"
      strokeWidth="0.5"
    />
    {/* Highlight */}
    <circle cx="8" cy="7" r="2" fill="#F8BBD9" opacity="0.7" />
  </svg>
)

const CupidArrowIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Shaft */}
    <rect x="4" y="11" width="12" height="2" fill="#8D6E63" stroke="#5D4037" strokeWidth="0.3" />
    {/* Arrow head (heart rotated -90° so tip points right, centered on shaft) */}
    <g transform="translate(18, 12) rotate(-90) scale(0.8)">
      <path
        d={
          'M-2.5 2.5 C-4 1 -4 -1 -2.5 -2 C-2 -2.3 -1.3 -2.3 -0.7 -1.8 '
          + 'C-0.3 -1.5 0 -1 0 -0.3 C0 -1 0.3 -1.5 0.7 -1.8 C1.3 -2.3 2 -2.3 2.5 -2 '
          + 'C4 -1 4 1 2.5 2.5 L0 5 L-2.5 2.5 Z'
        }
        fill="#9E9E9E"
        stroke="#616161"
        strokeWidth="0.4"
      />
    </g>
    {/* Feathers */}
    <path d="M4 12 Q2 10 3 8" fill="none" stroke="#F44336" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 12 Q2 14 3 16" fill="none" stroke="#F44336" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const LoveLetterIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Envelope body */}
    <rect x="3" y="6" width="18" height="13" rx="1" fill="#FFECB3" stroke="#FFB300" strokeWidth="0.5" />
    {/* Flap */}
    <path d="M3 6 L12 14 L21 6" fill="#FFF8E1" stroke="#FFB300" strokeWidth="0.5" />
    {/* Heart seal */}
    <path
      d="M12 11.5 C11 10.5 10 10 10.5 9.5 C11 9 12 9.5 12 10 C12 9.5 13 9 13.5 9.5 C14 10 13 10.5 12 11.5"
      fill="#E91E63"
      stroke="#AD1457"
      strokeWidth="0.3"
    />
  </svg>
)

const RoseIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Stem */}
    <rect x="11" y="14" width="2" height="7" fill="#4CAF50" stroke="#2E7D32" strokeWidth="0.3" />
    {/* Leaf */}
    <ellipse
      cx="15"
      cy="17"
      rx="3"
      ry="1.5"
      fill="#81C784"
      stroke="#4CAF50"
      strokeWidth="0.3"
      transform="rotate(-30 15 17)"
    />
    {/* Outer petals */}
    <path
      d="M12 14 C8 12 6 8 8 5 C9 3 12 3 12 5 C12 3 15 3 16 5 C18 8 16 12 12 14"
      fill="#E91E63"
      stroke="#AD1457"
      strokeWidth="0.5"
    />
    {/* Inner petals */}
    <path
      d="M12 10 C10 9 10 7 11 6 C11.5 5 12 6 12 7 C12 6 12.5 5 13 6 C14 7 14 9 12 10"
      fill="#C2185B"
      stroke="#AD1457"
      strokeWidth="0.3"
    />
  </svg>
)

const RingIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Band outer */}
    <ellipse cx="12" cy="14" rx="7" ry="5" fill="#FFD54F" stroke="#FF8F00" strokeWidth="0.5" />
    {/* Band inner (hole) */}
    <ellipse cx="12" cy="14" rx="4.5" ry="3" fill="white" stroke="#FF8F00" strokeWidth="0.3" />
    {/* Gem */}
    <polygon points="12,4 15,8 15,10 12,13 9,10 9,8" fill="#E91E63" stroke="#AD1457" strokeWidth="0.3" />
    {/* Facet */}
    <polygon points="12,4 13.5,8 12,11 10.5,8" fill="#FFECB3" opacity="0.7" />
  </svg>
)

const ChocolateBoxIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Box body */}
    <rect x="3" y="10" width="18" height="10" fill="#8D6E63" stroke="#5D4037" strokeWidth="0.5" />
    {/* Chocolates */}
    <circle cx="7" cy="15" r="2" fill="#4E342E" stroke="#3E2723" strokeWidth="0.3" />
    <circle cx="12" cy="15" r="2" fill="#4E342E" stroke="#3E2723" strokeWidth="0.3" />
    <circle cx="17" cy="15" r="2" fill="#4E342E" stroke="#3E2723" strokeWidth="0.3" />
    {/* Lid */}
    <rect x="2" y="6" width="20" height="4" fill="#6D4C41" stroke="#5D4037" strokeWidth="0.5" />
    {/* Heart on lid */}
    <path
      d="M12 9.5 C11 8.5 10 8 10.5 7.5 C11 7 12 7.5 12 8 C12 7.5 13 7 13.5 7.5 C14 8 13 8.5 12 9.5"
      fill="#E91E63"
      stroke="#AD1457"
      strokeWidth="0.3"
    />
  </svg>
)

// ============================================================================
// VALENTINE SHAPE DEFINITIONS
// ============================================================================

export const VALENTINE_SHAPES: CompositeShapeDefinition[] = [
  {
    id: 'valentine-heart',
    name: 'Decorative Heart',
    category: 'occasions',
    group: 'valentine',
    icon: DecorativeHeartIcon,
    generator: generateDecorativeHeart,
    isComposite: true,
  },
  {
    id: 'valentine-cupid-arrow',
    name: 'Cupid Arrow',
    category: 'occasions',
    group: 'valentine',
    icon: CupidArrowIcon,
    generator: generateCupidArrow,
    isComposite: true,
  },
  {
    id: 'valentine-love-letter',
    name: 'Love Letter',
    category: 'occasions',
    group: 'valentine',
    icon: LoveLetterIcon,
    generator: generateLoveLetter,
    isComposite: true,
  },
  {
    id: 'valentine-rose',
    name: 'Rose',
    category: 'occasions',
    group: 'valentine',
    icon: RoseIcon,
    generator: generateRose,
    isComposite: true,
  },
  {
    id: 'valentine-ring',
    name: 'Engagement Ring',
    category: 'occasions',
    group: 'valentine',
    icon: RingIcon,
    generator: generateRing,
    isComposite: true,
  },
  {
    id: 'valentine-chocolate-box',
    name: 'Chocolate Box',
    category: 'occasions',
    group: 'valentine',
    icon: ChocolateBoxIcon,
    generator: generateChocolateBox,
    isComposite: true,
  },
]
