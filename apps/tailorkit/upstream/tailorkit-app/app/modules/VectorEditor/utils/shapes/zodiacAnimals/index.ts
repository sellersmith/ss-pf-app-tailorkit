/**
 * Chinese Zodiac Animal Shape Generators
 * Generates Chinese zodiac animal shapes
 */

import { generateRatCartoon } from './rat'
import { generateOxCartoon } from './ox'
import { generateTigerCartoon } from './tiger'
import { generateRabbitCartoon } from './rabbit'
import { generateDragonCartoon } from './dragon'
import { generateSnakeCartoon } from './snake'
import { generateHorseCartoon } from './horse'
import { generateGoatCartoon } from './goat'
import { generateMonkeyCartoon } from './monkey'
import { generateRoosterCartoon } from './rooster'
import { generateDogCartoon } from './dog'
import { generatePigCartoon } from './pig'

// Re-export all animal generators
export {
  generateRatCartoon,
  generateOxCartoon,
  generateTigerCartoon,
  generateRabbitCartoon,
  generateDragonCartoon,
  generateSnakeCartoon,
  generateHorseCartoon,
  generateGoatCartoon,
  generateMonkeyCartoon,
  generateRoosterCartoon,
  generateDogCartoon,
  generatePigCartoon,
}

export const zodiacAnimalGenerators = {
  rat: { cartoon: generateRatCartoon },
  ox: { cartoon: generateOxCartoon },
  tiger: { cartoon: generateTigerCartoon },
  rabbit: { cartoon: generateRabbitCartoon },
  dragon: { cartoon: generateDragonCartoon },
  snake: { cartoon: generateSnakeCartoon },
  horse: { cartoon: generateHorseCartoon },
  goat: { cartoon: generateGoatCartoon },
  monkey: { cartoon: generateMonkeyCartoon },
  rooster: { cartoon: generateRoosterCartoon },
  dog: { cartoon: generateDogCartoon },
  pig: { cartoon: generatePigCartoon },
} as const
