/**
 * Birthday Objects Constants
 * Icon components and shape definitions for birthday-related objects
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition } from './shapes'
import {
  generateBirthdayCake,
  generatePartyHat,
  generateBalloon,
  generateGiftBox,
  generateCandle,
  generateCupcake,
} from '../utils/shapes/objects'

// ============================================================================
// BIRTHDAY ICONS
// ============================================================================

const BirthdayCakeIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Cake base */}
    <rect x="4" y="13" width="16" height="7" rx="1" fill="#8D6E63" stroke="#5D4037" strokeWidth="0.5" />
    {/* Frosting layer */}
    <rect x="5" y="10" width="14" height="4" fill="#FFEBEE" stroke="#F8BBD9" strokeWidth="0.3" />
    {/* Frosting drips */}
    <path d="M5 10 Q7 8 9 10 Q11 8 13 10 Q15 8 17 10 Q18 8 19 10" fill="#FFEBEE" stroke="#F8BBD9" strokeWidth="0.3" />
    {/* Candle */}
    <rect x="11" y="5" width="2" height="5" fill="#FFEB3B" stroke="#FBC02D" strokeWidth="0.3" />
    {/* Flame */}
    <ellipse cx="12" cy="4" rx="1.5" ry="2" fill="#FF9800" stroke="#E65100" strokeWidth="0.2" />
  </svg>
)

const PartyHatIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Cone */}
    <polygon points="12,3 19,20 5,20" fill="#E91E63" stroke="#AD1457" strokeWidth="0.5" />
    {/* Stripe 1 */}
    <polygon points="10.5,8 13.5,8 15,13 9,13" fill="#FFC107" />
    {/* Stripe 2 */}
    <polygon points="8,15 16,15 17.5,19 6.5,19" fill="#FFC107" />
    {/* Pompom */}
    <circle cx="12" cy="3" r="2" fill="#FFEB3B" stroke="#FBC02D" strokeWidth="0.5" />
    {/* Elastic band hint */}
    <path d="M5 20 Q12 22 19 20" fill="none" stroke="#9E9E9E" strokeWidth="0.5" />
  </svg>
)

const BalloonIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Balloon body */}
    <ellipse cx="12" cy="9" rx="7" ry="8" fill="#F44336" stroke="#C62828" strokeWidth="0.5" />
    {/* Highlight */}
    <ellipse cx="9" cy="6" rx="2" ry="2.5" fill="#FFCDD2" opacity="0.7" />
    {/* Knot */}
    <polygon points="12,17 13.5,18.5 10.5,18.5" fill="#F44336" stroke="#C62828" strokeWidth="0.3" />
    {/* String */}
    <path d="M12 18.5 Q14 20 11 22" fill="none" stroke="#9E9E9E" strokeWidth="1" />
  </svg>
)

const GiftBoxIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Box body */}
    <rect x="4" y="10" width="16" height="10" fill="#9C27B0" stroke="#6A1B9A" strokeWidth="0.5" />
    {/* Box lid */}
    <rect x="3" y="7" width="18" height="3" fill="#9C27B0" stroke="#6A1B9A" strokeWidth="0.5" />
    {/* Vertical ribbon */}
    <rect x="10.5" y="7" width="3" height="13" fill="#FFC107" stroke="#FFA000" strokeWidth="0.3" />
    {/* Horizontal ribbon */}
    <rect x="4" y="12" width="16" height="3" fill="#FFC107" stroke="#FFA000" strokeWidth="0.3" />
    {/* Bow loops */}
    <ellipse cx="9" cy="5" rx="3" ry="2" fill="#FFEB3B" stroke="#FFA000" strokeWidth="0.3" />
    <ellipse cx="15" cy="5" rx="3" ry="2" fill="#FFEB3B" stroke="#FFA000" strokeWidth="0.3" />
    {/* Bow center */}
    <circle cx="12" cy="5.5" r="1.5" fill="#FFEB3B" stroke="#FFA000" strokeWidth="0.3" />
  </svg>
)

const CandleIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Candle body */}
    <rect x="9" y="10" width="6" height="11" rx="0.5" fill="#FFEB3B" stroke="#FBC02D" strokeWidth="0.5" />
    {/* Stripe */}
    <rect x="9" y="14" width="6" height="3" fill="#E91E63" stroke="#AD1457" strokeWidth="0.2" />
    {/* Wick */}
    <rect x="11.5" y="7" width="1" height="3" fill="#5D4037" />
    {/* Flame outer */}
    <ellipse cx="12" cy="5" rx="2.5" ry="3.5" fill="#FF9800" stroke="#E65100" strokeWidth="0.3" />
    {/* Flame inner */}
    <ellipse cx="12" cy="5.5" rx="1" ry="2" fill="#FFEB3B" />
  </svg>
)

const CupcakeIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Wrapper */}
    <path d="M7 12 L17 12 L19 21 L5 21 Z" fill="#E91E63" stroke="#AD1457" strokeWidth="0.5" />
    {/* Wrapper ridges */}
    <g stroke="#AD1457" strokeWidth="0.3">
      <line x1="8" y1="13" x2="7" y2="20" />
      <line x1="10" y1="13" x2="9" y2="20" />
      <line x1="12" y1="13" x2="12" y2="20" />
      <line x1="14" y1="13" x2="15" y2="20" />
      <line x1="16" y1="13" x2="17" y2="20" />
    </g>
    {/* Cake */}
    <rect x="7.5" y="10" width="9" height="2.5" fill="#FFCC80" stroke="#FF9800" strokeWidth="0.3" />
    {/* Frosting */}
    <path d="M7 10 Q9 7 12 9 Q15 7 17 10" fill="#F8BBD9" stroke="#F48FB1" strokeWidth="0.3" />
    {/* Frosting peak */}
    <path d="M9.5 8 Q12 3 14.5 8" fill="#F8BBD9" stroke="#F48FB1" strokeWidth="0.3" />
    {/* Cherry */}
    <circle cx="12" cy="4" r="2" fill="#F44336" stroke="#C62828" strokeWidth="0.3" />
  </svg>
)

// ============================================================================
// BIRTHDAY SHAPE DEFINITIONS
// ============================================================================

export const BIRTHDAY_SHAPES: CompositeShapeDefinition[] = [
  {
    id: 'birthday-cake',
    name: 'Birthday Cake',
    category: 'occasions',
    group: 'birthday',
    icon: BirthdayCakeIcon,
    generator: generateBirthdayCake,
    isComposite: true,
  },
  {
    id: 'birthday-party-hat',
    name: 'Party Hat',
    category: 'occasions',
    group: 'birthday',
    icon: PartyHatIcon,
    generator: generatePartyHat,
    isComposite: true,
  },
  {
    id: 'birthday-balloon',
    name: 'Balloon',
    category: 'occasions',
    group: 'birthday',
    icon: BalloonIcon,
    generator: generateBalloon,
    isComposite: true,
  },
  {
    id: 'birthday-gift',
    name: 'Gift Box',
    category: 'occasions',
    group: 'birthday',
    icon: GiftBoxIcon,
    generator: generateGiftBox,
    isComposite: true,
  },
  {
    id: 'birthday-candle',
    name: 'Candle',
    category: 'occasions',
    group: 'birthday',
    icon: CandleIcon,
    generator: generateCandle,
    isComposite: true,
  },
  {
    id: 'birthday-cupcake',
    name: 'Cupcake',
    category: 'occasions',
    group: 'birthday',
    icon: CupcakeIcon,
    generator: generateCupcake,
    isComposite: true,
  },
]
