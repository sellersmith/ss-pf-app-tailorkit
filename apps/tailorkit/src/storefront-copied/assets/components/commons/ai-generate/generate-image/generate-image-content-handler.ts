import type { PopoverOptions } from '../../popover'
import { Popover } from '../../popover'
import { POSITIONS } from '../../popover/constants'

/**
 * Interface for GenerateImageContentAction options
 */
export interface GenerateImageContentOptions {
  triggerElement: HTMLElement
  popoverElement: HTMLElement
  popoverOptions?: PopoverOptions
  cleanupEventListeners?: () => void
}

/**
 * Default options for the GenerateImageContentAction
 */
const DEFAULT_OPTIONS: Required<
  Omit<GenerateImageContentOptions, 'triggerElement' | 'popoverElement' | 'cleanupEventListeners'>
> = {
  popoverOptions: {
    position: POSITIONS.BOTTOM,
  },
}

/**
 * Class that handles AI image generation content functionality
 */
export class GenerateImageContentAction {
  private options: GenerateImageContentOptions
  private popover: Popover | null = null

  /**
   * @param options Configuration options for the image generation action
   */
  constructor(options: GenerateImageContentOptions) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      popoverOptions: {
        ...DEFAULT_OPTIONS.popoverOptions,
        ...options.popoverOptions,
      },
    }

    this.init()
  }

  /**
   * Initialize the component
   */
  private init(): void {
    this.setupPopover()
  }

  /**
   * Set up the popover component
   */
  private setupPopover(): void {
    if (this.popover) return

    const { triggerElement, popoverElement, popoverOptions } = this.options

    const mergedOptions = {
      ...popoverOptions,
      content: popoverElement,
    }

    this.popover = new Popover(triggerElement, mergedOptions)
  }

  /**
   * Open the popover
   */
  public openPopover(): void {
    if (this.popover) {
      this.popover.open()
    }
  }

  /**
   * Close the popover
   */
  public closePopover(): void {
    if (this.popover) {
      this.popover.close()
      this.options.cleanupEventListeners?.()
    }
  }

  /**
   * Toggle the popover
   */
  public togglePopover(): void {
    if (this.popover) {
      this.popover.toggle()
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.popover) {
      this.popover.destroy()
      this.popover = null
    }
  }
}
