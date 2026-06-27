# TailorKit Shared Components Examples

## Basic Usage Examples

### 1. Color Option Set

#### HTML Implementation

```html
<!-- Basic color swatch -->
<tailorkit-color-options-list
  data-option-set-data='{
    "i": "color_set_1",
    "t": "color_option",
    "l": "Choose Your Color",
    "displayStyle": "color_swatch",
    "ol": [
      {
        "i": "red",
        "l": "Red",
        "v": "#FF0000",
        "selecting": false
      },
      {
        "i": "blue",
        "l": "Blue",
        "v": "#0000FF",
        "selecting": true
      },
      {
        "i": "green",
        "l": "Green",
        "v": "#00FF00",
        "selecting": false
      }
    ]
  }'
  data-current-print-area-id="front_area"
  data-current-option-set-id="color_set_1"
>
</tailorkit-color-options-list>

<!-- Color dropdown -->
<tailorkit-color-dropdown
  data-option-set-data='{
    "i": "color_set_2",
    "t": "color_option",
    "l": "Select Color",
    "displayStyle": "color_dropdown_list",
    "ol": [
      {
        "i": "black",
        "l": "Black",
        "v": "#000000",
        "selecting": false
      },
      {
        "i": "white",
        "l": "White",
        "v": "#FFFFFF",
        "selecting": true
      }
    ]
  }'
  data-current-print-area-id="back_area"
  data-current-option-set-id="color_set_2"
>
</tailorkit-color-dropdown>
```

#### JavaScript Event Handling

```javascript
// Listen for color selection events
document.addEventListener('tlk-option-set-click', event => {
  const { optionSet, currentPrintAreaId, currentOptionSetId } = event.detail

  if (optionSet.t === 'color_option') {
    console.log('Color selected:', {
      printArea: currentPrintAreaId,
      optionSet: currentOptionSetId,
      selectedColor: optionSet.ol.find(item => item.selecting),
    })

    // Update product preview
    updateProductColor(currentPrintAreaId, optionSet)
  }
})

// Programmatically update color options
function updateColorOptions(element, newColors) {
  const optionSet = {
    i: 'color_set_1',
    t: 'color_option',
    l: 'Choose Your Color',
    displayStyle: 'color_swatch',
    ol: newColors.map(color => ({
      i: color.id,
      l: color.name,
      v: color.hex,
      selecting: false,
    })),
  }

  element.setOptionSet(optionSet)
}
```

### 2. Font Option Set

#### HTML Implementation

```html
<!-- Font dropdown with preview -->
<tailorkit-font-options-list
  data-option-set-data='{
    "i": "font_set_1",
    "t": "font_option",
    "l": "Choose Font",
    "displayStyle": "font_dropdown_list",
    "ol": [
      {
        "i": "arial",
        "l": "Arial",
        "v": "Arial, sans-serif",
        "selecting": false,
        "fontFamily": "Arial, sans-serif"
      },
      {
        "i": "times",
        "l": "Times New Roman",
        "v": "Times New Roman, serif",
        "selecting": true,
        "fontFamily": "Times New Roman, serif"
      },
      {
        "i": "courier",
        "l": "Courier New",
        "v": "Courier New, monospace",
        "selecting": false,
        "fontFamily": "Courier New, monospace"
      }
    ]
  }'
  data-current-print-area-id="text_area"
  data-current-option-set-id="font_set_1"
>
</tailorkit-font-options-list>
```

#### JavaScript Font Handling

```javascript
// Handle font selection
document.addEventListener('tlk-option-set-click', event => {
  const { optionSet, currentPrintAreaId } = event.detail

  if (optionSet.t === 'font_option') {
    const selectedFont = optionSet.ol.find(item => item.selecting)

    // Apply font to text element
    const textElement = document.querySelector(`[data-print-area="${currentPrintAreaId}"]`)
    if (textElement && selectedFont) {
      textElement.style.fontFamily = selectedFont.fontFamily
    }
  }
})

// Load fonts dynamically
async function loadFontOptions(element, fontList) {
  // Load Google Fonts or custom fonts
  await Promise.all(fontList.map(font => loadFont(font)))

  const optionSet = {
    i: 'font_set_1',
    t: 'font_option',
    l: 'Choose Font',
    displayStyle: 'font_dropdown_list',
    ol: fontList.map(font => ({
      i: font.id,
      l: font.name,
      v: font.family,
      selecting: false,
      fontFamily: font.family,
    })),
  }

  element.setOptionSet(optionSet)
}
```

### 3. Image Option Set

#### HTML Implementation

```html
<!-- Image gallery -->
<tailorkit-image-options-list
  data-option-set-data='{
    "i": "image_set_1",
    "t": "image_option",
    "l": "Choose Design",
    "displayStyle": "image_swatch",
    "ol": [
      {
        "i": "design_1",
        "l": "Abstract Design",
        "v": "https://example.com/design1.png",
        "selecting": false,
        "imageUrl": "https://example.com/design1.png",
        "thumbnailUrl": "https://example.com/design1-thumb.png"
      },
      {
        "i": "design_2",
        "l": "Geometric Pattern",
        "v": "https://example.com/design2.png",
        "selecting": true,
        "imageUrl": "https://example.com/design2.png",
        "thumbnailUrl": "https://example.com/design2-thumb.png"
      }
    ]
  }'
  data-current-print-area-id="design_area"
  data-current-option-set-id="image_set_1"
>
</tailorkit-image-options-list>
```

#### JavaScript Image Handling

```javascript
// Handle image selection
document.addEventListener('tlk-option-set-click', event => {
  const { optionSet, currentPrintAreaId } = event.detail

  if (optionSet.t === 'image_option') {
    const selectedImage = optionSet.ol.find(item => item.selecting)

    // Update product preview
    if (selectedImage) {
      updateProductImage(currentPrintAreaId, selectedImage.imageUrl)
    }
  }
})

// Load images with lazy loading
async function loadImageOptions(element, imageList) {
  const optionSet = {
    i: 'image_set_1',
    t: 'image_option',
    l: 'Choose Design',
    displayStyle: 'image_swatch',
    ol: await Promise.all(
      imageList.map(async image => {
        // Preload thumbnail
        await preloadImage(image.thumbnailUrl)

        return {
          i: image.id,
          l: image.name,
          v: image.url,
          selecting: false,
          imageUrl: image.url,
          thumbnailUrl: image.thumbnailUrl,
        }
      })
    ),
  }

  element.setOptionSet(optionSet)
}
```

### 4. Text Option Set

#### HTML Implementation

```html
<!-- Text options list -->
<tailorkit-text-options-list
  data-option-set-data='{
    "i": "text_set_1",
    "t": "text_option",
    "l": "Choose Text Style",
    "displayStyle": "text_vertical_list",
    "ol": [
      {
        "i": "style_1",
        "l": "Bold",
        "v": "bold",
        "selecting": false,
        "fontWeight": "bold"
      },
      {
        "i": "style_2",
        "l": "Italic",
        "v": "italic",
        "selecting": true,
        "fontStyle": "italic"
      },
      {
        "i": "style_3",
        "l": "Underline",
        "v": "underline",
        "selecting": false,
        "textDecoration": "underline"
      }
    ]
  }'
  data-current-print-area-id="text_area"
  data-current-option-set-id="text_set_1"
>
</tailorkit-text-options-list>
```

## Advanced Examples

### 1. Dynamic Option Set Creation

```javascript
class ProductCustomizer {
  constructor(container) {
    this.container = container
    this.optionSets = new Map()
    this.init()
  }

  init() {
    // Register event listeners
    this.container.addEventListener('tlk-option-set-click', this.handleOptionSelect.bind(this))

    // Create option sets dynamically
    this.createColorOptionSet()
    this.createFontOptionSet()
    this.createImageOptionSet()
  }

  createColorOptionSet() {
    const element = document.createElement('tailorkit-color-options-list')
    element.setAttribute('data-current-print-area-id', 'main_area')
    element.setAttribute('data-current-option-set-id', 'colors')

    const optionSet = {
      i: 'colors',
      t: 'color_option',
      l: 'Choose Color',
      displayStyle: 'color_swatch',
      ol: [
        { i: 'red', l: 'Red', v: '#FF0000', selecting: false },
        { i: 'blue', l: 'Blue', v: '#0000FF', selecting: true },
        { i: 'green', l: 'Green', v: '#00FF00', selecting: false },
      ],
    }

    element.setAttribute('data-option-set-data', JSON.stringify(optionSet))
    this.container.appendChild(element)
    this.optionSets.set('colors', element)
  }

  handleOptionSelect(event) {
    const { optionSet, currentPrintAreaId, currentOptionSetId } = event.detail

    // Update product state
    this.updateProductState(currentOptionSetId, optionSet)

    // Trigger price recalculation
    this.recalculatePrice()
  }

  updateProductState(optionSetId, optionSet) {
    // Implementation for updating product state
    console.log('Updating product state:', { optionSetId, optionSet })
  }

  recalculatePrice() {
    // Implementation for price calculation
    console.log('Recalculating price')
  }
}
```

### 2. Custom Option Set Implementation

```typescript
// Custom size option set
class SizeOptionSetElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const optionSet = this.getOptionSet()
    const container = this.getContainer()

    if (!optionSet) return

    // Create size grid
    const grid = this.createElement('div', 'emtlkit--size-grid emtlkit--d-flex emtlkit--gap-8')

    optionSet.ol.forEach(item => {
      const sizeButton = this.createElement('button', 'emtlkit--size-button')
      sizeButton.textContent = item.l
      sizeButton.setAttribute('data-size', item.i)

      if (item.selecting) {
        sizeButton.classList.add('emtlkit--active')
      }

      sizeButton.addEventListener('click', e => {
        this.handleSelect(item.i, e)
      })

      grid.appendChild(sizeButton)
    })

    container.appendChild(grid)
  }
}

// Register custom component
customElements.define('tailorkit-size-options-list', SizeOptionSetElement)
```

### 3. Integration with Product Preview

```javascript
class ProductPreviewManager {
  constructor() {
    this.previewElement = document.getElementById('product-preview')
    this.optionStates = new Map()
    this.init()
  }

  init() {
    // Listen for all option set events
    document.addEventListener('tlk-option-set-click', this.handleOptionChange.bind(this))
  }

  handleOptionChange(event) {
    const { optionSet, currentPrintAreaId, currentOptionSetId } = event.detail

    // Store option state
    this.optionStates.set(currentOptionSetId, optionSet)

    // Update preview
    this.updatePreview(currentPrintAreaId, optionSet)
  }

  updatePreview(printAreaId, optionSet) {
    const areaElement = this.previewElement.querySelector(`[data-area="${printAreaId}"]`)
    if (!areaElement) return

    const selectedOption = optionSet.ol.find(item => item.selecting)
    if (!selectedOption) return

    // Apply changes based on option type
    switch (optionSet.t) {
      case 'color_option':
        areaElement.style.backgroundColor = selectedOption.v
        break
      case 'font_option':
        areaElement.style.fontFamily = selectedOption.fontFamily
        break
      case 'image_option':
        areaElement.style.backgroundImage = `url(${selectedOption.imageUrl})`
        break
      case 'text_option':
        this.applyTextStyle(areaElement, selectedOption)
        break
    }
  }

  applyTextStyle(element, option) {
    // Apply text styling based on option value
    switch (option.v) {
      case 'bold':
        element.style.fontWeight = 'bold'
        break
      case 'italic':
        element.style.fontStyle = 'italic'
        break
      case 'underline':
        element.style.textDecoration = 'underline'
        break
    }
  }

  // Get current product configuration
  getProductConfiguration() {
    const config = {}
    this.optionStates.forEach((optionSet, optionSetId) => {
      const selectedOption = optionSet.ol.find(item => item.selecting)
      if (selectedOption) {
        config[optionSetId] = {
          type: optionSet.t,
          selected: selectedOption.i,
          value: selectedOption.v,
        }
      }
    })
    return config
  }
}
```

### 4. Form Integration

```javascript
class OptionSetFormIntegration {
  constructor(formElement) {
    this.form = formElement
    this.optionElements = formElement.querySelectorAll('[data-option-set-data]')
    this.init()
  }

  init() {
    // Listen for option changes
    this.form.addEventListener('tlk-option-set-click', this.handleOptionChange.bind(this))

    // Set up form submission
    this.form.addEventListener('submit', this.handleSubmit.bind(this))
  }

  handleOptionChange(event) {
    const { optionSet, currentOptionSetId } = event.detail
    const selectedOption = optionSet.ol.find(item => item.selecting)

    // Update hidden form fields
    this.updateFormField(currentOptionSetId, selectedOption)
  }

  updateFormField(optionSetId, selectedOption) {
    // Create or update hidden input
    let input = this.form.querySelector(`input[name="option_${optionSetId}"]`)
    if (!input) {
      input = document.createElement('input')
      input.type = 'hidden'
      input.name = `option_${optionSetId}`
      this.form.appendChild(input)
    }

    input.value = selectedOption ? selectedOption.i : ''
  }

  handleSubmit(event) {
    // Validate required options
    const requiredOptions = this.form.querySelectorAll('[data-required="true"]')
    let isValid = true

    requiredOptions.forEach(optionElement => {
      const optionSetId = optionElement.getAttribute('data-current-option-set-id')
      const input = this.form.querySelector(`input[name="option_${optionSetId}"]`)

      if (!input || !input.value) {
        isValid = false
        this.showError(optionElement, 'This option is required')
      }
    })

    if (!isValid) {
      event.preventDefault()
    }
  }

  showError(element, message) {
    // Show validation error
    const errorDiv = document.createElement('div')
    errorDiv.className = 'emtlkit--error-message'
    errorDiv.textContent = message
    element.appendChild(errorDiv)
  }
}
```

## CSS Examples

### Custom Styling

```css
/* Custom color swatch styling */
.emtlkit--color-swatch-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
  gap: 8px;
  padding: 16px;
}

.emtlkit--color-selector-button {
  width: 40px;
  height: 40px;
  border: 2px solid #ddd;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.emtlkit--color-selector-button:hover {
  transform: scale(1.1);
  border-color: #999;
}

.emtlkit--color-selector-button.emtlkit--active {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* Custom font dropdown styling */
.emtlkit--font-dropdown-container {
  position: relative;
  width: 200px;
}

.emtlkit--font-dropdown-button {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  text-align: left;
}

.emtlkit--font-dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
}

.emtlkit--font-dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.emtlkit--font-dropdown-item:hover {
  background-color: #f8f9fa;
}

.emtlkit--font-dropdown-item.emtlkit--active {
  background-color: #007bff;
  color: white;
}
```

### Responsive Design

```css
/* Responsive option set containers */
.emtlkit--option-set-container {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .emtlkit--option-set-container {
    max-width: 600px;
  }
}

@media (min-width: 1024px) {
  .emtlkit--option-set-container {
    max-width: 800px;
  }
}

/* Responsive grid layouts */
.emtlkit--color-swatch-container {
  grid-template-columns: repeat(3, 1fr);
}

@media (min-width: 480px) {
  .emtlkit--color-swatch-container {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 768px) {
  .emtlkit--color-swatch-container {
    grid-template-columns: repeat(6, 1fr);
  }
}
```
