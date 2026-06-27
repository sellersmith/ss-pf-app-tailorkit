/**
 * Zodiac Signs Constants
 * Contains icons and shape definitions for Western zodiac signs
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition } from './shapes'

// Import zodiac sign generators
import { zodiacSignGenerators } from '../utils/shapes/zodiacSigns'

// =============================================================================
// Zodiac Sign Icons (simplified astrological symbols)
// Colors based on element: Fire=#FF4500, Earth=#8B4513, Air=#87CEEB, Water=#4169E1
// =============================================================================

// Fire Signs - Orange-Red (#FF4500)
const AriesIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4500" strokeWidth="1.5">
    <path d="M8 18V10C8 6 10 4 12 4C14 4 16 6 16 10V18" />
    <path d="M8 10C6 8 4 8 4 10" />
    <path d="M16 10C18 8 20 8 20 10" />
  </svg>
)

const LeoIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4500" strokeWidth="1.5">
    <circle cx="8" cy="8" r="4" />
    <path d="M12 8C12 12 14 14 18 14C20 14 20 18 18 18" />
  </svg>
)

const SagittariusIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4500" strokeWidth="1.5">
    <line x1="4" y1="20" x2="20" y2="4" />
    <polyline points="14,4 20,4 20,10" />
    <line x1="8" y1="12" x2="16" y2="20" />
  </svg>
)

// Earth Signs - Brown (#8B4513)
const TaurusIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B4513" strokeWidth="1.5">
    <circle cx="12" cy="14" r="6" />
    <path d="M6 6C6 4 8 2 10 4" />
    <path d="M18 6C18 4 16 2 14 4" />
  </svg>
)

const VirgoIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B4513" strokeWidth="1.5">
    <path d="M6 4V16" />
    <path d="M6 8C8 6 10 6 10 10V16" />
    <path d="M10 8C12 6 14 6 14 10V14C14 16 16 18 18 16" />
  </svg>
)

const CapricornIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B4513" strokeWidth="1.5">
    <path d="M6 4L10 16" />
    <path d="M10 4L14 16C14 18 16 20 18 18C20 16 18 14 16 14" />
  </svg>
)

// Air Signs - Sky Blue (#87CEEB)
const GeminiIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#87CEEB" strokeWidth="1.5">
    <line x1="6" y1="4" x2="18" y2="4" />
    <line x1="6" y1="20" x2="18" y2="20" />
    <line x1="8" y1="4" x2="8" y2="20" />
    <line x1="16" y1="4" x2="16" y2="20" />
  </svg>
)

const LibraIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#87CEEB" strokeWidth="1.5">
    <line x1="4" y1="12" x2="20" y2="12" />
    <path d="M4 16C4 20 8 20 12 20C16 20 20 20 20 16" />
    <line x1="4" y1="16" x2="20" y2="16" />
  </svg>
)

const AquariusIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#87CEEB" strokeWidth="1.5">
    <path d="M4 10C6 8 8 12 10 10C12 8 14 12 16 10C18 8 20 12 20 10" />
    <path d="M4 16C6 14 8 18 10 16C12 14 14 18 16 16C18 14 20 18 20 16" />
  </svg>
)

// Water Signs - Royal Blue (#4169E1)
const CancerIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4169E1" strokeWidth="1.5">
    <path d="M8 10C4 10 4 6 8 6C12 6 16 6 16 10" />
    <path d="M16 14C20 14 20 18 16 18C12 18 8 18 8 14" />
  </svg>
)

const ScorpioIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4169E1" strokeWidth="1.5">
    <path d="M6 4V16" />
    <path d="M6 8C8 6 10 6 10 10V16" />
    <path d="M10 8C12 6 14 6 14 10V16L18 12" />
    <path d="M16 10L18 12L16 14" />
  </svg>
)

const PiscesIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4169E1" strokeWidth="1.5">
    <path d="M6 4C2 8 2 16 6 20" />
    <path d="M18 4C22 8 22 16 18 20" />
    <line x1="4" y1="12" x2="20" y2="12" />
  </svg>
)

// =============================================================================
// Note: Zodiac signs are now part of the unified 'zodiac' category
// with group 'zodiac-signs'. The element-based grouping has been removed.
// =============================================================================

// =============================================================================
// Helper Functions for Icons
// =============================================================================

function getZodiacSignIcon(sign: string): FC {
  const iconMap: Record<string, FC> = {
    aries: AriesIcon,
    taurus: TaurusIcon,
    gemini: GeminiIcon,
    cancer: CancerIcon,
    leo: LeoIcon,
    virgo: VirgoIcon,
    libra: LibraIcon,
    scorpio: ScorpioIcon,
    sagittarius: SagittariusIcon,
    capricorn: CapricornIcon,
    aquarius: AquariusIcon,
    pisces: PiscesIcon,
  }
  return iconMap[sign] || AriesIcon
}

// =============================================================================
// Zodiac Signs Shape Definitions
// Now part of unified 'zodiac' category with group 'zodiac-signs'
// =============================================================================

export const ZODIAC_SIGNS_SHAPES: CompositeShapeDefinition[] = [
  // Zodiac Signs - all 12 signs in a flat list under 'zodiac-signs' group
  ...Object.entries(zodiacSignGenerators).map(([sign, generators]) => ({
    id: `zodiac-${sign}`,
    name: `${sign.charAt(0).toUpperCase() + sign.slice(1)}`,
    category: 'zodiac' as const,
    group: 'zodiac-signs',
    icon: getZodiacSignIcon(sign),
    generator: generators.cartoon,
    isComposite: true as const,
    style: 'cartoon' as const,
  })),
]
