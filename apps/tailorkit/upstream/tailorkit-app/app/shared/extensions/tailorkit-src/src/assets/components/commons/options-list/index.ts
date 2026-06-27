/* eslint-disable max-len */
import type { Option, OptionSection, OptionListOptions } from './types'
import type { TextFieldOptions } from '../textfield/types'
import TextField from '../textfield'

/**
 * OptionList component
 * A component for rendering a list of selectable options with optional search functionality
 *
 * @example
 * const optionList = new OptionList({
 *   options: hasSections ? [] : sampleOptions,
 *   sections: hasSections ? sampleSections : null,
 *   allowMultiple: isMultiple,
 *   showSearch: hasSearch,
 *   showRadio: false, // Show radio buttons in single selection mode
 *   selected: ['option1'],
 *   onChange: (selected) => {
 *     document.getElementById('output').textContent = `Selected: ${JSON.stringify(selected)}`;
 *   },
 *   onSelect: (value) => {
 *     console.log('Option selected:', value);
 *   }
 * });
 *
 * container.innerHTML = '';
 * container.appendChild(optionList.container);
 */
class OptionList {
  /** List of available options */
  private options: Option[]
  /** Set of selected option values */
  private selected: Set<string>
  /** Whether multiple selections are allowed */
  private allowMultiple: boolean
  /** Whether to show radio buttons in single selection mode */
  private showRadio: boolean
  /** Title for the option list */
  private title: string | null
  /** Callback when selection changes */
  private onChange: (selected: string[]) => void
  /** Callback when an individual option is selected */
  private onSelect: (value: string) => void
  /** ARIA role for the container */
  private role: string | null
  /** ARIA role for option elements */
  private optionRole: string | null
  /** Loading state */
  private loading: boolean
  /** Grouped sections of options */
  private sections: OptionSection[] | null
  /** Whether to show search input */
  private showSearch: boolean
  /** Search TextField options */
  private searchFieldOptions: TextFieldOptions
  /** Placeholder text for search field */
  private searchPlaceholder: string
  /** Current search input value */
  private searchValue: string
  /** Search TextField component */
  private searchField: TextField | null
  /** Unique ID for this instance */
  private _id?: string
  /** DOM container element */
  public container: HTMLDivElement

  constructor(options: OptionListOptions = {}) {
    // Props
    this.options = options.options || []
    this.selected = new Set(options.selected || [])
    this.allowMultiple = options.allowMultiple || false
    this.showRadio = options.showRadio || false
    this.title = options.title || null
    this.onChange = options.onChange || (() => {})
    this.onSelect = options.onSelect || (() => {})
    this.role = options.role || null
    this.optionRole = options.optionRole || null
    this.loading = options.loading || false
    this.sections = options.sections || null
    this.showSearch = options.showSearch || false
    this.searchFieldOptions = options.searchFieldOptions || {}
    this.searchPlaceholder = options.searchPlaceholder || 'Search options...'
    this.searchValue = ''
    this.searchField = null

    // Create container
    this.container = document.createElement('div')
    this.container.className = 'emtlkit-option-list'
    this.container.setAttribute('tabindex', '-1')
    this.container.setAttribute('aria-label', 'Option List')
    if (this.allowMultiple) {
      this.container.classList.add('allow-multiple')
    }

    if (this.role) {
      this.container.setAttribute('role', this.role)
    }

    this.render()
  }

  render(): void {
    this.container.innerHTML = ''

    if (this.loading) {
      this.renderLoading()
      return
    }

    if (this.showSearch) {
      this.renderSearch()
    } else {
      // Destroy the search field if it exists
      if (this.searchField) {
        this.searchField.destroy()
        this.searchField = null
      }
    }

    if (this.title) {
      this.renderTitle()
    }

    // Create containers for sections or options
    if (this.sections) {
      const sectionsContainer = document.createElement('div')
      sectionsContainer.className = 'emtlkit-option-list__sections-container'
      this.renderSections(sectionsContainer)
      this.container.appendChild(sectionsContainer)
    } else {
      const optionsContainer = document.createElement('div')
      optionsContainer.className = 'emtlkit-option-list__options-container'
      this.renderOptions(this.getFilteredOptions(), optionsContainer)
      this.container.appendChild(optionsContainer)
    }
  }

  renderLoading(): void {
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'emtlkit-option-list__loading'
    loadingDiv.innerHTML = `
                    <div class="emtlkit-option-list__loading-spinner"></div>
                    Loading options...
                `
    this.container.appendChild(loadingDiv)
  }

  renderSearch(): void {
    const searchContainer = document.createElement('div')
    searchContainer.className = 'emtlkit-option-list__search'

    // Create a TextField component for search if it doesn't exist
    if (!this.searchField) {
      this.searchField = new TextField({
        ...this.searchFieldOptions,
        onInput: (event, value) => {
          this.searchValue = value
          // Only re-render the filtered options, not the entire component
          this.updateFilteredOptions()
        },
      })
    } else {
      // Update the value if it has changed
      this.searchField.setValue(this.searchValue)
    }

    // Append the TextField to the search container
    this.searchField.appendTo(searchContainer)

    this.container.appendChild(searchContainer)
  }

  renderTitle(): void {
    const titleElement = document.createElement('h3')
    titleElement.className = 'emtlkit-option-list__section-title'
    titleElement.textContent = this.title || ''
    this.container.appendChild(titleElement)
  }

  renderSections(container: HTMLElement = this.container): void {
    if (!this.sections) return

    this.sections.forEach((section: OptionSection) => {
      const sectionDiv = document.createElement('div')
      sectionDiv.className = 'emtlkit-option-list__section'

      if (section.title) {
        const titleElement = document.createElement('h3')
        titleElement.className = 'emtlkit-option-list__section-title'
        titleElement.textContent = section.title
        sectionDiv.appendChild(titleElement)
      }

      const filteredOptions = this.getFilteredOptions(section.options || [])
      this.renderOptions(filteredOptions, sectionDiv)

      if (filteredOptions.length > 0) {
        container.appendChild(sectionDiv)
      }
    })
  }

  renderOptions(options: Option[], container: HTMLElement = this.container): void {
    options.forEach(option => {
      const optionElement = this.createOptionElement(option)
      container.appendChild(optionElement)
    })
  }

  createOptionElement(option: Option): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'emtlkit-option-list__option'
    button.type = 'button'

    if (this.optionRole) {
      button.setAttribute('role', this.optionRole)
    }

    const isSelected = this.selected.has(option.value)
    const isDisabled = option.disabled || false

    if (isSelected) {
      button.classList.add('selected')
      button.setAttribute('aria-selected', 'true')
    }

    if (isDisabled) {
      button.classList.add('disabled')
      button.disabled = true
    }

    // Build option content
    let content = ''

    // Prefix (checkbox/radio for selection, or custom prefix)
    if (this.allowMultiple || option.prefix) {
      content += '<div class="emtlkit-option-list__option-prefix">'
      if (this.allowMultiple) {
        content += `<input type="checkbox" class="emtlkit-option-list__checkbox" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} tabindex="-1">`
      } else if (option.prefix) {
        content += typeof option.prefix === 'string' ? option.prefix : ''
      }
      content += '</div>'
    } else if (!this.allowMultiple && this.showRadio) {
      // Single selection with radio button
      content += '<div class="emtlkit-option-list__option-prefix">'
      content += `<input type="radio" class="emtlkit-option-list__radio" name="option-list-${this.getId()}" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} tabindex="-1">`
      content += '</div>'
    }

    // Media
    if (option.media) {
      content += '<div class="emtlkit-option-list__option-prefix">'
      if (typeof option.media === 'string') {
        content += `<img src="${option.media}" alt="" class="emtlkit-option-list__media">`
      } else {
        content += '' // Handle HTML element case properly in runtime
      }
      content += '</div>'
    }

    // Main content
    content += '<div class="emtlkit-option-list__option-content">'
    content += `<span class="emtlkit-option-list__option-label">${option.label}</span>`
    if (option.description) {
      content += `<span class="emtlkit-option-list__option-description">${option.description}</span>`
    }
    content += '</div>'

    // Suffix
    if (option.suffix) {
      content += '<div class="emtlkit-option-list__option-suffix">'
      content += typeof option.suffix === 'string' ? option.suffix : ''
      content += '</div>'
    }

    button.innerHTML = content

    // Event listeners
    if (!isDisabled) {
      button.addEventListener('click', (e: Event) => {
        e.preventDefault()
        this.handleOptionClick(option)
      })

      button.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          this.handleOptionClick(option)
        }
      })
    }

    return button
  }

  handleOptionClick(option: Option): void {
    if (this.allowMultiple) {
      if (this.selected.has(option.value)) {
        this.selected.delete(option.value)
      } else {
        this.selected.add(option.value)
      }
    } else {
      this.selected.clear()
      this.selected.add(option.value)
    }

    this.render()
    this.onChange(Array.from(this.selected))
    this.onSelect(option.value)
    this.container.focus()
  }

  getFilteredOptions(optionsToFilter: Option[] = this.options): Option[] {
    if (!this.searchValue) {
      return optionsToFilter
    }

    const searchLower = this.searchValue.toLowerCase()
    return optionsToFilter.filter(
      option =>
        option.label.toLowerCase().includes(searchLower)
        || (option.description && option.description.toLowerCase().includes(searchLower))
    )
  }

  getId(): string {
    if (!this._id) {
      this._id = Math.random().toString(36).substring(2, 9)
    }
    return this._id
  }

  // Public methods
  getSelected(): string[] {
    return Array.from(this.selected)
  }

  setSelected(values: string[]): void {
    this.selected = new Set(values)
    this.render()
  }

  setOptions(options: Option[]): void {
    this.options = options
    this.render()
  }

  setSections(sections: OptionSection[]): void {
    this.sections = sections
    this.render()
  }

  setLoading(loading: boolean): void {
    this.loading = loading
    this.render()
  }

  setAllowMultiple(allowMultiple: boolean): void {
    this.allowMultiple = allowMultiple
    if (allowMultiple) {
      this.container.classList.add('allow-multiple')
    } else {
      this.container.classList.remove('allow-multiple')
      // If switching to single selection, keep only the first selected item
      if (this.selected.size > 1) {
        const firstSelected = Array.from(this.selected)[0]
        this.selected.clear()
        this.selected.add(firstSelected)
      }
    }
    this.render()
  }

  setShowSearch(showSearch: boolean): void {
    this.showSearch = showSearch
    if (!showSearch) {
      this.searchValue = ''
    }
    this.render()
  }

  /**
   * Sets the placeholder text for the search field
   * @param searchPlaceholder - The placeholder text
   */
  setSearchPlaceholder(searchPlaceholder: string): void {
    this.searchPlaceholder = searchPlaceholder

    // If we have an existing search field, we need to recreate it with the new placeholder
    if (this.showSearch && this.searchField) {
      // Store the current value
      const currentValue = this.searchField.getValue()

      // Destroy the old field
      this.searchField.destroy()

      // Create a new one with updated placeholder
      this.searchField = new TextField({
        placeholder: this.searchPlaceholder,
        value: currentValue,
        prefix: '🔍',
        variant: 'borderless',
        size: 'medium',
        clearable: true,
        onInput: (event, value) => {
          this.searchValue = value
          // Re-filter the options
          this.updateFilteredOptions()
        },
      })

      // Find the search container and append the new field
      const existingSearchContainer = this.container.querySelector('.emtlkit-option-list__search')
      if (existingSearchContainer) {
        existingSearchContainer.innerHTML = ''
        this.searchField.appendTo(existingSearchContainer as HTMLElement)
      }
    }
  }

  /**
   * Updates the filtered options without full re-render
   */
  private updateFilteredOptions(): void {
    if (this.sections) {
      // Clear and re-render sections
      const sectionsContainer = this.container.querySelector('.emtlkit-option-list__sections-container')
      if (sectionsContainer) {
        sectionsContainer.innerHTML = ''
        this.renderSections(sectionsContainer as HTMLElement)
      }
    } else {
      // Clear and re-render options
      const optionsContainer = this.container.querySelector('.emtlkit-option-list__options-container')
      if (optionsContainer) {
        optionsContainer.innerHTML = ''
        this.renderOptions(this.getFilteredOptions(), optionsContainer as HTMLElement)
      }
    }
  }

  /**
   * Sets whether to show radio buttons in single selection mode
   * @param showRadio - Whether to show radio buttons
   */
  setShowRadio(showRadio: boolean): void {
    this.showRadio = showRadio
    this.render()
  }

  destroy(): void {
    if (this.searchField) {
      this.searchField.destroy()
      this.searchField = null
    }

    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}

export default OptionList
