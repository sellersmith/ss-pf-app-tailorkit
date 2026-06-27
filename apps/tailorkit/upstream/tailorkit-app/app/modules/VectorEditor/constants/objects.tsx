/**
 * Common Objects Constants
 * Icon components and shape definitions for common objects
 */

import type { FC } from 'react'
import type { CompositeShapeDefinition } from './shapes'
import {
  generateBall,
  generateBasketball,
  generateSoccerBall,
  generateTennisBall,
  generatePickleball,
  generatePencil,
  generatePen,
  generateRuler,
  generateEraser,
  generateCup,
  generateBottle,
  generateJar,
  generateBox,
  generatePhone,
  generateLaptop,
  generateHeadphones,
  generateCamera,
} from '../utils/shapes/objects'

// ============================================================================
// SPORTS ICONS
// ============================================================================

const BallIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <circle cx="12" cy="12" r="9" fill="#FF9800" stroke="#E65100" strokeWidth="1" />
    <circle cx="9" cy="9" r="2.5" fill="#FFFFFF" opacity="0.5" />
  </svg>
)

const BasketballIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Main ball */}
    <circle cx="12" cy="12" r="9" fill="#FF5722" stroke="#BF360C" strokeWidth="1" />
    {/* Horizontal seam */}
    <line x1="3" y1="12" x2="21" y2="12" stroke="#3E2723" strokeWidth="1" />
    {/* Vertical seam */}
    <line x1="12" y1="3" x2="12" y2="21" stroke="#3E2723" strokeWidth="1" />
    {/* Left curved seam - curves INWARD toward center */}
    <path d="M5.7 5.5 C10 8 10 16 5.7 18.5" stroke="#3E2723" strokeWidth="1" fill="none" />
    {/* Right curved seam - curves INWARD toward center */}
    <path d="M18.3 5.5 C14 8 14 16 18.3 18.5" stroke="#3E2723" strokeWidth="1" fill="none" />
  </svg>
)

const SoccerBallIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <circle cx="12" cy="12" r="9" fill="#FFFFFF" stroke="#424242" strokeWidth="1.5" />
    <path d="M12 6 L14.5 9 L13 12 L11 12 L9.5 9 Z" fill="#212121" />
  </svg>
)

const TennisBallIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <circle cx="12" cy="12" r="9" fill="#CDDC39" stroke="#827717" strokeWidth="1" />
    {/* Left seam - S-curve that goes to the edge */}
    <path d="M10.5 3 C6 5 4 9 4 12 C4 15 6 19 10.5 21" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
    {/* Right seam - S-curve that goes to the edge */}
    <path d="M13.5 3 C18 5 20 9 20 12 C20 15 18 19 13.5 21" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
  </svg>
)

const PickleballIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <circle cx="12" cy="12" r="9" fill="#CDDC39" stroke="#9E9D24" strokeWidth="1" />
    {/* Holes pattern */}
    <circle cx="12" cy="12" r="1.2" fill="#9E9D24" />
    {/* Inner ring */}
    <circle cx="12" cy="8" r="1" fill="#9E9D24" />
    <circle cx="15.5" cy="10" r="1" fill="#9E9D24" />
    <circle cx="15.5" cy="14" r="1" fill="#9E9D24" />
    <circle cx="12" cy="16" r="1" fill="#9E9D24" />
    <circle cx="8.5" cy="14" r="1" fill="#9E9D24" />
    <circle cx="8.5" cy="10" r="1" fill="#9E9D24" />
    {/* Outer ring (partial) */}
    <circle cx="12" cy="5" r="0.8" fill="#9E9D24" />
    <circle cx="16" cy="6.5" r="0.8" fill="#9E9D24" />
    <circle cx="18" cy="10" r="0.8" fill="#9E9D24" />
    <circle cx="18" cy="14" r="0.8" fill="#9E9D24" />
    <circle cx="16" cy="17.5" r="0.8" fill="#9E9D24" />
    <circle cx="12" cy="19" r="0.8" fill="#9E9D24" />
    <circle cx="8" cy="17.5" r="0.8" fill="#9E9D24" />
    <circle cx="6" cy="14" r="0.8" fill="#9E9D24" />
    <circle cx="6" cy="10" r="0.8" fill="#9E9D24" />
    <circle cx="8" cy="6.5" r="0.8" fill="#9E9D24" />
  </svg>
)

// ============================================================================
// STATIONERY ICONS
// ============================================================================

const PencilIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <rect x="10" y="5" width="4" height="12" fill="#FFC107" stroke="#B8860B" strokeWidth="0.5" />
    <polygon points="10,17 12,22 14,17" fill="#795548" stroke="#4E342E" strokeWidth="0.3" />
    <polygon points="11,19 12,22 13,19" fill="#212121" />
    <rect x="9.5" y="3" width="5" height="2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.3" />
    <path d="M10 3 L10 1.5 Q12 0.5 14 1.5 L14 3" fill="#E91E63" stroke="#C2185B" strokeWidth="0.3" />
  </svg>
)

const PenIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Main pen body */}
    <rect x="10.5" y="3" width="3" height="14" fill="#1565C0" stroke="#0D47A1" strokeWidth="0.5" />
    {/* Tip section */}
    <polygon points="10.5,17 13.5,17 13,20 11,20" fill="#1976D2" stroke="#0D47A1" strokeWidth="0.3" />
    {/* Metal tip */}
    <polygon points="11,20 12,23 13,20" fill="#9E9E9E" stroke="#616161" strokeWidth="0.3" />
    {/* Clip */}
    <path d="M13.5 5 L15 5 L15 11 L14 12 L14 11 L13.5 11" fill="#90CAF9" stroke="#1976D2" strokeWidth="0.3" />
    {/* Cap top */}
    <path d="M10.5 3 Q12 1 13.5 3" fill="#1565C0" stroke="#0D47A1" strokeWidth="0.3" />
  </svg>
)

const RulerIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Main ruler body */}
    <rect x="2" y="10" width="20" height="4" fill="#FFF9C4" stroke="#F9A825" strokeWidth="0.5" />
    {/* Measurement marks */}
    <g stroke="#212121" strokeWidth="0.5">
      <line x1="4" y1="14" x2="4" y2="12.5" />
      <line x1="6" y1="14" x2="6" y2="13" />
      <line x1="8" y1="14" x2="8" y2="13" />
      <line x1="10" y1="14" x2="10" y2="12.5" />
      <line x1="12" y1="14" x2="12" y2="13" />
      <line x1="14" y1="14" x2="14" y2="13" />
      <line x1="16" y1="14" x2="16" y2="12.5" />
      <line x1="18" y1="14" x2="18" y2="13" />
      <line x1="20" y1="14" x2="20" y2="13" />
    </g>
    {/* Edge line */}
    <line x1="2" y1="10.5" x2="22" y2="10.5" stroke="#F9A825" strokeWidth="0.3" />
  </svg>
)

const EraserIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Main eraser body */}
    <rect x="5" y="8" width="14" height="8" rx="1" fill="#E91E63" stroke="#AD1457" strokeWidth="0.5" />
    {/* Paper wrapper */}
    <rect x="5" y="8" width="5" height="8" rx="1" fill="#ECEFF1" stroke="#B0BEC5" strokeWidth="0.3" />
    {/* Brand area */}
    <rect x="6" y="10" width="3" height="4" fill="#1565C0" stroke="#0D47A1" strokeWidth="0.2" />
    {/* Highlight */}
    <line x1="5" y1="9" x2="19" y2="9" stroke="#FFCDD2" strokeWidth="0.5" />
  </svg>
)

// ============================================================================
// CONTAINER ICONS
// ============================================================================

const CupIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M6 5 L18 5 C17.5 12 17 18 16 19 L8 19 C7 18 6.5 12 6 5" fill="#ECEFF1" stroke="#546E7A" strokeWidth="1" />
    <path d="M17 7 C19 7 20 9 20 11 C20 13 19 15 17 15" fill="#ECEFF1" stroke="#546E7A" strokeWidth="1" />
    <path d="M7 6 L17 6 C16 8 16 8 7 8" fill="#4E342E" />
    <rect x="5.5" y="4" width="13" height="1.5" fill="#FFFFFF" stroke="#546E7A" strokeWidth="0.5" />
  </svg>
)

const BottleIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Main bottle body */}
    <path d="M8 8 L8 20 Q8 22 12 22 Q16 22 16 20 L16 8" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="0.5" />
    {/* Bottle neck */}
    <rect x="10" y="4" width="4" height="4" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="0.5" />
    {/* Cap */}
    <rect x="9.5" y="2" width="5" height="2" rx="0.5" fill="#1565C0" stroke="#0D47A1" strokeWidth="0.3" />
    {/* Label */}
    <rect x="9" y="11" width="6" height="5" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="0.3" />
  </svg>
)

const JarIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Main jar body */}
    <path d="M7 9 Q6 14 7 20 Q7 22 12 22 Q17 22 17 20 Q18 14 17 9" fill="#FFF8E1" stroke="#FFB74D" strokeWidth="0.5" />
    {/* Jar rim */}
    <path d="M7 9 L7 7 L6 7 L6 8 L18 8 L18 7 L17 7 L17 9" fill="#FFF8E1" stroke="#FFB74D" strokeWidth="0.3" />
    {/* Jar lid */}
    <path d="M6 8 L6 5 Q6 4 12 4 Q18 4 18 5 L18 8" fill="#8D6E63" stroke="#5D4037" strokeWidth="0.5" />
    {/* Lid top curve */}
    <ellipse cx="12" cy="4" rx="5" ry="1.5" fill="#8D6E63" stroke="#5D4037" strokeWidth="0.3" />
  </svg>
)

const BoxIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Back flap */}
    <path d="M7 8 L7 4 L17 4 L17 8" fill="#D7CCC8" stroke="#8D6E63" strokeWidth="0.3" />
    {/* Main box body */}
    <rect x="5" y="8" width="14" height="12" fill="#D7CCC8" stroke="#8D6E63" strokeWidth="0.5" />
    {/* Left flap */}
    <polygon points="5,8 3,5 8,5 12,8" fill="#BCAAA4" stroke="#8D6E63" strokeWidth="0.3" />
    {/* Right flap */}
    <polygon points="19,8 21,5 16,5 12,8" fill="#BCAAA4" stroke="#8D6E63" strokeWidth="0.3" />
    {/* Tape */}
    <rect x="10" y="8" width="4" height="8" fill="#FFCC80" stroke="#FFA726" strokeWidth="0.2" />
  </svg>
)

// ============================================================================
// ELECTRONICS ICONS
// ============================================================================

const PhoneIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <rect x="7" y="2" width="10" height="20" rx="2" fill="#ECEFF1" stroke="#90A4AE" strokeWidth="1" />
    <rect x="8" y="4" width="8" height="14" rx="1" fill="#263238" stroke="#37474F" strokeWidth="0.5" />
    <line x1="10" y1="20" x2="14" y2="20" stroke="#90A4AE" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const LaptopIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Screen */}
    <rect x="4" y="3" width="16" height="11" rx="1" fill="#78909C" stroke="#455A64" strokeWidth="0.5" />
    {/* Display */}
    <rect x="5" y="4" width="14" height="9" fill="#263238" stroke="#1A1A1A" strokeWidth="0.3" />
    {/* Base */}
    <path d="M3 14 L21 14 L22 16 L2 16 Z" fill="#78909C" stroke="#455A64" strokeWidth="0.5" />
    {/* Keyboard */}
    <rect x="5" y="14.5" width="14" height="1" fill="#37474F" stroke="#263238" strokeWidth="0.2" />
    {/* Camera */}
    <circle cx="12" cy="4.5" r="0.5" fill="#1A1A1A" />
  </svg>
)

const HeadphonesIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Headband */}
    <path d="M5 13 Q5 4 12 4 Q19 4 19 13" fill="none" stroke="#212121" strokeWidth="3" />
    {/* Inner band */}
    <path d="M6 13 Q6 6 12 6 Q18 6 18 13" fill="none" stroke="#424242" strokeWidth="1" />
    {/* Left ear cup */}
    <ellipse cx="5" cy="15" rx="3" ry="4" fill="#212121" stroke="#000000" strokeWidth="0.5" />
    {/* Right ear cup */}
    <ellipse cx="19" cy="15" rx="3" ry="4" fill="#212121" stroke="#000000" strokeWidth="0.5" />
    {/* Left cushion */}
    <ellipse cx="5" cy="15" rx="2" ry="3" fill="#424242" stroke="#212121" strokeWidth="0.3" />
    {/* Right cushion */}
    <ellipse cx="19" cy="15" rx="2" ry="3" fill="#424242" stroke="#212121" strokeWidth="0.3" />
  </svg>
)

const CameraIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    {/* Camera body */}
    <rect x="3" y="8" width="18" height="11" rx="1" fill="#263238" stroke="#1A1A1A" strokeWidth="0.5" />
    {/* Viewfinder bump */}
    <rect x="8" y="5" width="6" height="3" fill="#263238" stroke="#1A1A1A" strokeWidth="0.3" />
    {/* Flash */}
    <rect x="4" y="5" width="3" height="3" fill="#ECEFF1" stroke="#B0BEC5" strokeWidth="0.3" />
    {/* Lens outer */}
    <circle cx="12" cy="13" r="4.5" fill="#37474F" stroke="#263238" strokeWidth="0.5" />
    {/* Lens inner */}
    <circle cx="12" cy="13" r="3" fill="#455A64" stroke="#37474F" strokeWidth="0.3" />
    {/* Lens glass */}
    <circle cx="12" cy="13" r="1.5" fill="#1A237E" stroke="#0D47A1" strokeWidth="0.2" />
    {/* Shutter button */}
    <rect x="16" y="5" width="2" height="2" fill="#424242" stroke="#212121" strokeWidth="0.2" />
  </svg>
)

// ============================================================================
// OBJECT SHAPE DEFINITIONS
// ============================================================================

export const OBJECTS_SHAPES: CompositeShapeDefinition[] = [
  // Sports
  {
    id: 'object-ball',
    name: 'Ball',
    category: 'objects',
    group: 'sports',
    icon: BallIcon,
    generator: generateBall,
    isComposite: true,
  },
  {
    id: 'object-basketball',
    name: 'Basketball',
    category: 'objects',
    group: 'sports',
    icon: BasketballIcon,
    generator: generateBasketball,
    isComposite: true,
  },
  {
    id: 'object-soccer-ball',
    name: 'Soccer Ball',
    category: 'objects',
    group: 'sports',
    icon: SoccerBallIcon,
    generator: generateSoccerBall,
    isComposite: true,
  },
  {
    id: 'object-tennis-ball',
    name: 'Tennis Ball',
    category: 'objects',
    group: 'sports',
    icon: TennisBallIcon,
    generator: generateTennisBall,
    isComposite: true,
  },
  {
    id: 'object-pickleball',
    name: 'Pickleball',
    category: 'objects',
    group: 'sports',
    icon: PickleballIcon,
    generator: generatePickleball,
    isComposite: true,
  },
  // Stationery
  {
    id: 'object-pencil',
    name: 'Pencil',
    category: 'objects',
    group: 'stationery',
    icon: PencilIcon,
    generator: generatePencil,
    isComposite: true,
  },
  {
    id: 'object-pen',
    name: 'Pen',
    category: 'objects',
    group: 'stationery',
    icon: PenIcon,
    generator: generatePen,
    isComposite: true,
  },
  {
    id: 'object-ruler',
    name: 'Ruler',
    category: 'objects',
    group: 'stationery',
    icon: RulerIcon,
    generator: generateRuler,
    isComposite: true,
  },
  {
    id: 'object-eraser',
    name: 'Eraser',
    category: 'objects',
    group: 'stationery',
    icon: EraserIcon,
    generator: generateEraser,
    isComposite: true,
  },
  // Containers
  {
    id: 'object-cup',
    name: 'Coffee Cup',
    category: 'objects',
    group: 'containers',
    icon: CupIcon,
    generator: generateCup,
    isComposite: true,
  },
  {
    id: 'object-bottle',
    name: 'Bottle',
    category: 'objects',
    group: 'containers',
    icon: BottleIcon,
    generator: generateBottle,
    isComposite: true,
  },
  {
    id: 'object-jar',
    name: 'Jar',
    category: 'objects',
    group: 'containers',
    icon: JarIcon,
    generator: generateJar,
    isComposite: true,
  },
  {
    id: 'object-box',
    name: 'Box',
    category: 'objects',
    group: 'containers',
    icon: BoxIcon,
    generator: generateBox,
    isComposite: true,
  },
  // Electronics
  {
    id: 'object-phone',
    name: 'Smartphone',
    category: 'objects',
    group: 'electronics',
    icon: PhoneIcon,
    generator: generatePhone,
    isComposite: true,
  },
  {
    id: 'object-laptop',
    name: 'Laptop',
    category: 'objects',
    group: 'electronics',
    icon: LaptopIcon,
    generator: generateLaptop,
    isComposite: true,
  },
  {
    id: 'object-headphones',
    name: 'Headphones',
    category: 'objects',
    group: 'electronics',
    icon: HeadphonesIcon,
    generator: generateHeadphones,
    isComposite: true,
  },
  {
    id: 'object-camera',
    name: 'Camera',
    category: 'objects',
    group: 'electronics',
    icon: CameraIcon,
    generator: generateCamera,
    isComposite: true,
  },
]
