# Tooltip Component

A flexible and accessible tooltip component for TailorKit that provides contextual information on hover, click, or focus interactions.

## Features

- **Multiple positioning options**: top, bottom, left, right with alignment variants
- **Flexible triggers**: hover, click, focus, or manual control
- **Customizable delays**: configurable show/hide delays
- **Responsive design**: automatically adjusts to viewport boundaries
- **Accessibility support**: proper ARIA attributes and keyboard navigation
- **Smooth animations**: fade in/out transitions with CSS animations
- **Dark theme support**: automatic dark mode detection
- **TypeScript support**: fully typed with comprehensive interfaces

## Installation

```typescript
import Tooltip from './path/to/tooltip'
import { TooltipManager, createTooltip } from './path/to/tooltip/utils'
import './path/to/tooltip/styles.css'
```

## Basic Usage

```typescript
// Create a simple tooltip
const tooltip = new Tooltip(triggerElement, {
  content: 'This is a helpful tooltip',
})

// Or use the static factory method
const tooltip = Tooltip.create(triggerElement, {
  content: 'This is a helpful tooltip',
  position: 'top',
})
```

## API Reference

### Constructor

```typescript
new Tooltip(triggerElement: HTMLElement, options: TooltipOptions)
```

### TooltipOptions Interface

```typescript
interface TooltipOptions {
  content: string // Required: tooltip text content
  position?: TooltipPosition // Default: 'top'
  trigger?: TooltipTrigger // Default: 'hover'
  delay?: number // Default: 0 (ms)
  hideDelay?: number // Default: 0 (ms)
  className?: string // Additional CSS classes
  maxWidth?: number // Default: 200 (px)
  disabled?: boolean // Default: false
  offset?: number // Default: 8 (px)
  zIndex?: number // Default: 1000
  appendTo?: HTMLElement | string // Default: document.body
  onShow?: () => void // Show callback
  onHide?: () => void // Hide callback
  onToggle?: (visible: boolean) => void // Toggle callback
}
```

### Position Options

```typescript
type TooltipPosition = 'top' | 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right' | 'left' | 'right'
```

### Trigger Options

```typescript
type TooltipTrigger = 'hover' | 'click' | 'focus' | 'manual'
```

## Methods

### Public Methods

```typescript
// Show/hide control
tooltip.show()                    // Show tooltip immediately
tooltip.hide()                    // Hide tooltip immediately
tooltip.toggle()                  // Toggle visibility

// Content management
tooltip.updateContent(content: string)     // Update tooltip text
tooltip.setPosition(position: TooltipPosition) // Change position

// State management
tooltip.enable()                  // Enable tooltip
tooltip.disable()                 // Disable tooltip
tooltip.destroy()                 // Clean up and remove

// State queries
tooltip.isShown(): boolean        // Check if visible
tooltip.getElement(): HTMLElement | null // Get tooltip DOM element
```

## Usage Examples

### Basic Tooltip

```typescript
const tooltip = new Tooltip(document.getElementById('my-button'), {
  content: 'Click me to perform an action',
})
```

### Positioned Tooltip

```typescript
const tooltip = new Tooltip(element, {
  content: 'This appears below the element',
  position: 'bottom-left',
})
```

### Click Trigger with Delay

```typescript
const tooltip = new Tooltip(element, {
  content: 'Click to see this tooltip',
  trigger: 'click',
  delay: 300,
  hideDelay: 1000,
})
```

### Custom Styling

```typescript
const tooltip = new Tooltip(element, {
  content: 'Custom styled tooltip',
  className: 'my-custom-tooltip',
  maxWidth: 300,
  zIndex: 9999,
})
```

### With Callbacks

```typescript
const tooltip = new Tooltip(element, {
  content: 'Tooltip with callbacks',
  onShow: () => console.log('Tooltip shown'),
  onHide: () => console.log('Tooltip hidden'),
  onToggle: visible => console.log('Tooltip visibility:', visible),
})
```

### Manual Control

```typescript
const tooltip = new Tooltip(element, {
  content: 'Manually controlled tooltip',
  trigger: 'manual',
})

// Control programmatically
document.getElementById('show-btn').addEventListener('click', () => {
  tooltip.show()
})

document.getElementById('hide-btn').addEventListener('click', () => {
  tooltip.hide()
})
```

### Dynamic Content

```typescript
const tooltip = new Tooltip(element, {
  content: 'Initial content',
})

// Update content dynamically
setTimeout(() => {
  tooltip.updateContent('Updated content after 2 seconds')
}, 2000)
```

## Styling

The component uses CSS custom properties and follows BEM naming conventions:

```css
.emtlkit-tooltip {
  /* Base tooltip container */
}

.emtlkit-tooltip__content {
  /* Tooltip content area */
}

.emtlkit-tooltip__arrow {
  /* Tooltip arrow/pointer */
}

.emtlkit-tooltip--visible {
  /* Visible state */
}

.emtlkit-tooltip--top {
  /* Top positioned tooltip */
}
```

### Custom Styling Example

```css
.my-custom-tooltip .emtlkit-tooltip__content {
  background: #333;
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
}

.my-custom-tooltip .emtlkit-tooltip__arrow {
  border-top-color: #333;
}
```

## Accessibility

The tooltip component includes several accessibility features:

- **Keyboard navigation**: Works with focus events
- **Screen reader support**: Proper ARIA attributes
- **High contrast support**: Respects system preferences
- **Reduced motion**: Respects `prefers-reduced-motion`

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Performance Considerations

- Tooltips are created lazily and reused
- Event listeners are properly cleaned up
- Positioning calculations are optimized
- CSS animations are hardware accelerated

## Figma Design Implementation

This component implements the tooltip design from the provided Figma file, featuring:

- White background with 8px border radius
- Drop shadow matching the design specifications
- Proper arrow positioning and styling
- Responsive text wrapping
- Consistent typography and spacing

## Memory Leak Prevention

The tooltip component includes built-in memory leak prevention:

### Automatic Instance Management

```typescript
// ✅ RECOMMENDED: Use TooltipManager or createTooltip
import { createTooltip, TooltipManager } from './path/to/tooltip/utils'

// This automatically reuses existing instances
const tooltip1 = createTooltip(buttonElement, { content: 'First tooltip' })
const tooltip2 = createTooltip(buttonElement, { content: 'Updated tooltip' }) // Reuses tooltip1

// Or use TooltipManager directly
const tooltip = TooltipManager.createOrUpdate(buttonElement, { content: 'Safe tooltip' })
```

### Manual Instance Management

```typescript
// ✅ GOOD: Check for existing instances
const existingTooltip = Tooltip.getInstance(buttonElement)
if (existingTooltip) {
  existingTooltip.updateOptions({ content: 'Updated content' })
} else {
  new Tooltip(buttonElement, { content: 'New tooltip' })
}

// ✅ GOOD: Clean up when done
Tooltip.destroyInstance(buttonElement)
```

### Batch Operations

```typescript
// Create multiple tooltips safely
const buttons = document.querySelectorAll('.upload-button')
TooltipManager.createBatch(Array.from(buttons), {
  content: 'Upload files',
  trigger: 'hover',
})

// Clean up multiple tooltips
TooltipManager.destroyBatch(Array.from(buttons))
```

### Using TooltipMixin for Classes

```typescript
import { TooltipMixin } from './path/to/tooltip/utils'

class MyComponent extends TooltipMixin {
  init() {
    // Use addTooltip instead of new Tooltip
    this.addTooltip(this.uploadButton, {
      content: 'Upload files',
      trigger: 'hover',
    })
  }

  destroy() {
    // Automatically cleans up all tooltips
    super.destroy()
  }
}
```

### ❌ What NOT to Do

```typescript
// ❌ BAD: Creates memory leaks
function onButtonClick() {
  new Tooltip(buttonElement, { content: 'Tooltip' }) // Creates new instance every time
}

// ❌ BAD: No cleanup
const tooltip = new Tooltip(buttonElement, { content: 'Tooltip' })
// Element removed from DOM but tooltip instance still exists
```

## Contributing

When contributing to this component:

1. Follow the established TypeScript patterns
2. Maintain accessibility standards
3. Add appropriate tests for new features
4. Update documentation for API changes
5. Ensure cross-browser compatibility
6. Always use TooltipManager for instance management
7. Test for memory leaks in dynamic scenarios
