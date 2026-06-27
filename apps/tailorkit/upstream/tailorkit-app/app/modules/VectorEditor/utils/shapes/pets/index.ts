/**
 * Common Pets Shape Generators
 * Generates common pet animal shapes
 */

import { generateDogCartoon } from './dog'
import { generateCatCartoon } from './cat'
import { generateRabbitCartoon } from './rabbit'
import { generateHamsterCartoon } from './hamster'
import { generateBirdCartoon } from './bird'
import { generateParrotCartoon } from './parrot'
import { generateOwlCartoon } from './owl'
import { generateDuckCartoon } from './duck'
import { generateFishCartoon } from './fish'
import { generateGoldfishCartoon } from './goldfish'
import { generateDolphinCartoon } from './dolphin'
import { generateCrabCartoon } from './crab'
import { generateTurtleCartoon } from './turtle'
import { generateLizardCartoon } from './lizard'
import { generateSnakeCartoon } from './snake'
import { generateFrogCartoon } from './frog'

// Re-export all pet generators
export {
  generateDogCartoon,
  generateCatCartoon,
  generateRabbitCartoon,
  generateHamsterCartoon,
  generateBirdCartoon,
  generateParrotCartoon,
  generateOwlCartoon,
  generateDuckCartoon,
  generateFishCartoon,
  generateGoldfishCartoon,
  generateDolphinCartoon,
  generateCrabCartoon,
  generateTurtleCartoon,
  generateLizardCartoon,
  generateSnakeCartoon,
  generateFrogCartoon,
}

export const petGenerators = {
  dog: { cartoon: generateDogCartoon },
  cat: { cartoon: generateCatCartoon },
  rabbit: { cartoon: generateRabbitCartoon },
  hamster: { cartoon: generateHamsterCartoon },
  bird: { cartoon: generateBirdCartoon },
  parrot: { cartoon: generateParrotCartoon },
  owl: { cartoon: generateOwlCartoon },
  duck: { cartoon: generateDuckCartoon },
  fish: { cartoon: generateFishCartoon },
  goldfish: { cartoon: generateGoldfishCartoon },
  dolphin: { cartoon: generateDolphinCartoon },
  crab: { cartoon: generateCrabCartoon },
  turtle: { cartoon: generateTurtleCartoon },
  lizard: { cartoon: generateLizardCartoon },
  snake: { cartoon: generateSnakeCartoon },
  frog: { cartoon: generateFrogCartoon },
} as const
