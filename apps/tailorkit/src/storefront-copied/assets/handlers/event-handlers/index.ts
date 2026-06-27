import type { TailorKitProductPersonalizer } from '../../components/product-personalizer'
import { TEXT_SHAPE_OPTIONS } from '../../constants/shape'
import { Transmitter } from '../../libraries/transmitter'
import { handleImageOptionDelete, handleOptionSetClick, saveToLocalStorage } from '../optionHandlers'
import { applyStyleCase } from '../../utils/render-text-layer-to-data-source'
import { getLayerByFieldset } from '../../utils/query-layer'
import { CLASS_EXCLUDE_INPUT_HANDLER } from '../../utils/dom-constants'
import { TEXT_CUSTOMER_INPUT_SELECTOR } from '../../utils/selectors'
import { findViewAndSwitchTo } from '../../utils/query-views'
import { StorefrontUndoStack } from '../../stores/storefront-undo-stack'

/**
 * Sets up input event listeners for text input fields within the TailorKit product personalizer.
 *
 * This function attaches input event handlers to each provided input field, handling:
 * - Value transformation based on the associated layer's styleCase (e.g., uppercase, lowercase, etc.)
 * - Enforcing maximum character length and updating the character counter UI
 * - Persisting the updated value to local storage and the fieldset's value attribute
 * - Debounced canvas re-rendering and option state update via the Transmitter
 *
 * Returns methods to initialize and clean up the event listeners.
 *
 * @param {NodeListOf<Element>} inputFields - The collection of input elements to attach listeners to
 * @param {TailorKitProductPersonalizer} element - The product personalizer instance for context
 * @returns {{
 *   initTextInputEventHandlers: () => void,
 *   cleanUpTextInputEventHandlers: () => void
 * }}
 */
export const setupTextInputListeners = (element: TailorKitProductPersonalizer) => {
  let timers: Record<string, any> = {}
  // Stores the fieldset value captured at the FIRST keystroke of each debounce window.
  // Keyed by the same timerKey used for the debounce timer.
  const beforeTextValues: Record<string, string> = {}

  const handleTextInput = (target: HTMLInputElement | HTMLTextAreaElement) => {
    // ── Compute fieldset + layerId early (needed for timerKey + beforeValue capture) ──
    const updatedFieldset = target.closest('fieldset') as HTMLFieldSetElement | null
    const layerId = updatedFieldset?.getAttribute('data-layer-id') || ''
    const timerKey = target.name || `${layerId}#text`

    // Capture the CURRENT value as "before" only on the first keystroke of a
    // debounce window (i.e., before any timer is running for this key).
    if (!timers[timerKey]) {
      beforeTextValues[timerKey] = updatedFieldset?.getAttribute('value') ?? ''
    }

    // Clear existing debounce timer
    clearTimeout(timers[timerKey])

    const [, maxLengthRaw] = (target.nextElementSibling?.textContent?.split('/') || [0, 0]).map(Number)
    const maxLength
      = Number.isFinite(maxLengthRaw) && maxLengthRaw > 0 ? maxLengthRaw : Number(target.maxLength) || 9999
    let value = target.value

    // Get corresponding layer styleCase and transform value immediately
    const fieldset = target.closest('fieldset') as HTMLFieldSetElement | null
    if (fieldset) {
      const { layer } = getLayerByFieldset(element, fieldset)
      const styleCase = (layer?.s as any)?.styleCase as string | undefined
      value = applyStyleCase(value, styleCase)
    }

    if (target.value.length > maxLength) {
      value = target.value.substring(0, maxLength)
      target.value = value
    }

    // Update target value and related fieldset/local storage
    if (updatedFieldset) {
      // Reflect transformed value in input field
      target.value = value
      updatedFieldset.setAttribute('value', value)
      // Update value on the text customer input element
      // This ensures the value persists when the element is moved (e.g., modal open/close)
      const textCustomerInput = updatedFieldset.querySelector('tailorkit-text-customer-input')
      if (textCustomerInput) {
        textCustomerInput.setAttribute('value', value)
      }

      saveToLocalStorage(updatedFieldset, target as HTMLInputElement)
    }

    if (target.nextElementSibling) {
      target.nextElementSibling.textContent = `${value.length}/${maxLength}`
    }

    timers[timerKey] = setTimeout(async () => {
      // Push CONTENT delta for undo/redo support
      const beforeVal = beforeTextValues[timerKey] ?? ''
      const afterVal = updatedFieldset?.getAttribute('value') ?? ''

      if (layerId && beforeVal !== afterVal) {
        const snapFieldset = updatedFieldset // fieldset stays in DOM across canvas re-renders

        /** Restores visible text in all input/textarea/web-component representations */
        const restoreTextUI = (val: string) => {
          if (!snapFieldset) return

          // 1. Fieldset value attr (read by renderCanvas)
          snapFieldset.setAttribute('value', val)

          // 2. Actual <input>/<textarea> in light DOM (if not shadow DOM)
          const inp = snapFieldset.querySelector(TEXT_CUSTOMER_INPUT_SELECTOR) as HTMLInputElement | null
          if (inp) {
            inp.value = val
            inp.setAttribute('value', val)
            // Dispatch input event so any listeners (e.g. character counter) update
            inp.dispatchEvent(new Event('input', { bubbles: true }))
          }

          // 3. tailorkit-text-customer-input web component
          const wc = snapFieldset.querySelector('tailorkit-text-customer-input') as
            | (HTMLElement & { value?: string })
            | null
          if (wc) {
            // Try both attribute and property (some WC implementations use one or the other)
            wc.setAttribute('value', val)
            if ('value' in wc) (wc as any).value = val
          }

          // 4. Re-render canvas with restored value
          element.renderCanvas().then(() => Transmitter.trigger('tailorkit-set-options'))
        }

        StorefrontUndoStack.push({
          type: 'CONTENT',
          layerId,
          before: {},
          after: {},
          undoFn: () => restoreTextUI(beforeVal),
          redoFn: () => restoreTextUI(afterVal),
        })
      }

      delete beforeTextValues[timerKey]
      delete timers[timerKey]

      // Find and switch to the appropriate view for this text layer
      findViewAndSwitchTo(element, updatedFieldset)
      await element.renderCanvas()
      Transmitter.trigger('tailorkit-set-options')
    }, 200)
  }

  // Root-level delegated input handler ensures we catch events from dynamically added inputs (e.g., modal clone)
  const rootInputHandler = (e: Event) => {
    const tgt = e.target as Element | null
    if (!tgt) return

    // Skip inputs inside excluded containers (e.g., AI generator inputs that don't affect canvas state)
    if (tgt.closest(`.${CLASS_EXCLUDE_INPUT_HANDLER}`)) return

    const matched = (node: Element) => node.matches?.(TEXT_CUSTOMER_INPUT_SELECTOR)
    const input = (matched(tgt) ? tgt : tgt.closest?.(TEXT_CUSTOMER_INPUT_SELECTOR)) as
      | (HTMLInputElement & Element)
      | (HTMLTextAreaElement & Element)
      | null

    if (input) {
      handleTextInput(input)
    }
  }

  function initTextInputEventHandlers() {
    // Attach delegated handler once on the component root
    element.addEventListener('input', rootInputHandler)
  }

  function cleanUpTextInputEventHandlers() {
    timers = {}
    element.removeEventListener('input', rootInputHandler)
  }

  return {
    initTextInputEventHandlers,
    cleanUpTextInputEventHandlers,
  }
}

// Init select options for text shape
export const setUpTextShapeSelectOption = () => {
  function initTextShapeSelectOptionHandler() {
    const selectInputs = document.querySelectorAll('.emtlkit--select-input') as NodeListOf<HTMLButtonElement>
    const selectInputPopovers = document.querySelectorAll(
      '.emtlkit--select-input__popover'
    ) as NodeListOf<HTMLDivElement>

    selectInputs.forEach(selectInput => {
      // Toggle popover visibility on button click
      selectInput.addEventListener('click', function () {
        const fieldset = selectInput.closest('fieldset')

        if (!fieldset) return

        // Query popover container
        const selectInputPopover = fieldset.querySelector(
          `.emtlkit--text-shape.emtlkit--select-input__popover`
        ) as HTMLDivElement | null

        if (selectInputPopover) {
          ;[...selectInputPopovers]
            .filter(popover => popover !== selectInputPopover)
            .forEach(popover => {
              popover.style.display = 'none'
            })

          const display = selectInputPopover.style.display
          selectInputPopover.style.display = display === 'block' ? 'none' : 'block'
        }
      })
    })

    selectInputPopovers.forEach(selectInputPopover => {
      TEXT_SHAPE_OPTIONS.forEach(option => {
        const optionHTML = `<label class="emtlkit--select-option" data-selection="text-shape">
                  <input type="radio" name="shape" value="${option.value}">
                  <div class="emtlkit--select-option__thumbnail">
                    ${option.thumbnail && `<img src="${option.thumbnail}" alt="${option.label} image" loading="lazy"/>`}
                  </div>
                  <span>${option.label}</span>
                </label>`
        selectInputPopover.insertAdjacentHTML('beforeend', optionHTML)
      })
    })

    // Hide popover when clicking outside
    document.addEventListener('click', function (event: any) {
      const containedSelectInput = event.target.classList.contains('emtlkit--select-input')
      const containedSelectInputPopover = event.target.classList.contains('emtlkit--select-input__popover')

      if (!containedSelectInput && !containedSelectInputPopover) {
        selectInputPopovers.forEach(popover => {
          popover.style.display = 'none'
        })
      }
    })
  }

  function cleanUpTextShapeSelectOptionHandler() {
    const selectInputs = document.querySelectorAll('.emtlkit--select-input') as NodeListOf<HTMLButtonElement>

    selectInputs.forEach(selectInput => {
      // @ts-ignore
      selectInput.removeAllEventListeners()
    })
  }

  return {
    initTextShapeSelectOptionHandler,
    cleanUpTextShapeSelectOptionHandler,
  }
}

export const handleStandardOptionClick = async (target: HTMLElement, instance: TailorKitProductPersonalizer) => {
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
    console.warn('[TailorKit] handleStandardOptionClick: Unable to resolve fieldset for', target)
    return
  }

  await handleOptionSetClick(
    target,
    fieldset,
    optionSet as HTMLElement | undefined,
    instance.renderCanvas.bind(instance),
    instance.updateFieldset
  )

  // Find and switch to the appropriate view for this layer
  findViewAndSwitchTo(instance, fieldset)
}

export const handleDeleteImageOption = async (target: HTMLElement, instance: TailorKitProductPersonalizer) => {
  // Find the nearest fieldset from the clicked element
  const fieldset = target.closest('fieldset') as HTMLFieldSetElement | null

  if (!fieldset) {
    console.warn('[TailorKit] handleDeleteImageOption: Unable to resolve fieldset for', target)
    return
  }

  await handleImageOptionDelete(target, fieldset, instance, instance.renderCanvas.bind(instance))

  // Find and switch to the appropriate view for this layer
  findViewAndSwitchTo(instance, fieldset)
}
