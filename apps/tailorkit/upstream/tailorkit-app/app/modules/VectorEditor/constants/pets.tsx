/**
 * Pets Constants
 * Contains icons and shape definitions for common pet animals
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition, ShapeGroupDefinition } from './shapes'

// Import pet generators
import { petGenerators } from '../utils/shapes/pets'

// =============================================================================
// Pet Icons - Using PET_COLORS from fantasy/types.ts
// Fur colors: orange=#FF8C00, tan=#D2B48C, white=#FFFFFF
// Features: outline=#4A4A4A, eye=#2F2F2F, nose=#FF69B4 (pink)
// =============================================================================

const PetDogIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Face */}
    <circle cx="12" cy="12" r="6" fill="#D2B48C" stroke="#4A4A4A" strokeWidth="1" />
    {/* Floppy ears */}
    <ellipse cx="6" cy="14" rx="2" ry="3" fill="#8B4513" stroke="#4A4A4A" strokeWidth="0.5" />
    <ellipse cx="18" cy="14" rx="2" ry="3" fill="#8B4513" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eyes */}
    <circle cx="10" cy="10" r="1.5" fill="#2F2F2F" />
    <circle cx="14" cy="10" r="1.5" fill="#2F2F2F" />
    <circle cx="10.5" cy="9.5" r="0.5" fill="#FFFFFF" />
    <circle cx="14.5" cy="9.5" r="0.5" fill="#FFFFFF" />
    {/* Nose */}
    <ellipse cx="12" cy="14" rx="2" ry="1.5" fill="#2F2F2F" />
  </svg>
)

const CatIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Face */}
    <circle cx="12" cy="12" r="6" fill="#FF8C00" stroke="#4A4A4A" strokeWidth="1" />
    {/* Pointed ears */}
    <path d="M7 6L5 2L9 5Z" fill="#FF8C00" stroke="#4A4A4A" strokeWidth="0.5" />
    <path d="M17 6L19 2L15 5Z" fill="#FF8C00" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Inner ears (pink) */}
    <path d="M7 5.5L6 3L8 5Z" fill="#FF69B4" />
    <path d="M17 5.5L18 3L16 5Z" fill="#FF69B4" />
    {/* Eyes (green cat eyes) */}
    <ellipse cx="10" cy="10" rx="1" ry="1.5" fill="#32CD32" stroke="#4A4A4A" strokeWidth="0.3" />
    <ellipse cx="14" cy="10" rx="1" ry="1.5" fill="#32CD32" stroke="#4A4A4A" strokeWidth="0.3" />
    {/* Whiskers */}
    <path d="M9 12L5 11M9 13L5 14" stroke="#4A4A4A" strokeWidth="0.5" />
    <path d="M15 12L19 11M15 13L19 14" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Nose */}
    <path d="M12 12L11 14L13 14Z" fill="#FF69B4" />
  </svg>
)

const RabbitIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <circle cx="12" cy="14" r="5" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="1" />
    {/* Ears */}
    <path d="M9 9V3C9 2 10 2 10 3V8" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="1" />
    <path d="M15 9V3C15 2 14 2 14 3V8" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="1" />
    {/* Inner ears (pink) */}
    <path d="M9.5 8V4" stroke="#FF69B4" strokeWidth="1" />
    <path d="M14.5 8V4" stroke="#FF69B4" strokeWidth="1" />
    {/* Eyes */}
    <circle cx="10" cy="13" r="1" fill="#2F2F2F" />
    <circle cx="14" cy="13" r="1" fill="#2F2F2F" />
    {/* Nose */}
    <ellipse cx="12" cy="15" rx="1" ry="0.5" fill="#FF69B4" />
  </svg>
)

const HamsterIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="12" cy="12" rx="8" ry="6" fill="#DEB887" stroke="#4A4A4A" strokeWidth="1" />
    {/* Ears */}
    <circle cx="7" cy="8" r="1.5" fill="#DEB887" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="17" cy="8" r="1.5" fill="#DEB887" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Cheek pouches */}
    <circle cx="8" cy="12" r="2" fill="#FFECD2" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="16" cy="12" r="2" fill="#FFECD2" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eyes */}
    <circle cx="10" cy="10" r="1" fill="#2F2F2F" />
    <circle cx="14" cy="10" r="1" fill="#2F2F2F" />
    {/* Nose */}
    <ellipse cx="12" cy="13" rx="1" ry="0.5" fill="#FF69B4" />
  </svg>
)

const BirdIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <circle cx="12" cy="12" r="5" fill="#FFD700" stroke="#4A4A4A" strokeWidth="1" />
    {/* Wing */}
    <path d="M6 12C4 10 4 14 6 14" fill="#FFC107" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Tail feathers */}
    <path d="M16 10L20 8" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 12L20 12" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" />
    {/* Beak */}
    <path d="M7 11L4 12L7 13" fill="#FF8C00" stroke="#E65100" strokeWidth="0.3" />
    {/* Eye */}
    <circle cx="9" cy="10" r="1" fill="#2F2F2F" />
    <circle cx="9.3" cy="9.7" r="0.3" fill="#FFFFFF" />
  </svg>
)

const ParrotIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="12" cy="14" rx="5" ry="6" fill="#4CAF50" stroke="#4A4A4A" strokeWidth="1" />
    {/* Head */}
    <circle cx="12" cy="8" r="4" fill="#66BB6A" stroke="#4A4A4A" strokeWidth="1" />
    {/* Eye patch */}
    <circle cx="14" cy="7" r="1.5" fill="#FFFFFF" />
    {/* Eye */}
    <circle cx="14" cy="7" r="0.8" fill="#2F2F2F" />
    {/* Curved beak */}
    <path d="M16 7C18 6 18 9 16 9" fill="#37474F" stroke="#4A4A4A" strokeWidth="0.3" />
    {/* Wing */}
    <path d="M8 14C6 12 6 18 8 18" fill="#2196F3" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Tail */}
    <path d="M10 19L9 22M12 19L12 22M14 19L15 22" stroke="#F44336" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const OwlIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="12" cy="14" rx="6" ry="7" fill="#8D6E63" stroke="#4A4A4A" strokeWidth="1" />
    {/* Belly */}
    <ellipse cx="12" cy="16" rx="3" ry="4" fill="#D7CCC8" />
    {/* Ear tufts */}
    <path d="M7 7L5 3L9 6" fill="#8D6E63" stroke="#4A4A4A" strokeWidth="0.5" />
    <path d="M17 7L19 3L15 6" fill="#8D6E63" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eyes */}
    <circle cx="9" cy="10" r="2.5" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="15" cy="10" r="2.5" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="9" cy="10" r="1.2" fill="#FF8F00" />
    <circle cx="15" cy="10" r="1.2" fill="#FF8F00" />
    <circle cx="9" cy="10" r="0.5" fill="#2F2F2F" />
    <circle cx="15" cy="10" r="0.5" fill="#2F2F2F" />
    {/* Beak */}
    <path d="M12 12L11 14L13 14Z" fill="#FFA726" stroke="#4A4A4A" strokeWidth="0.3" />
  </svg>
)

const DuckIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="12" cy="14" rx="6" ry="4" fill="#FFD700" stroke="#4A4A4A" strokeWidth="1" />
    {/* Head */}
    <circle cx="6" cy="10" r="3" fill="#FFD700" stroke="#4A4A4A" strokeWidth="1" />
    {/* Beak */}
    <path d="M3 10C1 9 1 12 3 11" fill="#FF9800" stroke="#4A4A4A" strokeWidth="0.3" />
    {/* Eye */}
    <circle cx="5" cy="9" r="0.8" fill="#2F2F2F" />
    {/* Wing */}
    <ellipse cx="13" cy="13" rx="2.5" ry="1.5" fill="#FDD835" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Tail */}
    <path d="M17 12L20 10M17 14L20 14M17 16L20 18" stroke="#FFD700" strokeWidth="1" strokeLinecap="round" />
    {/* Feet */}
    <path d="M10 18L9 20L11 19L10 20" stroke="#FF9800" strokeWidth="1" />
    <path d="M14 18L13 20L15 19L14 20" stroke="#FF9800" strokeWidth="1" />
  </svg>
)

const FishIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="10" cy="12" rx="6" ry="4" fill="#FF8C00" stroke="#4A4A4A" strokeWidth="1" />
    {/* Scales pattern hint */}
    <ellipse cx="9" cy="12" rx="4" ry="2.5" fill="#FFD700" stroke="none" opacity="0.5" />
    {/* Tail */}
    <path d="M16 12L20 8V16L16 12Z" fill="#FF8C00" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Dorsal fin */}
    <path d="M10 8C10 6 12 6 12 8" fill="#FF8C00" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eye */}
    <circle cx="7" cy="11" r="1" fill="#2F2F2F" />
    <circle cx="7.3" cy="10.7" r="0.3" fill="#FFFFFF" />
  </svg>
)

const GoldfishIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="10" cy="12" rx="5" ry="4" fill="#FF8F00" stroke="#4A4A4A" strokeWidth="1" />
    {/* Flowing tail */}
    <path d="M14 10C18 8 18 16 14 14" fill="#FFB74D" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Dorsal fin */}
    <path d="M8 8C7 5 12 5 11 8" fill="#FFB74D" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Pectoral fin */}
    <path d="M8 14C6 16 6 16 8 15" fill="#FFB74D" stroke="#4A4A4A" strokeWidth="0.3" />
    {/* Eye */}
    <circle cx="7" cy="11" r="1.2" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="0.3" />
    <circle cx="7" cy="11" r="0.5" fill="#2F2F2F" />
  </svg>
)

const DolphinIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <path
      d="M4 12C4 8 8 8 12 10C16 12 18 12 18 12C18 14 14 14 12 14C8 14 4 14 4 12Z"
      fill="#546E7A"
      stroke="#4A4A4A"
      strokeWidth="1"
    />
    {/* Snout */}
    <path d="M4 12L2 11L4 11" fill="#546E7A" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Belly */}
    <path d="M6 13C8 14 12 14 14 13" fill="none" stroke="#B0BEC5" strokeWidth="2" />
    {/* Dorsal fin */}
    <path d="M10 10L11 6L12 10" fill="#455A64" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Tail */}
    <path d="M18 12L21 10M18 12L21 14" stroke="#455A64" strokeWidth="2" strokeLinecap="round" />
    {/* Eye */}
    <circle cx="5" cy="11" r="0.8" fill="#2F2F2F" />
  </svg>
)

const CrabIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="12" cy="14" rx="6" ry="4" fill="#E53935" stroke="#4A4A4A" strokeWidth="1" />
    {/* Eye stalks */}
    <path d="M9 10V7" stroke="#E53935" strokeWidth="2" />
    <path d="M15 10V7" stroke="#E53935" strokeWidth="2" />
    {/* Eyes */}
    <circle cx="9" cy="6" r="1.5" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="15" cy="6" r="1.5" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="9" cy="6" r="0.5" fill="#2F2F2F" />
    <circle cx="15" cy="6" r="0.5" fill="#2F2F2F" />
    {/* Claws */}
    <path d="M6 12L3 10L2 12L4 11" fill="#EF5350" stroke="#4A4A4A" strokeWidth="0.5" />
    <path d="M18 12L21 10L22 12L20 11" fill="#EF5350" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Legs */}
    <path d="M7 16L5 18M8 17L6 20M16 17L18 20M17 16L19 18" stroke="#E53935" strokeWidth="1.5" />
  </svg>
)

const TurtleIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Shell */}
    <ellipse cx="12" cy="12" rx="7" ry="5" fill="#228B22" stroke="#4A4A4A" strokeWidth="1" />
    {/* Shell pattern */}
    <circle cx="12" cy="12" r="3" fill="#32CD32" stroke="#228B22" strokeWidth="0.5" />
    <path d="M9 10L7 8M15 10L17 8M9 14L7 16M15 14L17 16" stroke="#228B22" strokeWidth="0.5" />
    {/* Head */}
    <path d="M18 10L20 8" stroke="#228B22" strokeWidth="2" />
    <circle cx="20" cy="8" r="1.5" fill="#228B22" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eye */}
    <circle cx="20.5" cy="7.5" r="0.5" fill="#2F2F2F" />
  </svg>
)

const LizardIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="12" cy="12" rx="4" ry="2" fill="#4CAF50" stroke="#4A4A4A" strokeWidth="1" />
    {/* Head */}
    <ellipse cx="7" cy="12" rx="2.5" ry="2" fill="#4CAF50" stroke="#4A4A4A" strokeWidth="1" />
    {/* Eye */}
    <circle cx="6" cy="11" r="1" fill="#FFEB3B" stroke="#4A4A4A" strokeWidth="0.3" />
    <ellipse cx="6" cy="11" rx="0.3" ry="0.6" fill="#2F2F2F" />
    {/* Tail */}
    <path d="M16 12C18 11 20 13 21 15" stroke="#66BB6A" strokeWidth="2" strokeLinecap="round" />
    {/* Legs */}
    <path d="M10 14L8 17L7 16M10 17L9 18" stroke="#4CAF50" strokeWidth="1.5" />
    <path d="M10 10L8 7L7 8M10 7L9 6" stroke="#4CAF50" strokeWidth="1.5" />
    <path d="M14 14L16 17L17 16" stroke="#4CAF50" strokeWidth="1.5" />
    <path d="M14 10L16 7L17 8" stroke="#4CAF50" strokeWidth="1.5" />
  </svg>
)

const SnakeIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body coil */}
    <path
      d="M18 16C14 18 8 18 6 14C4 10 8 8 12 10C16 12 18 10 18 8"
      stroke="#8BC34A"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
    {/* Pattern */}
    <path
      d="M18 16C14 18 8 18 6 14C4 10 8 8 12 10C16 12 18 10 18 8"
      stroke="#689F38"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      strokeDasharray="3 3"
    />
    {/* Head */}
    <circle cx="18" cy="7" r="2" fill="#8BC34A" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eye */}
    <circle cx="19" cy="6.5" r="0.6" fill="#FFEB3B" />
    <ellipse cx="19" cy="6.5" rx="0.2" ry="0.4" fill="#2F2F2F" />
    {/* Tongue */}
    <path d="M20 7.5L22 7M22 7L22.5 6.5M22 7L22.5 7.5" stroke="#E91E63" strokeWidth="0.5" />
  </svg>
)

const FrogIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Body */}
    <ellipse cx="12" cy="14" rx="6" ry="5" fill="#4CAF50" stroke="#4A4A4A" strokeWidth="1" />
    {/* Belly */}
    <ellipse cx="12" cy="16" rx="3" ry="2.5" fill="#C8E6C9" />
    {/* Eye bumps */}
    <circle cx="8" cy="8" r="2.5" fill="#4CAF50" stroke="#4A4A4A" strokeWidth="0.5" />
    <circle cx="16" cy="8" r="2.5" fill="#4CAF50" stroke="#4A4A4A" strokeWidth="0.5" />
    {/* Eyes */}
    <circle cx="8" cy="7" r="1.5" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="0.3" />
    <circle cx="16" cy="7" r="1.5" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="0.3" />
    <circle cx="8" cy="7" r="0.6" fill="#2F2F2F" />
    <circle cx="16" cy="7" r="0.6" fill="#2F2F2F" />
    {/* Mouth */}
    <path d="M9 13C10 14 14 14 15 13" stroke="#4A4A4A" strokeWidth="0.5" fill="none" />
    {/* Front legs */}
    <path d="M6 16L4 18L3 17M4 18L3 19M4 18L5 19" stroke="#4CAF50" strokeWidth="1.5" />
    <path d="M18 16L20 18L21 17M20 18L21 19M20 18L19 19" stroke="#4CAF50" strokeWidth="1.5" />
    {/* Spots */}
    <circle cx="10" cy="12" r="0.8" fill="#388E3C" />
    <circle cx="14" cy="14" r="0.6" fill="#388E3C" />
  </svg>
)

// =============================================================================
// Pets Group Definitions
// =============================================================================

export const PETS_GROUPS: ShapeGroupDefinition[] = [
  { id: 'mammals', labelKey: 'Mammals' },
  { id: 'birds', labelKey: 'Birds' },
  { id: 'aquatic', labelKey: 'Aquatic' },
  { id: 'reptiles', labelKey: 'Reptiles' },
]

// =============================================================================
// Helper Functions for Icons
// =============================================================================

function getPetIcon(pet: string): FC {
  const iconMap: Record<string, FC> = {
    dog: PetDogIcon,
    cat: CatIcon,
    rabbit: RabbitIcon,
    hamster: HamsterIcon,
    bird: BirdIcon,
    parrot: ParrotIcon,
    owl: OwlIcon,
    duck: DuckIcon,
    fish: FishIcon,
    goldfish: GoldfishIcon,
    dolphin: DolphinIcon,
    crab: CrabIcon,
    turtle: TurtleIcon,
    lizard: LizardIcon,
    snake: SnakeIcon,
    frog: FrogIcon,
  }
  return iconMap[pet] || PetDogIcon
}

// Pet to group mapping
const petGroups: Record<string, string> = {
  dog: 'mammals',
  cat: 'mammals',
  rabbit: 'mammals',
  hamster: 'mammals',
  bird: 'birds',
  parrot: 'birds',
  owl: 'birds',
  duck: 'birds',
  fish: 'aquatic',
  goldfish: 'aquatic',
  dolphin: 'aquatic',
  crab: 'aquatic',
  turtle: 'reptiles',
  lizard: 'reptiles',
  snake: 'reptiles',
  frog: 'reptiles',
}

// =============================================================================
// Pets Shape Definitions
// =============================================================================

export const PETS_SHAPES: CompositeShapeDefinition[] = [
  // Pets
  ...Object.entries(petGenerators).map(([pet, generators]) => ({
    id: `pet-${pet}`,
    name: `${pet.charAt(0).toUpperCase() + pet.slice(1)}`,
    category: 'pets' as const,
    group: petGroups[pet] || 'mammals',
    icon: getPetIcon(pet),
    generator: generators.cartoon,
    isComposite: true as const,
    style: 'cartoon' as const,
  })),
]
