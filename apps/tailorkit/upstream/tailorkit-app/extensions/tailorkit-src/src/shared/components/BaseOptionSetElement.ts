import { getOptionSetLocalStorageKey } from '../../assets/utils/restore-option-values'
import type { IOptionSetType } from '../constants/optionSets'
import { EOptionSet, tlkOptionSetClickEvent } from '../constants/optionSets'

/**
 * Base class for all option set elements
 */
export abstract class BaseOptionSetElement extends HTMLElement {
  // Private static fields for CSS classes
  static readonly #OPTION_SET_CONTAINER_CLASS = 'tlk-option-set-container'
  static readonly #SELECTED_CLASS = 'active'
  #componentMounted: boolean = false

  // Protected static getters for derived classes
  protected static get optionSetContainerClass(): string {
    return this.#OPTION_SET_CONTAINER_CLASS
  }

  protected static get selectedClass(): string {
    return this.#SELECTED_CLASS
  }

  #optionSet: IOptionSetType | null = null
  #currentPrintAreaId = ''
  #currentOptionSetId = ''
  #currentLayerId = ''
  #initialOptionSet: IOptionSetType | null = null
  #fontDefault: string | null = null
  #canDefaultSelect: boolean = true
  readonly #container: HTMLDivElement

  constructor() {
    super()
    if (new.target === BaseOptionSetElement) {
      throw new TypeError('Cannot construct BaseOptionSetElement instances directly')
    }
    this.#container = document.createElement('div')
    this.#container.className = BaseOptionSetElement.#OPTION_SET_CONTAINER_CLASS
  }

  static get observedAttributes() {
    return ['data-option-set-data', 'data-current-print-area-id', 'data-current-option-set-id']
  }

  connectedCallback() {
    if (this.#componentMounted) return

    // Remove any pre-rendered children to prevent duplicate UI when cloning
    while (this.firstChild) {
      this.removeChild(this.firstChild)
    }

    // Mark as initialized (consistent naming)
    this.setAttribute('initialized', 'true')

    // Append internal container and proceed with normal rendering
    this.appendChild(this.#container)
    this.#parseOptionSetData()
    this.#render()
    this.#componentMounted = true
  }

  /**
   * React to attribute changes after initial mount.
   * This enables real-time updates when React (or any DOM manager) changes
   * data-option-set-data — the component re-parses and re-renders automatically.
   *
   * Critical for React interop: without this, attribute updates from React go unnoticed
   * because the component only rendered once in connectedCallback.
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    // Skip if not yet mounted (connectedCallback handles initial render)
    // or if the value hasn't actually changed
    if (!this.#componentMounted || oldValue === newValue) return

    this.#parseOptionSetData()
    this.#render()
  }

  /**
   * Parse option set data from attributes
   */
  #parseOptionSetData() {
    const optionSetData = this.getAttribute('data-option-set-data')
    if (optionSetData) {
      try {
        this.#optionSet = JSON.parse(optionSetData)
        this.#fontDefault = this.getAttribute('data-default-font') || null

        // Process default font before calling super (which triggers render)
        this.processDefaultFont()
      } catch (e) {
        console.error('Failed to parse option set data:', e)
        this.#optionSet = null
      }
    }

    this.#currentPrintAreaId = this.getAttribute('data-current-print-area-id') || ''
    this.#currentOptionSetId = this.getAttribute('data-current-option-set-id') || ''
    this.#currentLayerId = this.closest('fieldset')?.getAttribute('data-layer-id') || ''
    this.#canDefaultSelect = this.hasAttribute('data-can-default-select')
      ? this.getAttribute('data-can-default-select') === 'true'
      : true
  }

  /**
   * Get the current option set
   */
  protected getOptionSet(): IOptionSetType | null {
    return this.#optionSet
  }

  public setOptionSet(optionSet: IOptionSetType) {
    this.#optionSet = optionSet
  }

  /**
   * Get current IDs
   */
  protected getIds(): { printAreaId: string; optionSetId: string; layerId: string } {
    return {
      printAreaId: this.#currentPrintAreaId,
      optionSetId: this.#currentOptionSetId,
      layerId: this.#currentLayerId,
    }
  }

  /**
   * Create element with class names
   */
  protected createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className = ''): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag)
    if (className) {
      element.className = className
    }
    return element
  }

  /**
   * Handle option selection
   */
  protected handleSelect(id: string, event?: Event) {
    if (!this.#optionSet) return

    // Update internal state
    const items = this.#optionSet.ol.map(item => ({ ...item, selecting: item.i === id }))
    this.#optionSet = {
      ...this.#optionSet,
      ol: items,
    }

    // Stop event propagation and prevent default behavior
    event?.stopPropagation()
    event?.preventDefault()

    // Dispatch selection event
    this.dispatchEvent(
      new CustomEvent(tlkOptionSetClickEvent, {
        detail: {
          optionSet: this.#optionSet,
          currentPrintAreaId: this.#currentPrintAreaId,
          currentOptionSetId: this.#currentOptionSetId,
          currentLayerId: this.#currentLayerId,
          event,
        },
        bubbles: true,
      })
    )

    this.#render()
  }

  /**
   * Get the container element for rendering
   */
  protected getContainer(): HTMLDivElement {
    return this.#container
  }

  protected getSelectedOption(): any {
    const optionItems = this.getOptionSet()?.ol || []
    const DEFAULT_SELECTED_OPTION = this.#canDefaultSelect ? optionItems[0] : null

    let selectedOption: any = optionItems.find(o => o.selecting)
    if (selectedOption) return selectedOption

    const fieldset = this.closest('fieldset')
    if (!fieldset) return DEFAULT_SELECTED_OPTION
    const { printAreaId, optionSetId, layerId } = this.getIds()
    const optionSetType = this.getOptionSet()?.t || ''

    const optionSetLocalStorageKey = getOptionSetLocalStorageKey(printAreaId, layerId, optionSetType, optionSetId)
    const rawValue = localStorage.getItem(optionSetLocalStorageKey)
    if (!rawValue) return DEFAULT_SELECTED_OPTION

    const { id, extra } = JSON.parse(rawValue)
    selectedOption = optionItems.find(o => {
      if (optionSetType === EOptionSet.FONT_OPTION) {
        const { family, src } = JSON.parse(o.v)
        return family === extra?.family && src === extra?.src
      }

      return o.i === id
    })

    return selectedOption || DEFAULT_SELECTED_OPTION
  }

  /**
   * Render the option set UI - to be implemented by specific option set types
   */
  protected renderOptionSet(): void {
    const selectedOption = this.getSelectedOption()

    const optionSet = this.getOptionSet()

    // Update fieldset with option set data
    const fieldset = this.closest('fieldset')
    if (fieldset && selectedOption) {
      const optionSetLabel = fieldset.querySelector('.emtlkit--option-set-label')

      if (optionSetLabel) {
        try {
          if (!selectedOption.l) {
            return
          }
          const label = optionSetLabel.getAttribute('data-label')
          const changeable = optionSetLabel.getAttribute('data-changeable')

          if (changeable === 'false') {
            return
          }

          // For checkbox display style, don't append value name — checkbox already shows its own label.
          // Avoids redundant display like "Priority Upgrade: Priority Upgrade +20 VND"
          const isCheckboxStyle = optionSet?.displayStyle === 'imageless_checkbox'
          const labelText = isCheckboxStyle
            ? `${label}${selectedOption.isDefault ? ' (Default)' : ''}`
            : `${label}: ${selectedOption.l}${selectedOption.isDefault ? ' (Default)' : ''}`
          /**
           * @description for React compatibility when calling on the Admin app
           * Avoid replacing the entire HTML to prevent DOM node inconsistencies with React or other renderers.
           * If the first child is a text node, update its value directly; otherwise, fall back to textContent.
           */
          const firstChild = optionSetLabel.firstChild
          if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
            firstChild.textContent = labelText
          } else {
            optionSetLabel.textContent = labelText
          }
        } catch (e) {
          console.error('Failed to set option set label:', e)
        }
      }

      if (optionSet?.t === EOptionSet.FONT_OPTION) {
        const { family, src } = JSON.parse(selectedOption.v)
        fieldset.setAttribute('data-family', family)
        fieldset.setAttribute('data-default', selectedOption.isDefault ? 'true' : 'false')
        fieldset.setAttribute('data-font-src', src)
      }

      fieldset.setAttribute('data-option-id', selectedOption.i)
      fieldset.setAttribute('value', selectedOption.v)
      fieldset.setAttribute('data-name', selectedOption.l)
    }
  }

  protected async processDefaultFont(): Promise<void> {
    const optionSet = this.getOptionSet()
    if (!optionSet || !this.#fontDefault) return

    // const defaultFontData = JSON.parse(this.#fontDefault)
    // const defaultFontFamily = defaultFontData.family || defaultFontData.src

    // Create new option set with default font
    this.#initialOptionSet = {
      ...optionSet,
      ol: [
        // {
        //   i: defaultFontData._id || defaultFontFamily,
        //   l: defaultFontFamily,
        //   v: this.#fontDefault,
        //   family: defaultFontFamily,
        //   isDefault: true,
        // } as FontOptionItem,
        ...optionSet.ol,
      ],
    } as IOptionSetType

    // Set the processed option set
    this.setOptionSet(this.#initialOptionSet)
  }

  /**
   * Main render method
   */
  #render() {
    const container = this.getContainer()
    const optionSet = this.getOptionSet()

    if (!container || !optionSet) {
      console.warn('No container or optionSet for rendering', { container, optionSet })
      return
    }

    // Clear existing content inside container before rendering
    container.innerHTML = ''

    // Call specific implementation
    this.renderOptionSet()
  }

  disconnectedCallback() {
    this.#componentMounted = false
    this.#initialOptionSet = null
    this.#fontDefault = null
    this.#optionSet = null
    this.#currentPrintAreaId = ''
    this.#currentOptionSetId = ''
    this.#currentLayerId = ''
    this.#canDefaultSelect = true

    // Safely remove container — it may already be detached if parent cleared innerHTML
    if (this.#container.parentNode === this) {
      this.removeChild(this.#container)
    }
  }
}
