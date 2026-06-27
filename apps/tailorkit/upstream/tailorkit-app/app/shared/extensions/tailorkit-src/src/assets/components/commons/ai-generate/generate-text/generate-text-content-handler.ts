import type { PopoverOptions } from '../../popover'
import { Popover } from '../../popover'
import { POSITIONS } from '../../popover/constants'

/**
 * Interface for GenerateTextContentAction options
 */
export interface GenerateTextContentOptions {
  triggerElement: HTMLElement
  popoverElement: HTMLElement
  popoverOptions?: PopoverOptions
  cleanupEventListeners?: () => void
}

/**
 * Default options for the GenerateTextContentAction
 */
const DEFAULT_OPTIONS: Required<
  Omit<GenerateTextContentOptions, 'triggerElement' | 'popoverElement' | 'cleanupEventListeners'>
> = {
  popoverOptions: {
    position: POSITIONS.BOTTOM,
  },
}

/**
 * Class that handles AI text generation content functionality
 */
export class GenerateTextContentAction {
  private options: GenerateTextContentOptions
  private popover: Popover | null = null

  /**
   * @param options Configuration options for the text generation action
   */
  constructor(options: GenerateTextContentOptions) {
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
   * Setup the popover
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
   * Clean up resources when component is no longer needed
   */
  public destroy(): void {
    if (this.popover) {
      this.popover.destroy()
      this.popover = null
    }
  }
}
