# TailorKit Shared Components API Reference

## BaseOptionSetElement

### Class Definition

```typescript
abstract class BaseOptionSetElement extends HTMLElement
```

### Public Methods

#### `setOptionSet(optionSet: IOptionSetType): void`

Updates the option set data and triggers a re-render.

**Parameters:**

- `optionSet: IOptionSetType` - The new option set configuration

**Example:**

```typescript
const element = document.querySelector('tailorkit-color-options-list')
element.setOptionSet(newOptionSet)
```

### Protected Methods

#### `getOptionSet(): IOptionSetType | null`

Returns the current option set data.

**Returns:** `IOptionSetType | null` - Current option set or null if not set

#### `getIds(): { printAreaId: string; optionSetId: string }`

Returns the current print area and option set IDs.

**Returns:** Object containing `printAreaId` and `optionSetId`

#### `handleSelect(id: string, event?: Event): void`

Handles option selection and dispatches events.

**Parameters:**

- `id: string` - The selected option ID
- `event?: Event` - Optional original event

#### `getContainer(): HTMLDivElement`

Returns the container element for rendering.

**Returns:** `HTMLDivElement` - The main container

#### `createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K]`

Creates an element with optional class names.

**Parameters:**

- `tag: K` - HTML tag name
- `className?: string` - Optional CSS class names

**Returns:** The created HTML element

#### `renderOptionSet(): void`

Abstract method that must be implemented by derived classes to render the option set UI.

### Static Properties

#### `optionSetContainerClass: string`

CSS class for the option set container (`'tlk-option-set-container'`).

#### `selectedClass: string`

CSS class for selected items (`'active'`).

### Observed Attributes

- `data-option-set-data` - JSON string containing option set configuration
- `data-current-print-area-id` - Current print area identifier
- `data-current-option-set-id` - Current option set identifier
- `data-value-from-fieldset` - External value source

## Types

### BaseOptionItem

```typescript
interface BaseOptionItem {
  i: string // Item ID
  l: string // Label
  v: string // Value
  selecting?: boolean // Selection state
  additionalPricing?: any // Pricing information
}
```

### BaseOptionSetProps

```typescript
interface BaseOptionSetProps {
  optionSet: IOptionSetType | null
  currentPrintAreaId?: string
  currentOptionSetId?: string
  onSelect?: (id: string, e?: any) => void
}
```

### IOptionSetType

```typescript
interface IOptionSetType {
  i: string // Option set ID
  t: EOptionSet // Option set type
  l: string // Label
  displayStyle: string // Display style preference
  ol: TextOptionItem[] | FontOptionItem[] | ColorOptionItem[] | ImageOptionItem[]
}
```

## Constants

### EOptionSet

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

### DEFAULT_DISPLAY_STYLES

```typescript
const DEFAULT_DISPLAY_STYLES = {
  [EOptionSet.IMAGE_OPTION]: 'image_swatch',
  [EOptionSet.TEXT_OPTION]: 'text_vertical_list',
  [EOptionSet.FONT_OPTION]: 'font_dropdown_list',
  [EOptionSet.COLOR_OPTION]: 'color_swatch',
  [EOptionSet.MASK_OPTION]: 'mask_swatch',
}
```

### optionSetDataKeys

```typescript
const optionSetDataKeys = {
  [EOptionSet.IMAGE_OPTION]: 'files',
  [EOptionSet.TEXT_OPTION]: 'texts',
  [EOptionSet.COLOR_OPTION]: 'colors',
  [EOptionSet.FONT_OPTION]: 'fonts',
  [EOptionSet.MULTI_LAYOUT_OPTION]: 'multi_layout',
  [EOptionSet.IMAGELESS_OPTION]: 'values',
  [EOptionSet.MASK_OPTION]: 'masks',
}
```

### tlkOptionSetClickEvent

```typescript
const tlkOptionSetClickEvent = 'tlk-option-set-click'
```

## Events

### tlk-option-set-click

Dispatched when an option is selected.

**Event Detail:**

```typescript
interface OptionSetClickEventDetail {
  optionSet: IOptionSetType
  currentPrintAreaId: string
  currentOptionSetId: string
  event?: Event
}
```

**Example:**

```typescript
element.addEventListener('tlk-option-set-click', event => {
  const { optionSet, currentPrintAreaId, currentOptionSetId } = event.detail
  console.log('Selected option:', optionSet)
})
```

## Global Personalizer State (Inline ↔ Modal)

The storefront uses a lightweight in-memory store to sync selection state between the inline and modal `tailorkit-product-personalizer` instances.

### Instance Id

An instance is identified by `${productId}::${variantId}`.

### Snapshot Shape

```ts
interface PersonalizerSnapshot {
  metaData: Record<string, Record<string, any>> // printAreaId -> layerId -> meta
  displayData: Record<string, Record<string, any>> // printAreaId -> layerId -> display rows
}
```

### API

```ts
import { PersonalizerStore } from '../assets/libraries/personalizer-store'

// get
const snapshot = PersonalizerStore.getState(instanceId)

// set
PersonalizerStore.setSnapshot(instanceId, { metaData, displayData })

// subscribe
const unsubscribe = PersonalizerStore.subscribe(instanceId, () => {
  // re-apply snapshot to DOM and refresh canvas
})
```

### Behavior

- The modal instance is treated as the active source when open.
- Inline instance pulls from the store on changes and on modal close.
- Canvas/preview and cart data refresh via existing events (`tailorkit-set-options`).

## Registration Functions

### registerOptionSetElements()

Registers all option set web components.

**Usage:**

```typescript
import { registerOptionSetElements } from './shared/components'

// Register all components
registerOptionSetElements()
```

**Registered Components:**

- `tailorkit-color-options-list`
- `tailorkit-color-swatch`
- `tailorkit-color-dropdown`
- `tailorkit-font-options-list`
- `tailorkit-font-swatch`
- `tailorkit-font-dropdown`
- `tailorkit-image-options-list`
- `tailorkit-image-swatch`
- `tailorkit-image-dropdown`
- `tailorkit-text-options-list`
- `tailorkit-text-swatch`
- `tailorkit-text-dropdown`

## CSS Classes

### Container Classes

- `tlk-option-set-container` - Main container for all option sets
- `emtlkit--[component]-container` - Component-specific containers

### Utility Classes

- `emtlkit--d-flex` - Display flex
- `emtlkit--gap-8` - Gap spacing
- `emtlkit--active` - Active/selected state
- `emtlkit--hidden` - Hidden elements

### Component-Specific Classes

- `emtlkit--color-selector-button` - Color selection buttons
- `emtlkit--font-dropdown-item` - Font dropdown items
- `emtlkit--image-swatch-container` - Image swatch containers
- `emtlkit--text-option-item` - Text option items

## Error Handling

### Common Error Scenarios

1. **Invalid JSON in data-option-set-data**
   - Error logged to console
   - Component renders empty state

2. **Missing required attributes**
   - Component uses default values
   - Warning logged to console

3. **Custom elements not supported**
   - Error logged to console
   - Registration skipped

### Error Recovery

Components are designed to gracefully handle errors:

- Invalid data results in empty rendering
- Missing attributes use sensible defaults
- Event listeners continue to work even with errors
- Console warnings help with debugging
