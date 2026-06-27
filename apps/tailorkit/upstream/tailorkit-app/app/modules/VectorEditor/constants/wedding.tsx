/**
 * Wedding Objects Constants
 * Icon components and shape definitions for wedding-related objects
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition } from './shapes'
import {
  generateWeddingCake,
  generateWeddingRings,
  generateWeddingDress,
  generateBouquet,
  generateChurch,
  generateChampagneGlasses,
} from '../utils/shapes/objects'

// ============================================================================
// WEDDING ICONS
// ============================================================================

const WeddingCakeIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Bottom tier */}
    <rect x="3" y="15" width="18" height="5" rx="0.5" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="0.5" />
    {/* Middle tier */}
    <rect x="5" y="10" width="14" height="5" fill="#FFF8E1" stroke="#FFE0B2" strokeWidth="0.4" />
    {/* Top tier */}
    <rect x="7" y="5" width="10" height="5" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="0.4" />
    {/* Decorative swirl */}
    <path d="M5 17 Q8 15 12 17 Q16 19 19 17" fill="none" stroke="#F8BBD9" strokeWidth="1" />
    {/* Heart topper */}
    <path
      d="M12 4 C11 3 10 3 10 3.5 C10 2.5 11 2 12 3 C13 2 14 2.5 14 3.5 C14 3 13 3 12 4"
      fill="#FFD54F"
      stroke="#FF8F00"
      strokeWidth="0.3"
    />
  </svg>
)

const WeddingRingsIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Left ring */}
    <circle cx="9" cy="12" r="5" fill="none" stroke="#FFD54F" strokeWidth="2" />
    {/* Right ring */}
    <circle cx="15" cy="12" r="5" fill="none" stroke="#FFD54F" strokeWidth="2" />
    {/* Diamond on right ring */}
    <polygon points="15,7 16.2,8.5 15,10 13.8,8.5" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="0.3" />
  </svg>
)

const WeddingDressIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Bodice */}
    <path d="M9 6 L15 6 L16 10 L8 10 Z" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="0.5" />
    {/* Neckline */}
    <path d="M10 6 Q12 7.5 14 6" fill="none" stroke="#F8BBD9" strokeWidth="0.8" />
    {/* Skirt */}
    <path d="M8 10 Q5 15 4 20 L20 20 Q19 15 16 10 Z" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="0.5" />
    {/* Ribbon */}
    <rect x="8" y="10" width="8" height="1.5" fill="#B3E5FC" stroke="#4FC3F7" strokeWidth="0.3" />
    {/* Bow */}
    <ellipse cx="10.5" cy="11" rx="1.5" ry="0.8" fill="#B3E5FC" stroke="#4FC3F7" strokeWidth="0.2" />
    <ellipse cx="13.5" cy="11" rx="1.5" ry="0.8" fill="#B3E5FC" stroke="#4FC3F7" strokeWidth="0.2" />
  </svg>
)

const BouquetIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Leaves */}
    <path d="M6 10 Q8 6 12 8" fill="#81C784" stroke="#4CAF50" strokeWidth="0.3" />
    <path d="M18 10 Q16 6 12 8" fill="#81C784" stroke="#4CAF50" strokeWidth="0.3" />
    {/* Flowers */}
    <circle cx="12" cy="7" r="3" fill="#F8BBD9" stroke="#F48FB1" strokeWidth="0.3" />
    <circle cx="8" cy="10" r="2.5" fill="#FFCDD2" stroke="#EF9A9A" strokeWidth="0.3" />
    <circle cx="16" cy="10" r="2.5" fill="#E1BEE7" stroke="#CE93D8" strokeWidth="0.3" />
    <circle cx="10" cy="12" r="2" fill="#FFCDD2" stroke="#EF9A9A" strokeWidth="0.3" />
    <circle cx="14" cy="12" r="2" fill="#E1BEE7" stroke="#CE93D8" strokeWidth="0.3" />
    {/* Flower centers */}
    <circle cx="12" cy="7" r="0.8" fill="#FFEB3B" />
    <circle cx="8" cy="10" r="0.6" fill="#FFEB3B" />
    <circle cx="16" cy="10" r="0.6" fill="#FFEB3B" />
    {/* Wrapper */}
    <path d="M10 13 L14 13 L13.5 20 L10.5 20 Z" fill="#B3E5FC" stroke="#4FC3F7" strokeWidth="0.5" />
    {/* Ribbon on wrapper */}
    <rect x="10" y="15" width="4" height="1.5" fill="#F8BBD9" stroke="#F48FB1" strokeWidth="0.2" />
  </svg>
)

const ChurchIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Building body */}
    <rect x="5" y="10" width="14" height="10" fill="#FFECB3" stroke="#FFB300" strokeWidth="0.5" />
    {/* Main roof */}
    <polygon points="4,10 12,4 20,10" fill="#8D6E63" stroke="#5D4037" strokeWidth="0.5" />
    {/* Steeple */}
    <polygon points="10,4 12,1 14,4" fill="#8D6E63" stroke="#5D4037" strokeWidth="0.4" />
    {/* Cross */}
    <rect x="11.5" y="-0.5" width="1" height="3" fill="#FFD54F" stroke="#FF8F00" strokeWidth="0.2" />
    <rect x="10.5" y="0" width="3" height="1" fill="#FFD54F" stroke="#FF8F00" strokeWidth="0.2" />
    {/* Window */}
    <circle cx="12" cy="8" r="1.5" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="0.3" />
    {/* Door */}
    <path d="M10 20 L10 14 Q12 12 14 14 L14 20 Z" fill="#6D4C41" stroke="#5D4037" strokeWidth="0.4" />
  </svg>
)

const ChampagneGlassesIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Left glass bowl */}
    <path d="M5 5 Q4 10 6 12 L6 12 L8 12 Q10 10 9 5 Z" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="0.5" />
    {/* Left liquid */}
    <path d="M5.5 6 Q5 9 6.2 10.5 L7.8 10.5 Q9 9 8.5 6 Z" fill="#FFF59D" stroke="#FFF176" strokeWidth="0.2" />
    {/* Left stem */}
    <rect x="6.5" y="12" width="1" height="6" fill="#E0E0E0" stroke="#BDBDBD" strokeWidth="0.3" />
    {/* Left base */}
    <ellipse cx="7" cy="18.5" rx="2" ry="0.8" fill="#E0E0E0" stroke="#BDBDBD" strokeWidth="0.3" />
    {/* Right glass bowl */}
    <path d="M15 5 Q14 10 16 12 L16 12 L18 12 Q20 10 19 5 Z" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="0.5" />
    {/* Right liquid */}
    <path d="M15.5 6 Q15 9 16.2 10.5 L17.8 10.5 Q19 9 18.5 6 Z" fill="#FFF59D" stroke="#FFF176" strokeWidth="0.2" />
    {/* Right stem */}
    <rect x="16.5" y="12" width="1" height="6" fill="#E0E0E0" stroke="#BDBDBD" strokeWidth="0.3" />
    {/* Right base */}
    <ellipse cx="17" cy="18.5" rx="2" ry="0.8" fill="#E0E0E0" stroke="#BDBDBD" strokeWidth="0.3" />
    {/* Bubbles */}
    <circle cx="6" cy="7" r="0.4" fill="#FFFFFF" />
    <circle cx="7.5" cy="8" r="0.3" fill="#FFFFFF" />
    <circle cx="16.5" cy="7.5" r="0.4" fill="#FFFFFF" />
    <circle cx="18" cy="8.5" r="0.3" fill="#FFFFFF" />
  </svg>
)

// ============================================================================
// WEDDING SHAPE DEFINITIONS
// ============================================================================

export const WEDDING_SHAPES: CompositeShapeDefinition[] = [
  {
    id: 'wedding-cake',
    name: 'Wedding Cake',
    category: 'occasions',
    group: 'wedding',
    icon: WeddingCakeIcon,
    generator: generateWeddingCake,
    isComposite: true,
  },
  {
    id: 'wedding-rings',
    name: 'Wedding Rings',
    category: 'occasions',
    group: 'wedding',
    icon: WeddingRingsIcon,
    generator: generateWeddingRings,
    isComposite: true,
  },
  {
    id: 'wedding-dress',
    name: 'Wedding Dress',
    category: 'occasions',
    group: 'wedding',
    icon: WeddingDressIcon,
    generator: generateWeddingDress,
    isComposite: true,
  },
  {
    id: 'wedding-bouquet',
    name: 'Bouquet',
    category: 'occasions',
    group: 'wedding',
    icon: BouquetIcon,
    generator: generateBouquet,
    isComposite: true,
  },
  {
    id: 'wedding-church',
    name: 'Church',
    category: 'occasions',
    group: 'wedding',
    icon: ChurchIcon,
    generator: generateChurch,
    isComposite: true,
  },
  {
    id: 'wedding-champagne',
    name: 'Champagne Glasses',
    category: 'occasions',
    group: 'wedding',
    icon: ChampagneGlassesIcon,
    generator: generateChampagneGlasses,
    isComposite: true,
  },
]
