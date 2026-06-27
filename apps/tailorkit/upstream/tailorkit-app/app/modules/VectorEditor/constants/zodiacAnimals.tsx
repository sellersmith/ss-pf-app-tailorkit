/**
 * Chinese Zodiac Animals Constants
 * Contains icons and shape definitions for Chinese zodiac animals
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition } from './shapes'

// Import zodiac animal generators
import { zodiacAnimalGenerators } from '../utils/shapes/zodiacAnimals'

// =============================================================================
// Chinese Zodiac Animal Icons
// Using ZODIAC_ANIMAL_COLORS: body.light=#FFECD2, body.medium=#DEB887
// outline=#4A4A4A, eye=#2F2F2F, nose=#FF69B4, accents: red=#DC143C, gold=#FFD700
// =============================================================================

const RatIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="6" fill="#808080" stroke="#4A4A4A" strokeWidth="1" />
    <circle cx="8" cy="6" r="2" fill="#808080" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="16" cy="6" r="2" fill="#808080" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="10" cy="11" r="1" fill="#2F2F2F" />
    <circle cx="14" cy="11" r="1" fill="#2F2F2F" />
    <ellipse cx="12" cy="14" rx="1.5" ry="1" fill="#FF69B4" />
  </svg>
)

const OxIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="14" r="6" fill="#8B4513" stroke="#4A4A4A" strokeWidth="1" />
    {/* Horns */}
    <path d="M6 8L4 4" stroke="#F5F5DC" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 8L20 4" stroke="#F5F5DC" strokeWidth="2" strokeLinecap="round" />
    {/* Snout */}
    <ellipse cx="12" cy="16" rx="3" ry="2" fill="#DEB887" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Nostrils */}
    <circle cx="10.5" cy="16" r="0.5" fill="#2F2F2F" />
    <circle cx="13.5" cy="16" r="0.5" fill="#2F2F2F" />
    {/* Eyes */}
    <circle cx="9" cy="12" r="1" fill="#2F2F2F" />
    <circle cx="15" cy="12" r="1" fill="#2F2F2F" />
  </svg>
)

const TigerIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="7" fill="#FF8C00" stroke="#4A4A4A" strokeWidth="1" />
    {/* Stripes */}
    <line x1="12" y1="6" x2="12" y2="10" stroke="#2F2F2F" strokeWidth="1.5" />
    <line x1="8" y1="8" x2="9" y2="11" stroke="#2F2F2F" strokeWidth="1" />
    <line x1="16" y1="8" x2="15" y2="11" stroke="#2F2F2F" strokeWidth="1" />
    {/* Ears */}
    <path d="M8 6L6 4" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 6L18 4" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" />
    {/* Eyes */}
    <circle cx="9" cy="11" r="1" fill="#2F2F2F" />
    <circle cx="15" cy="11" r="1" fill="#2F2F2F" />
    {/* Nose */}
    <ellipse cx="12" cy="14" rx="1" ry="0.5" fill="#FF69B4" />
  </svg>
)

const ZodiacRabbitIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="14" r="5" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="1" />
    {/* Ears */}
    <path d="M9 9V3C9 2 10 2 10 3V8" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="1" />
    <path d="M15 9V3C15 2 14 2 14 3V8" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="1" />
    {/* Inner ears */}
    <path d="M9.5 8V4" stroke="#FF69B4" strokeWidth="1" />
    <path d="M14.5 8V4" stroke="#FF69B4" strokeWidth="1" />
    {/* Eyes */}
    <circle cx="10" cy="13" r="1" fill="#2F2F2F" />
    <circle cx="14" cy="13" r="1" fill="#2F2F2F" />
    {/* Nose */}
    <ellipse cx="12" cy="15" rx="1" ry="0.5" fill="#FF69B4" />
  </svg>
)

const DragonIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 4C8 4 6 8 6 12C6 16 8 20 12 20C16 20 18 16 18 12C18 8 16 4 12 4Z"
      fill="#DC143C"
      stroke="#4A4A4A"
      strokeWidth="1"
    />
    {/* Horns */}
    <path d="M6 8L4 4L6 6" fill="#FFD700" stroke="#DAA520" strokeWidth="0.5" />
    <path d="M18 8L20 4L18 6" fill="#FFD700" stroke="#DAA520" strokeWidth="0.5" />
    {/* Scales hint */}
    <path d="M9 12C9 11 10 10 12 10C14 10 15 11 15 12" stroke="#B22222" strokeWidth="0.5" fill="none" />
    {/* Eyes */}
    <circle cx="10" cy="10" r="1" fill="#FFD700" stroke="#4A4A4A" strokeWidth="0.3" />
    <circle cx="14" cy="10" r="1" fill="#FFD700" stroke="#4A4A4A" strokeWidth="0.3" />
  </svg>
)

const SnakeIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <path d="M12 6L16 10L12 14L8 18" stroke="#228B22" strokeWidth="3" strokeLinecap="round" fill="none" />
    {/* Pattern */}
    <path
      d="M12 6L16 10L12 14L8 18"
      stroke="#32CD32"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      strokeDasharray="2 3"
    />
    {/* Head */}
    <circle cx="12" cy="5" r="2.5" fill="#228B22" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eyes */}
    <circle cx="11" cy="4.5" r="0.5" fill="#2F2F2F" />
    <circle cx="13" cy="4.5" r="0.5" fill="#2F2F2F" />
    {/* Tongue */}
    <path d="M12 7L11.5 8.5M12 7L12.5 8.5" stroke="#DC143C" strokeWidth="0.5" />
  </svg>
)

const HorseIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Head and neck */}
    <path d="M8 20V12C8 8 12 6 14 6H18V10L16 12V20" fill="#8B4513" stroke="#4A4A4A" strokeWidth="1" />
    {/* Mane */}
    <path d="M14 6C14 4 16 2 18 4" stroke="#2F2F2F" strokeWidth="2" strokeLinecap="round" />
    {/* Eye */}
    <circle cx="15" cy="9" r="1" fill="#2F2F2F" />
    <circle cx="15.3" cy="8.7" r="0.3" fill="#FFFFFF" />
  </svg>
)

const GoatIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="14" r="5" fill="#FFECD2" stroke="#4A4A4A" strokeWidth="1" />
    {/* Horns */}
    <path d="M8 9C6 6 4 6 4 8" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M16 9C18 6 20 6 20 8" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Beard */}
    <ellipse cx="12" cy="19" rx="2" ry="1.5" fill="#DEB887" stroke="#4A4A4A" strokeWidth="0.3" />
    {/* Eyes */}
    <circle cx="10" cy="13" r="1" fill="#2F2F2F" />
    <circle cx="14" cy="13" r="1" fill="#2F2F2F" />
    {/* Nose */}
    <ellipse cx="12" cy="15" rx="1" ry="0.5" fill="#FF69B4" />
  </svg>
)

const MonkeyIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="6" fill="#8B4513" stroke="#4A4A4A" strokeWidth="1" />
    {/* Ears */}
    <circle cx="5" cy="12" r="2" fill="#FFECD2" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="19" cy="12" r="2" fill="#FFECD2" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Face area */}
    <ellipse cx="12" cy="13" rx="4" ry="3" fill="#FFECD2" />
    {/* Eyes */}
    <circle cx="10" cy="11" r="1" fill="#2F2F2F" />
    <circle cx="14" cy="11" r="1" fill="#2F2F2F" />
    {/* Nose/mouth */}
    <ellipse cx="12" cy="14" rx="1.5" ry="1" fill="#DEB887" />
  </svg>
)

const RoosterIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="5" fill="#DC143C" stroke="#4A4A4A" strokeWidth="1" />
    {/* Comb */}
    <path d="M10 7C10 5 11 4 12 4C13 4 13 5 13 6C14 5 15 5 14 7" fill="#DC143C" stroke="#B22222" strokeWidth="0.5" />
    {/* Beak */}
    <path d="M16 11L20 10L16 12" fill="#FFD700" stroke="#DAA520" strokeWidth="0.3" />
    {/* Wattle */}
    <path d="M12 17L10 20L14 20L12 17" fill="#DC143C" stroke="#B22222" strokeWidth="0.3" />
    {/* Eye */}
    <circle cx="14" cy="11" r="0.8" fill="#2F2F2F" />
  </svg>
)

const ZodiacDogIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="6" fill="#DEB887" stroke="#4A4A4A" strokeWidth="1" />
    {/* Floppy ears */}
    <path d="M6 10C4 8 4 12 6 12" fill="#8B4513" stroke="#4A4A4A" strokeWidth="0.5" />
    <path d="M18 10C20 8 20 12 18 12" fill="#8B4513" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eyes */}
    <circle cx="10" cy="11" r="1" fill="#2F2F2F" />
    <circle cx="14" cy="11" r="1" fill="#2F2F2F" />
    {/* Nose */}
    <ellipse cx="12" cy="14" rx="2" ry="1" fill="#2F2F2F" />
  </svg>
)

const PigIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="6" fill="#FFCDD2" stroke="#4A4A4A" strokeWidth="1" />
    {/* Ears */}
    <path d="M8 6L6 4" stroke="#FFCDD2" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M16 6L18 4" stroke="#FFCDD2" strokeWidth="2.5" strokeLinecap="round" />
    {/* Snout */}
    <ellipse cx="12" cy="14" rx="3" ry="2" fill="#FF69B4" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Nostrils */}
    <circle cx="10.5" cy="14" r="0.5" fill="#2F2F2F" />
    <circle cx="13.5" cy="14" r="0.5" fill="#2F2F2F" />
    {/* Eyes */}
    <circle cx="9" cy="10" r="1" fill="#2F2F2F" />
    <circle cx="15" cy="10" r="1" fill="#2F2F2F" />
  </svg>
)

// =============================================================================
// Note: Zodiac animals are now part of the unified 'zodiac' category
// with group 'chinese-zodiac'
// =============================================================================

// =============================================================================
// Helper Functions for Icons
// =============================================================================

function getZodiacAnimalIcon(animal: string): FC {
  const iconMap: Record<string, FC> = {
    rat: RatIcon,
    ox: OxIcon,
    tiger: TigerIcon,
    rabbit: ZodiacRabbitIcon,
    dragon: DragonIcon,
    snake: SnakeIcon,
    horse: HorseIcon,
    goat: GoatIcon,
    monkey: MonkeyIcon,
    rooster: RoosterIcon,
    dog: ZodiacDogIcon,
    pig: PigIcon,
  }
  return iconMap[animal] || RatIcon
}

// =============================================================================
// Zodiac Animals Shape Definitions
// Now part of unified 'zodiac' category with group 'chinese-zodiac'
// =============================================================================

export const ZODIAC_ANIMALS_SHAPES: CompositeShapeDefinition[] = [
  // Chinese Zodiac Animals - 12 animals under 'chinese-zodiac' group
  ...Object.entries(zodiacAnimalGenerators).map(([animal, generators]) => ({
    id: `zodiac-animal-${animal}`,
    name: `${animal.charAt(0).toUpperCase() + animal.slice(1)}`,
    category: 'zodiac' as const,
    group: 'chinese-zodiac',
    icon: getZodiacAnimalIcon(animal),
    generator: generators.cartoon,
    isComposite: true as const,
    style: 'cartoon' as const,
  })),
]
