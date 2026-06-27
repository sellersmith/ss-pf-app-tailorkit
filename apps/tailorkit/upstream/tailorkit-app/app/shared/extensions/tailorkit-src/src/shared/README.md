# TailorKit Shared Components Documentation

## Overview

The `shared` folder contains reusable web components and constants that are shared across the TailorKit extension. This module provides a foundation for building option set components that can be used in product customization interfaces.

## Architecture

### Core Structure

```
shared/
├── components/           # Web component implementations
│   ├── BaseOptionSetElement.ts    # Abstract base class
│   ├── types.ts                   # Shared TypeScript interfaces
│   ├── registerOptionSetElements.ts # Component registration
│   ├── index.ts                   # Public exports
│   ├── ColorOptionSet/            # Color selection components
│   ├── FontOptionSet/             # Font selection components
│   ├── ImageOptionSet/            # Image selection components
│   └── TextOptionSet/             # Text selection components
└── constants/
    └── optionSets.ts              # Option set types and constants
```

## Core Components

### BaseOptionSetElement

The `BaseOptionSetElement` is an abstract base class that all option set components extend. It provides:

- **Lifecycle Management**: Handles component mounting, attribute changes, and cleanup
- **Data Parsing**: Parses option set data from HTML attributes
- **Event Handling**: Manages selection events and state updates
- **Rendering**: Provides a consistent rendering pattern

#### Key Features

```typescript
abstract class BaseOptionSetElement extends HTMLElement {
  // Protected methods for derived classes
  protected getOptionSet(): IOptionSetType | null
  protected getIds(): { printAreaId: string; optionSetId: string }
  protected handleSelect(id: string, event?: Event): void
  protected abstract renderOptionSet(): void
}
```

#### Usage Pattern

```typescript
class CustomOptionSetElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const optionSet = this.getOptionSet()
    const container = this.getContainer()

    // Implement custom rendering logic
    // Use this.handleSelect() for selection events
  }
}
```

### Option Set Types

The system supports multiple option set types:

- **ColorOptionSet**: Color swatches and dropdowns
- **FontOptionSet**: Font selection with preview
- **ImageOptionSet**: Image thumbnails and galleries
- **TextOptionSet**: Text-based options

Each option set type follows a consistent pattern with three main components:

1. **Main Element**: Chooses display style (swatch vs dropdown)
2. **Swatch Element**: Grid-based visual selection
3. **Dropdown Element**: List-based selection

## Data Structure

### IOptionSetType Interface

```typescript
interface IOptionSetType {
  i: string // Option set ID
  t: EOptionSet // Option set type
  l: string // Label
  displayStyle: string // Display style preference
  ol: OptionItem[] // Option list
}
```

### Option Items

Each option item follows the `BaseOptionItem` interface:

```typescript
interface BaseOptionItem {
  i: string // Item ID
  l: string // Label
  v: string // Value
  selecting?: boolean // Selection state
  additionalPricing?: any // Pricing information
}
```

## Component Registration

### Automatic Registration

Components are automatically registered when the module is imported:

```typescript
// Auto-register when module is imported
registerOptionSetElements()
```

### Manual Registration

```typescript
import { registerOptionSetElements } from './shared/components'

// Register all option set elements
registerOptionSetElements()
```

## Usage in HTML

### Basic Usage

```html
<!-- Color Option Set -->
<tailorkit-color-options-list
  data-option-set-data='{"i":"color1","t":"color_option","l":"Choose Color","displayStyle":"color_swatch","ol":[...]}'
  data-current-print-area-id="area1"
  data-current-option-set-id="set1"
>
</tailorkit-color-options-list>

<!-- Font Option Set -->
<tailorkit-font-options-list
  data-option-set-data='{"i":"font1","t":"font_option","l":"Choose Font","displayStyle":"font_dropdown_list","ol":[...]}'
  data-current-print-area-id="area1"
  data-current-option-set-id="set1"
>
</tailorkit-font-options-list>
```

### Data Attributes

- `data-option-set-data`: JSON string containing option set configuration
- `data-current-print-area-id`: Current print area identifier
- `data-current-option-set-id`: Current option set identifier
- `data-value-from-fieldset`: External value source (optional)

## Event Handling

### Selection Events

Components dispatch `tlk-option-set-click` events when options are selected:

```typescript
element.addEventListener('tlk-option-set-click', event => {
  const { optionSet, currentPrintAreaId, currentOptionSetId } = event.detail
  // Handle selection
})
```

### Event Detail Structure

```typescript
interface OptionSetClickEvent {
  optionSet: IOptionSetType
  currentPrintAreaId: string
  currentOptionSetId: string
  event?: Event
}
```

## Styling

### CSS Class Naming Convention

All components use the `emtlkit--` prefix for CSS classes:

```css
.emtlkit--color-selector-button {
  /* ... */
}
.emtlkit--font-dropdown-item {
  /* ... */
}
.emtlkit--image-swatch-container {
  /* ... */
}
```

### Common Utility Classes

- `emtlkit--d-flex`: Display flex
- `emtlkit--gap-8`: Gap spacing
- `emtlkit--active`: Active/selected state

## Development Guidelines

### Creating New Option Set Types

1. **Extend BaseOptionSetElement**:

   ```typescript
   class CustomOptionSetElement extends BaseOptionSetElement {
     protected renderOptionSet(): void {
       // Implementation
     }
   }
   ```

2. **Create Component Structure**:

   ```
   CustomOptionSet/
   ├── index.ts
   ├── types.ts
   ├── styles.css
   └── components/
       ├── CustomOptionSetElement.ts
       ├── CustomSwatchElement.ts
       └── CustomDropdownElement.ts
   ```

3. **Register Components**:

   ```typescript
   export function registerCustomOptionSetElements() {
     customElements.define('tailorkit-custom-options-list', CustomOptionSetElement)
     customElements.define('tailorkit-custom-swatch', CustomSwatchElement)
     customElements.define('tailorkit-custom-dropdown', CustomDropdownElement)
   }
   ```

4. **Update Registration**:
   Add to `registerOptionSetElements.ts`:

   ```typescript
   import { registerCustomOptionSetElements } from './CustomOptionSet'

   export function registerOptionSetElements() {
     // ... existing registrations
     registerCustomOptionSetElements()
   }
   ```

### Best Practices

1. **Type Safety**: Always use TypeScript interfaces for option items
2. **Error Handling**: Implement proper error handling for data parsing
3. **Performance**: Use efficient DOM manipulation and avoid unnecessary re-renders
4. **Accessibility**: Ensure components are accessible with proper ARIA attributes
5. **Testing**: Write comprehensive tests for all components

## Constants

### EOptionSet Enum

```typescript
enum EOptionSet {
  IMAGE_OPTION = 'image_option',
  TEXT_OPTION = 'text_option',
  COLOR_OPTION = 'color_option',
  FONT_OPTION = 'font_option',
  MULTI_LAYOUT_OPTION = 'multi_layout_option',
  IMAGELESS_OPTION = 'imageless_option',
  SHAPE = 'shape',
  MASK_OPTION = 'mask_option',
}
```

### Default Display Styles

```typescript
const DEFAULT_DISPLAY_STYLES = {
  [EOptionSet.IMAGE_OPTION]: 'image_swatch',
  [EOptionSet.TEXT_OPTION]: 'text_vertical_list',
  [EOptionSet.FONT_OPTION]: 'font_dropdown_list',
  [EOptionSet.COLOR_OPTION]: 'color_swatch',
  [EOptionSet.MASK_OPTION]: 'mask_swatch',
}
```

## Testing

### Component Testing

Each component should have comprehensive tests covering:

- **Equivalence Partitioning**: Test different input ranges
- **Boundary Value Analysis**: Test edge cases
- **User Interactions**: Test selection, hover, focus states
- **Event Dispatching**: Verify correct event emission
- **Data Parsing**: Test various data formats and error cases

### Test Structure

```typescript
// Equivalence Partitioning: Valid option set data
describe('CustomOptionSet with valid data', () => {
  // Test cases
})

// Boundary Value Analysis: Empty option set
describe('CustomOptionSet with empty data', () => {
  // Test cases
})

// Boundary Value Analysis: Invalid JSON
describe('CustomOptionSet with invalid data', () => {
  // Test cases
})
```

## Troubleshooting

### Common Issues

1. **Components Not Registering**: Ensure `registerOptionSetElements()` is called
2. **Data Not Parsing**: Check JSON format in `data-option-set-data`
3. **Events Not Firing**: Verify event listener attachment
4. **Styling Issues**: Check CSS class naming and specificity

### Debug Mode

Enable debug logging by setting the `debug` attribute:

```html
<tailorkit-color-options-list debug></tailorkit-color-options-list>
```

## Performance Considerations

1. **Lazy Loading**: Consider lazy loading for large option sets
2. **Virtual Scrolling**: Implement for long lists
3. **Memoization**: Cache expensive calculations
4. **Event Delegation**: Use event delegation for dynamic content

## Future Enhancements

1. **Virtual Scrolling**: For large option sets
2. **Search Functionality**: For dropdown components
3. **Keyboard Navigation**: Enhanced accessibility
4. **Animation Support**: Smooth transitions
5. **Internationalization**: Multi-language support
