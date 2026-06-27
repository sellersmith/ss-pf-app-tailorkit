import Tooltip from './index'
import type { TooltipOptions } from './types'

/**
 * Tooltip utility functions for managing instances and preventing memory leaks
 */
export class TooltipManager {
  /**
   * Create or update a tooltip for an element
   * Automatically handles existing instances to prevent memory leaks
   */
  static createOrUpdate(element: HTMLElement, options: TooltipOptions): Tooltip {
    return Tooltip.create(element, options)
  }

  /**
   * Get existing tooltip instance for an element
   */
  static getInstance(element: HTMLElement): Tooltip | undefined {
    return Tooltip.getInstance(element)
  }

  /**
   * Destroy tooltip for a specific element
   */
  static destroy(element: HTMLElement): boolean {
    return Tooltip.destroyInstance(element)
  }

  /**
   * Check if element has a tooltip
   */
  static hasTooltip(element: HTMLElement): boolean {
    return Tooltip.getInstance(element) !== undefined
  }

  /**
   * Update tooltip content without recreating the instance
   */
  static updateContent(element: HTMLElement, content: string): boolean {
    const instance = Tooltip.getInstance(element)
    if (instance) {
      instance.updateContent(content)
      return true
    }
    return false
  }

  /**
   * Enable/disable tooltip for an element
   */
  static setEnabled(element: HTMLElement, enabled: boolean): boolean {
    const instance = Tooltip.getInstance(element)
    if (instance) {
      if (enabled) {
        instance.enable()
      } else {
        instance.disable()
      }
      return true
    }
    return false
  }

  /**
   * Batch create tooltips for multiple elements
   */
  static createBatch(
    elements: HTMLElement[],
    options: TooltipOptions | ((element: HTMLElement) => TooltipOptions)
  ): Tooltip[] {
    return elements.map(element => {
      const elementOptions = typeof options === 'function' ? options(element) : options
      return TooltipManager.createOrUpdate(element, elementOptions)
    })
  }

  /**
   * Batch destroy tooltips for multiple elements
   */
  static destroyBatch(elements: HTMLElement[]): boolean[] {
    return elements.map(element => TooltipManager.destroy(element))
  }

  /**
   * Clean up tooltips for elements that are no longer in the DOM
   * Note: With WeakMap, this happens automatically, but this method
   * can be used for explicit cleanup if needed
   */
  static cleanupDetachedElements(elements: HTMLElement[]): number {
    let cleaned = 0
    elements.forEach(element => {
      if (!document.contains(element)) {
        if (TooltipManager.destroy(element)) {
          cleaned++
        }
      }
    })
    return cleaned
  }
}

/**
 * Convenience function for creating tooltips
 */
export function createTooltip(element: HTMLElement, options: TooltipOptions): Tooltip {
  return TooltipManager.createOrUpdate(element, options)
}

/**
 * Convenience function for destroying tooltips
 */
export function destroyTooltip(element: HTMLElement): boolean {
  return TooltipManager.destroy(element)
}

/**
 * Base class for automatic tooltip cleanup
 * Extend this class to get automatic tooltip management
 */
export class TooltipMixin {
  private _tooltipElements: Set<HTMLElement> = new Set()

  addTooltip(element: HTMLElement, options: TooltipOptions): Tooltip {
    this._tooltipElements.add(element)
    return createTooltip(element, options)
  }

  removeTooltip(element: HTMLElement): boolean {
    this._tooltipElements.delete(element)
    return destroyTooltip(element)
  }

  cleanupTooltips(): void {
    // Clean up all tooltips
    this._tooltipElements.forEach(element => {
      destroyTooltip(element)
    })
    this._tooltipElements.clear()
  }

  destroy(): void {
    this.cleanupTooltips()
  }
}
