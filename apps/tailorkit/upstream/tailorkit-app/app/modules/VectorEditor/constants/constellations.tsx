/**
 * Constellations Constants
 * Contains icons and shape definitions for constellation star patterns
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition } from './shapes'

// Import constellation generators
import { constellationGenerators } from '../utils/shapes/constellations'

// =============================================================================
// Constellation Icons
// Based on actual star positions from constellation generators
// =============================================================================

// Aries - simple curved line of 4 stars
const AriesConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="5" cy="14" r="1.5" fill="currentColor" />
    <circle cx="10" cy="12" r="1.5" fill="currentColor" />
    <circle cx="14" cy="11" r="1" fill="currentColor" />
    <circle cx="18" cy="13" r="1" fill="currentColor" />
    <line x1="5" y1="14" x2="10" y2="12" opacity="0.5" />
    <line x1="10" y1="12" x2="14" y2="11" opacity="0.5" />
    <line x1="14" y1="11" x2="18" y2="13" opacity="0.5" />
  </svg>
)

// Taurus - V-shape bull's face with horns
const TaurusConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="17" cy="8" r="1.5" fill="currentColor" />
    <circle cx="14" cy="11" r="1" fill="currentColor" />
    <circle cx="10" cy="13" r="1" fill="currentColor" />
    <circle cx="6" cy="16" r="1" fill="currentColor" />
    <circle cx="16" cy="15" r="1" fill="currentColor" />
    <circle cx="19" cy="18" r="1" fill="currentColor" />
    <circle cx="4" cy="6" r="1.5" fill="currentColor" />
    <line x1="17" y1="8" x2="14" y2="11" opacity="0.5" />
    <line x1="14" y1="11" x2="10" y2="13" opacity="0.5" />
    <line x1="10" y1="13" x2="6" y2="16" opacity="0.5" />
    <line x1="14" y1="11" x2="16" y2="15" opacity="0.5" />
    <line x1="16" y1="15" x2="19" y2="18" opacity="0.5" />
    <line x1="10" y1="13" x2="4" y2="6" opacity="0.5" />
  </svg>
)

// Gemini - two parallel figures (twins)
const GeminiConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="8" cy="5" r="1.5" fill="currentColor" />
    <circle cx="15" cy="6" r="1.5" fill="currentColor" />
    <circle cx="7" cy="10" r="1" fill="currentColor" />
    <circle cx="14" cy="11" r="1" fill="currentColor" />
    <circle cx="6" cy="14" r="1" fill="currentColor" />
    <circle cx="13" cy="15" r="1" fill="currentColor" />
    <circle cx="5" cy="19" r="1" fill="currentColor" />
    <circle cx="12" cy="20" r="1" fill="currentColor" />
    <line x1="8" y1="5" x2="7" y2="10" opacity="0.5" />
    <line x1="7" y1="10" x2="6" y2="14" opacity="0.5" />
    <line x1="6" y1="14" x2="5" y2="19" opacity="0.5" />
    <line x1="15" y1="6" x2="14" y2="11" opacity="0.5" />
    <line x1="14" y1="11" x2="13" y2="15" opacity="0.5" />
    <line x1="13" y1="15" x2="12" y2="20" opacity="0.5" />
    <line x1="8" y1="5" x2="15" y2="6" opacity="0.5" />
    <line x1="6" y1="14" x2="13" y2="15" opacity="0.5" />
  </svg>
)

// Cancer - inverted Y shape
const CancerConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="12" cy="7" r="1.5" fill="currentColor" />
    <circle cx="8" cy="12" r="1" fill="currentColor" />
    <circle cx="16" cy="13" r="1" fill="currentColor" />
    <circle cx="6" cy="18" r="1" fill="currentColor" />
    <circle cx="15" cy="17" r="1" fill="currentColor" />
    <circle cx="12" cy="13" r="1" fill="currentColor" />
    <line x1="12" y1="7" x2="12" y2="13" opacity="0.5" />
    <line x1="12" y1="13" x2="8" y2="12" opacity="0.5" />
    <line x1="12" y1="13" x2="16" y2="13" opacity="0.5" />
    <line x1="8" y1="12" x2="6" y2="18" opacity="0.5" />
    <line x1="16" y1="13" x2="15" y2="17" opacity="0.5" />
  </svg>
)

// Leo - sickle (head) and triangle (body)
const LeoConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="5" cy="8" r="1.5" fill="currentColor" />
    <circle cx="7" cy="4" r="1" fill="currentColor" />
    <circle cx="11" cy="5" r="1" fill="currentColor" />
    <circle cx="14" cy="8" r="1" fill="currentColor" />
    <circle cx="15" cy="11" r="1" fill="currentColor" />
    <circle cx="19" cy="14" r="1.5" fill="currentColor" />
    <circle cx="15" cy="16" r="1" fill="currentColor" />
    <circle cx="11" cy="15" r="1" fill="currentColor" />
    <line x1="5" y1="8" x2="7" y2="4" opacity="0.5" />
    <line x1="7" y1="4" x2="11" y2="5" opacity="0.5" />
    <line x1="11" y1="5" x2="14" y2="8" opacity="0.5" />
    <line x1="14" y1="8" x2="15" y2="11" opacity="0.5" />
    <line x1="15" y1="11" x2="5" y2="8" opacity="0.5" />
    <line x1="15" y1="11" x2="19" y2="14" opacity="0.5" />
    <line x1="19" y1="14" x2="15" y2="16" opacity="0.5" />
    <line x1="15" y1="16" x2="11" y2="15" opacity="0.5" />
    <line x1="11" y1="15" x2="15" y2="11" opacity="0.5" />
  </svg>
)

// Virgo - Y-shaped with extended arms
const VirgoConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="11" cy="4" r="1.5" fill="currentColor" />
    <circle cx="10" cy="9" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="7" cy="15" r="1" fill="currentColor" />
    <circle cx="17" cy="15" r="1" fill="currentColor" />
    <circle cx="4" cy="19" r="1" fill="currentColor" />
    <circle cx="20" cy="18" r="1" fill="currentColor" />
    <circle cx="14" cy="17" r="1" fill="currentColor" />
    <line x1="11" y1="4" x2="10" y2="9" opacity="0.5" />
    <line x1="10" y1="9" x2="12" y2="12" opacity="0.5" />
    <line x1="12" y1="12" x2="7" y2="15" opacity="0.5" />
    <line x1="12" y1="12" x2="17" y2="15" opacity="0.5" />
    <line x1="7" y1="15" x2="4" y2="19" opacity="0.5" />
    <line x1="17" y1="15" x2="20" y2="18" opacity="0.5" />
    <line x1="12" y1="12" x2="14" y2="17" opacity="0.5" />
  </svg>
)

// Libra - scales shape
const LibraConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="12" cy="11" r="1.5" fill="currentColor" />
    <circle cx="6" cy="7" r="1" fill="currentColor" />
    <circle cx="18" cy="8" r="1" fill="currentColor" />
    <circle cx="8" cy="16" r="1" fill="currentColor" />
    <circle cx="17" cy="17" r="1.5" fill="currentColor" />
    <line x1="12" y1="11" x2="6" y2="7" opacity="0.5" />
    <line x1="12" y1="11" x2="18" y2="8" opacity="0.5" />
    <line x1="12" y1="11" x2="8" y2="16" opacity="0.5" />
    <line x1="12" y1="11" x2="17" y2="17" opacity="0.5" />
    <line x1="6" y1="7" x2="8" y2="16" opacity="0.5" />
    <line x1="18" y1="8" x2="17" y2="17" opacity="0.5" />
  </svg>
)

// Scorpio - curved scorpion shape with stinger
const ScorpioConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="4" cy="6" r="1.5" fill="currentColor" />
    <circle cx="7" cy="10" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="14" r="1" fill="currentColor" />
    <circle cx="15" cy="16" r="1" fill="currentColor" />
    <circle cx="17" cy="17" r="1" fill="currentColor" />
    <circle cx="19" cy="15" r="1" fill="currentColor" />
    <circle cx="21" cy="12" r="1" fill="currentColor" />
    <circle cx="20" cy="18" r="1" fill="currentColor" />
    <line x1="4" y1="6" x2="7" y2="10" opacity="0.5" />
    <line x1="7" y1="10" x2="9" y2="12" opacity="0.5" />
    <line x1="9" y1="12" x2="12" y2="14" opacity="0.5" />
    <line x1="12" y1="14" x2="15" y2="16" opacity="0.5" />
    <line x1="15" y1="16" x2="17" y2="17" opacity="0.5" />
    <line x1="17" y1="17" x2="19" y2="15" opacity="0.5" />
    <line x1="19" y1="15" x2="21" y2="12" opacity="0.5" />
    <line x1="19" y1="15" x2="20" y2="18" opacity="0.5" />
  </svg>
)

// Sagittarius - teapot asterism
const SagittariusConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="8" cy="10" r="1" fill="currentColor" />
    <circle cx="12" cy="7" r="1" fill="currentColor" />
    <circle cx="16" cy="11" r="1.5" fill="currentColor" />
    <circle cx="17" cy="14" r="1" fill="currentColor" />
    <circle cx="14" cy="17" r="1" fill="currentColor" />
    <circle cx="10" cy="16" r="1" fill="currentColor" />
    <circle cx="7" cy="13" r="1" fill="currentColor" />
    <circle cx="4" cy="11" r="1" fill="currentColor" />
    <circle cx="20" cy="10" r="1" fill="currentColor" />
    <line x1="8" y1="10" x2="12" y2="7" opacity="0.5" />
    <line x1="12" y1="7" x2="16" y2="11" opacity="0.5" />
    <line x1="16" y1="11" x2="17" y2="14" opacity="0.5" />
    <line x1="17" y1="14" x2="14" y2="17" opacity="0.5" />
    <line x1="14" y1="17" x2="10" y2="16" opacity="0.5" />
    <line x1="10" y1="16" x2="7" y2="13" opacity="0.5" />
    <line x1="7" y1="13" x2="8" y2="10" opacity="0.5" />
    <line x1="7" y1="13" x2="4" y2="11" opacity="0.5" />
    <line x1="16" y1="11" x2="20" y2="10" opacity="0.5" />
    <line x1="17" y1="14" x2="20" y2="10" opacity="0.5" />
  </svg>
)

// Capricorn - triangular goat shape
const CapricornConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="6" cy="9" r="1.5" fill="currentColor" />
    <circle cx="11" cy="7" r="1" fill="currentColor" />
    <circle cx="16" cy="10" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
    <circle cx="17" cy="16" r="1" fill="currentColor" />
    <circle cx="11" cy="17" r="1" fill="currentColor" />
    <circle cx="7" cy="15" r="1" fill="currentColor" />
    <line x1="6" y1="9" x2="11" y2="7" opacity="0.5" />
    <line x1="11" y1="7" x2="16" y2="10" opacity="0.5" />
    <line x1="16" y1="10" x2="19" y2="12" opacity="0.5" />
    <line x1="19" y1="12" x2="17" y2="16" opacity="0.5" />
    <line x1="17" y1="16" x2="11" y2="17" opacity="0.5" />
    <line x1="11" y1="17" x2="7" y2="15" opacity="0.5" />
    <line x1="7" y1="15" x2="6" y2="9" opacity="0.5" />
  </svg>
)

// Aquarius - water bearer with water stream
const AquariusConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="8" cy="5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="8" r="1" fill="currentColor" />
    <circle cx="15" cy="11" r="1" fill="currentColor" />
    <circle cx="11" cy="12" r="1" fill="currentColor" />
    <circle cx="14" cy="15" r="1" fill="currentColor" />
    <circle cx="9" cy="17" r="1" fill="currentColor" />
    <circle cx="17" cy="18" r="1" fill="currentColor" />
    <circle cx="20" cy="20" r="1" fill="currentColor" />
    <line x1="8" y1="5" x2="12" y2="8" opacity="0.5" />
    <line x1="12" y1="8" x2="15" y2="11" opacity="0.5" />
    <line x1="12" y1="8" x2="11" y2="12" opacity="0.5" />
    <line x1="11" y1="12" x2="14" y2="15" opacity="0.5" />
    <line x1="11" y1="12" x2="9" y2="17" opacity="0.5" />
    <line x1="14" y1="15" x2="17" y2="18" opacity="0.5" />
    <line x1="17" y1="18" x2="20" y2="20" opacity="0.5" />
  </svg>
)

// Pisces - two fish connected by a cord
const PiscesConstellationIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="4" cy="8" r="1.5" fill="currentColor" />
    <circle cx="8" cy="10" r="1" fill="currentColor" />
    <circle cx="11" cy="11" r="1" fill="currentColor" />
    <circle cx="14" cy="12" r="1" fill="currentColor" />
    <circle cx="17" cy="14" r="1" fill="currentColor" />
    <circle cx="20" cy="17" r="1.5" fill="currentColor" />
    <circle cx="15" cy="10" r="1" fill="currentColor" />
    <circle cx="18" cy="7" r="1" fill="currentColor" />
    <line x1="4" y1="8" x2="8" y2="10" opacity="0.5" />
    <line x1="8" y1="10" x2="11" y2="11" opacity="0.5" />
    <line x1="11" y1="11" x2="14" y2="12" opacity="0.5" />
    <line x1="14" y1="12" x2="17" y2="14" opacity="0.5" />
    <line x1="17" y1="14" x2="20" y2="17" opacity="0.5" />
    <line x1="14" y1="12" x2="15" y2="10" opacity="0.5" />
    <line x1="15" y1="10" x2="18" y2="7" opacity="0.5" />
  </svg>
)

// =============================================================================
// Note: Constellations are now part of the unified 'zodiac' category
// with group 'constellations'
// =============================================================================

// =============================================================================
// Helper Functions for Icons
// =============================================================================

function getConstellationIcon(sign: string): FC {
  const iconMap: Record<string, FC> = {
    aries: AriesConstellationIcon,
    taurus: TaurusConstellationIcon,
    gemini: GeminiConstellationIcon,
    cancer: CancerConstellationIcon,
    leo: LeoConstellationIcon,
    virgo: VirgoConstellationIcon,
    libra: LibraConstellationIcon,
    scorpio: ScorpioConstellationIcon,
    sagittarius: SagittariusConstellationIcon,
    capricorn: CapricornConstellationIcon,
    aquarius: AquariusConstellationIcon,
    pisces: PiscesConstellationIcon,
  }
  return iconMap[sign] || AriesConstellationIcon // Fallback to Aries if unknown
}

// =============================================================================
// Constellations Shape Definitions
// Now part of unified 'zodiac' category with group 'constellations'
// =============================================================================

export const CONSTELLATIONS_SHAPES: CompositeShapeDefinition[] = [
  // Constellations - star patterns under 'constellations' group
  ...Object.entries(constellationGenerators).map(([sign, generator]) => ({
    id: `constellation-${sign}`,
    name: `${sign.charAt(0).toUpperCase() + sign.slice(1)} Constellation`,
    category: 'zodiac' as const,
    group: 'constellations',
    icon: getConstellationIcon(sign),
    generator: generator,
    isComposite: true as const,
  })),
]
