/**
 * Pattern Shapes Constants
 * Icon components and shape definitions for pattern generators
 */

import type { FC } from 'react'
import type { PatternShapeDefinition, PatternConfig } from './shapes'
import {
  generatePatternPetals,
  generatePatternLeaves,
  generatePatternConfetti,
  generatePatternFireworks,
  PATTERN_COLORS,
} from '../utils/shapes/patterns'

// ============================================================================
// PATTERN ICONS
// ============================================================================

const PatternPetalsIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <g opacity="0.9">
      <ellipse cx="8" cy="6" rx="3" ry="5" fill="#FFCDD2" transform="rotate(-30 8 6)" />
      <ellipse cx="16" cy="8" rx="2.5" ry="4" fill="#F8BBD9" transform="rotate(20 16 8)" />
      <ellipse cx="6" cy="14" rx="2" ry="4" fill="#F48FB1" transform="rotate(-45 6 14)" />
      <ellipse cx="18" cy="16" rx="2.5" ry="4.5" fill="#FFCDD2" transform="rotate(40 18 16)" />
      <ellipse cx="12" cy="12" rx="3" ry="5" fill="#F06292" transform="rotate(10 12 12)" />
      <ellipse cx="10" cy="19" rx="2" ry="3.5" fill="#F8BBD9" transform="rotate(-15 10 19)" />
    </g>
  </svg>
)

const PatternLeavesIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <g opacity="0.9">
      <path d="M7 4c1 2 1 4 0 5s-2 1-3 0 0-3 1-4 2-2 2-1z" fill="#FF9800" transform="rotate(-20 7 7)" />
      <path d="M17 6c1 2 1 4 0 5s-2 1-3 0 0-3 1-4 2-2 2-1z" fill="#FFC107" transform="rotate(15 17 8)" />
      <path d="M5 14c1 2 1 4 0 5s-2 1-3 0 0-3 1-4 2-2 2-1z" fill="#F57C00" transform="rotate(-40 5 16)" />
      <path d="M19 14c1 2 1 4 0 5s-2 1-3 0 0-3 1-4 2-2 2-1z" fill="#FF9800" transform="rotate(30 19 16)" />
      <path d="M12 10c1 2 1 4 0 5s-2 1-3 0 0-3 1-4 2-2 2-1z" fill="#FFC107" transform="rotate(5 12 12)" />
      <path d="M10 18c1 1.5 1 3 0 4s-1.5 1-2 0 0-2.5 1-3 1-1.5 1-1z" fill="#FF9800" transform="rotate(-10 10 20)" />
    </g>
  </svg>
)

const PatternConfettiIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <rect x="4" y="3" width="3" height="5" fill="#F44336" transform="rotate(-15 5.5 5.5)" />
    <rect x="16" y="4" width="2.5" height="4" fill="#4CAF50" transform="rotate(20 17.25 6)" />
    <circle cx="10" cy="8" r="2" fill="#2196F3" />
    <rect x="7" y="14" width="2" height="4" fill="#FFEB3B" transform="rotate(-25 8 16)" />
    <rect x="14" y="12" width="3" height="5" fill="#9C27B0" transform="rotate(10 15.5 14.5)" />
    <circle cx="19" cy="18" r="1.5" fill="#FF9800" />
    <rect x="3" y="18" width="2.5" height="3.5" fill="#E91E63" transform="rotate(30 4.25 19.75)" />
    <circle cx="12" cy="19" r="1.8" fill="#00BCD4" />
  </svg>
)

const PatternFireworksIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <g transform="translate(12 12)">
      {/* Main burst rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <line
          key={angle}
          x1="0"
          y1="0"
          x2={Math.cos((angle * Math.PI) / 180) * 9}
          y2={Math.sin((angle * Math.PI) / 180) * 9}
          stroke={['#FFEB3B', '#FFC107', '#FFD54F', '#FFECB3'][i % 4]}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      {/* Scattered dots */}
      <circle cx="5" cy="-7" r="1.5" fill="#FFF59D" />
      <circle cx="-6" cy="-5" r="1" fill="#FFEE58" />
      <circle cx="7" cy="4" r="1.2" fill="#FFC107" />
      <circle cx="-5" cy="6" r="1.5" fill="#FFD54F" />
      {/* Center glow */}
      <circle cx="0" cy="0" r="2" fill="#FFFFFF" />
    </g>
  </svg>
)

// ============================================================================
// DEFAULT PATTERN CONFIGURATIONS
// ============================================================================

const DEFAULT_PETALS_CONFIG: PatternConfig = {
  count: 15,
  colors: [...PATTERN_COLORS.petals.pink],
  rotation: { min: 0, max: 360 },
  scale: { min: 0.6, max: 1.2 },
  distribution: 'random' as const,
}

const DEFAULT_LEAVES_CONFIG: PatternConfig = {
  count: 12,
  colors: [...PATTERN_COLORS.leaves.autumn],
  rotation: { min: -45, max: 45 },
  scale: { min: 0.5, max: 1.3 },
  distribution: 'random' as const,
}

const DEFAULT_CONFETTI_CONFIG: PatternConfig = {
  count: 25,
  colors: [...PATTERN_COLORS.confetti.rainbow],
  rotation: { min: -30, max: 30 },
  scale: { min: 0.6, max: 1.4 },
  distribution: 'random' as const,
}

const DEFAULT_FIREWORKS_CONFIG: PatternConfig = {
  count: 20,
  colors: [...PATTERN_COLORS.fireworks.gold],
  distribution: 'radial' as const,
}

// ============================================================================
// PATTERN SHAPE DEFINITIONS
// ============================================================================

export const PATTERN_SHAPES: PatternShapeDefinition[] = [
  {
    id: 'pattern-petals',
    name: 'Flower Petals',
    category: 'patterns',
    group: 'scatter',
    icon: PatternPetalsIcon,
    generator: generatePatternPetals,
    isPattern: true,
    defaultConfig: DEFAULT_PETALS_CONFIG,
  },
  {
    id: 'pattern-leaves',
    name: 'Falling Leaves',
    category: 'patterns',
    group: 'scatter',
    icon: PatternLeavesIcon,
    generator: generatePatternLeaves,
    isPattern: true,
    defaultConfig: DEFAULT_LEAVES_CONFIG,
  },
  {
    id: 'pattern-confetti',
    name: 'Confetti',
    category: 'patterns',
    group: 'scatter',
    icon: PatternConfettiIcon,
    generator: generatePatternConfetti,
    isPattern: true,
    defaultConfig: DEFAULT_CONFETTI_CONFIG,
  },
  {
    id: 'pattern-fireworks',
    name: 'Fireworks',
    category: 'patterns',
    group: 'burst',
    icon: PatternFireworksIcon,
    generator: generatePatternFireworks,
    isPattern: true,
    defaultConfig: DEFAULT_FIREWORKS_CONFIG,
  },
]
