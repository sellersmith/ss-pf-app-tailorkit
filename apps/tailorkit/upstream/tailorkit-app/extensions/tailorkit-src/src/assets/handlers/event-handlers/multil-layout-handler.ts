import type { TailorKitProductPersonalizer } from '../../components/product-personalizer'
import { Transmitter } from '../../libraries/transmitter'
import { handleMultiLayoutOptionChange } from '../optionHandlers'
import { findViewAndSwitchTo } from '../../utils/query-views'

export const handleMultiLayoutOptionClick = async (target: HTMLElement, instance: TailorKitProductPersonalizer) => {
  // Try to find the nearest fieldset from the clicked element (works for inline option-lists)
  let fieldset = target.closest('fieldset') as HTMLFieldSetElement | null
  let optionSet = target.closest('.emtlkit--option-set') as HTMLElement | null

  // When options live inside a Popover they are appended to <body>, so the lookup above fails.
  // In that case fall back to locating the web-component that owns the option-set by using the
  // identifiers we placed on each option element.
  if (!fieldset) {
    const popoverElement = target.closest('.emtlkit--popover') as HTMLElement | null

    if (popoverElement) {
      // Find the trigger that controls this popover
      const triggerSelector = `[aria-controls="${popoverElement.id}"]`
      const trigger = instance.querySelector(triggerSelector) as HTMLElement | null

      if (trigger) {
        fieldset = trigger.closest('fieldset') as HTMLFieldSetElement | null
        optionSet = trigger.closest('.emtlkit--option-set') as HTMLElement | null
      }
    }
  }

  if (!fieldset) {
    console.warn('[TailorKit] handleMultiLayoutOptionClick: Unable to resolve fieldset for', target)
    return
  }

  const printAreaId = fieldset.getAttribute('data-print-area-id')

  const layers = instance.productPersonalizer.lis?.find(li => li.data.printAreaId === printAreaId)?.data?.ls || []

  await handleMultiLayoutOptionChange(
    target,
    fieldset,
    optionSet as HTMLElement,
    instance.renderCanvas.bind(instance),
    instance.updateFieldset,
    layers
  )

  // Find and switch to the appropriate view for this layer
  findViewAndSwitchTo(instance, fieldset)

  // Listen for completion of multi-layout processing before re-initializing
  const handleMultiLayoutComplete = () => {
    // Re-init print area and event handlers
    instance.initPrintArea()
    instance.initEventHandlers()

    // Remove the event listener after execution
    Transmitter.remove('tailorkit-multi-layout-complete', handleMultiLayoutComplete)
  }

  // Add event listener for multi-layout completion
  Transmitter.listen('tailorkit-multi-layout-complete', handleMultiLayoutComplete)
}
