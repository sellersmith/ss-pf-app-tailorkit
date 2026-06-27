/**
 * Western Zodiac Sign Shape Generators
 * Generates zodiac symbol shapes
 */

import { generateAriesCartoon } from './aries'
import { generateTaurusCartoon } from './taurus'
import { generateGeminiCartoon } from './gemini'
import { generateCancerCartoon } from './cancer'
import { generateLeoCartoon } from './leo'
import { generateVirgoCartoon } from './virgo'
import { generateLibraCartoon } from './libra'
import { generateScorpioCartoon } from './scorpio'
import { generateSagittariusCartoon } from './sagittarius'
import { generateCapricornCartoon } from './capricorn'
import { generateAquariusCartoon } from './aquarius'
import { generatePiscesCartoon } from './pisces'

// Re-export all sign generators
export {
  generateAriesCartoon,
  generateTaurusCartoon,
  generateGeminiCartoon,
  generateCancerCartoon,
  generateLeoCartoon,
  generateVirgoCartoon,
  generateLibraCartoon,
  generateScorpioCartoon,
  generateSagittariusCartoon,
  generateCapricornCartoon,
  generateAquariusCartoon,
  generatePiscesCartoon,
}

export const zodiacSignGenerators = {
  aries: { cartoon: generateAriesCartoon },
  taurus: { cartoon: generateTaurusCartoon },
  gemini: { cartoon: generateGeminiCartoon },
  cancer: { cartoon: generateCancerCartoon },
  leo: { cartoon: generateLeoCartoon },
  virgo: { cartoon: generateVirgoCartoon },
  libra: { cartoon: generateLibraCartoon },
  scorpio: { cartoon: generateScorpioCartoon },
  sagittarius: { cartoon: generateSagittariusCartoon },
  capricorn: { cartoon: generateCapricornCartoon },
  aquarius: { cartoon: generateAquariusCartoon },
  pisces: { cartoon: generatePiscesCartoon },
} as const
