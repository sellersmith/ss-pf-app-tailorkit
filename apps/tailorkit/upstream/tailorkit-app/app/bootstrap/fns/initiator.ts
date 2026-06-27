/**
 * Manages and executes application initialization functions
 * @class Initiator
 */
export class Initiator {
  private readonly initiators: Array<() => void | Promise<void>> = []
  private isInitialized = false

  /**
   * Adds an initialization function to be executed during startup
   * @param initiator - An (async) function to be executed during initialization
   * @throws {Error} If initialization has already occurred
   */
  public addInitiator(initiator: () => void | Promise<void>): void {
    if (this.isInitialized) {
      console.warn(`Cannot add initiator after initialization has started, ${initiator.name}`)
    }
    this.initiators.push(initiator)
  }

  /**
   * Executes all registered initialization functions in sequence
   * @returns {Promise<void>}
   */
  public async init(): Promise<void> {
    try {
      if (this.isInitialized) {
        throw new Error('Initialization has already been performed')
      }

      console.log(`Starting initialization with ${this.initiators.length} initiators...`)
      const startTime = performance.now()

      for (let i = 0; i < this.initiators.length; i++) {
        const initiator = this.initiators[i]
        const initiatorStartTime = performance.now()

        try {
          console.log(`Running initiator ${i + 1} of ${this.initiators.length}: ${initiator.name}`)

          // Run initiator
          await initiator()

          console.log(
            `Completed initiator ${initiator.name} in ${Math.round(performance.now() - initiatorStartTime)}ms`
          )
        } catch (error) {
          console.error(`Failed to run initiator ${i + 1} of ${this.initiators.length}: ${initiator.name}`, error)
          // Depending on requirements, you might want to throw here instead of continuing
          continue
        }
      }

      this.isInitialized = true
      console.log(`Initialization completed in ${Math.round(performance.now() - startTime)}ms`)
    } catch (error) {
      console.error('Error during initialization:', error)
    }
  }
}

export const serverInitiator = new Initiator()
