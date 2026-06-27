/**
 * Seeded Random Number Generator
 *
 * Provides reproducible random numbers for consistent pattern generation.
 * Extracted from VectorEditor for reuse across modules.
 */

/**
 * Seeded PRNG using mulberry32 algorithm
 * Fast, good distribution, small state
 */
export function createSeededRandom(seed: number) {
  let state = seed

  return {
    /**
     * Get next random number between 0 and 1
     */
    next(): number {
      state |= 0
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },

    /**
     * Get random number in range [min, max]
     */
    range(min: number, max: number): number {
      return min + this.next() * (max - min)
    },

    /**
     * Get random integer in range [min, max] (inclusive)
     */
    int(min: number, max: number): number {
      return Math.floor(this.range(min, max + 1))
    },

    /**
     * Pick random element from array
     */
    pick<T>(array: T[]): T {
      return array[this.int(0, array.length - 1)]
    },

    /**
     * Shuffle array in place
     */
    shuffle<T>(array: T[]): T[] {
      for (let i = array.length - 1; i > 0; i--) {
        const j = this.int(0, i)
        ;[array[i], array[j]] = [array[j], array[i]]
      }
      return array
    },

    /**
     * Get random boolean with given probability of true
     */
    chance(probability: number = 0.5): boolean {
      return this.next() < probability
    },

    /**
     * Get random angle in radians
     */
    angle(): number {
      return this.next() * Math.PI * 2
    },

    /**
     * Get random point within a circle
     */
    pointInCircle(radius: number): { x: number; y: number } {
      const angle = this.angle()
      const r = Math.sqrt(this.next()) * radius
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      }
    },

    /**
     * Get random point within a rectangle
     */
    pointInRect(width: number, height: number): { x: number; y: number } {
      return {
        x: this.range(-width / 2, width / 2),
        y: this.range(-height / 2, height / 2),
      }
    },

    /**
     * Reset the generator to initial state
     */
    reset(newSeed?: number): void {
      state = newSeed ?? seed
    },

    /**
     * Get current seed
     */
    getSeed(): number {
      return seed
    },
  }
}

export type SeededRandom = ReturnType<typeof createSeededRandom>
