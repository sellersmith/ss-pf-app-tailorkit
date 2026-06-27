# TailorKit Cart Page Customizer - Developer Documentation

## Overview

The **TailorKit Cart Page Customizer** is a TypeScript class responsible for customizing product images on Shopify cart pages with personalized preview images. It automatically detects customized products in the cart and replaces their default images with user-generated preview images stored in cart item properties.

## Architecture

### Class-Based Design

- **Single Responsibility**: Handles only cart page image customization
- **Observer Pattern**: Monitors cart changes and responds accordingly
- **Debounced Operations**: Prevents excessive re-initializations during rapid cart updates
- **Resource Management**: Proper cleanup and memory management

### Key Components

```typescript
class TailorKitCartPageCustomizer {
  private itemsCart: ShopifyCartItem[] // Current cart items
  private processedItems: Set<string> // Tracks processed cart items
  private cartObserverCleanup: () => void // Observer cleanup function
  private isInitialized: boolean // Initialization state
  private debounceTimeout: NodeJS.Timeout // Debounce timer
}
```

## Core Functionality

### 1. Initialization Process

```typescript
private async init(): Promise<void>
```

**Purpose**: Initializes the cart customizer with proper error handling and state management.

**Flow**:

1. Checks if already initialized (prevents duplicate instances)
2. Displays welcome message via `welcomeMsg()`
3. Loads current cart data from Shopify
4. Starts customization if cart contains items
5. Sets up cart change observer
6. Marks as initialized

**Error Handling**: Catches and logs initialization failures without breaking the page.

### 2. Cart Data Management

```typescript
private async loadCartData(newCartItems?: ShopifyCartItem[]): Promise<void>
```

**Purpose**: Fetches cart data from Shopify's cart.js endpoint or uses provided cart items.

**Parameters**:

- `newCartItems` (optional): Pre-loaded cart items from observer callbacks

**Implementation Details**:

- Uses Shopify's standard cart.js endpoint
- Handles routing through `window.Shopify.routes.root`
- Validates HTTP responses
- Updates internal cart state

### 3. Image Customization

```typescript
private async customizeCartItem(cartItem: ShopifyCartItem, imageElement: HTMLImageElement): Promise<void>
```

**Purpose**: Replaces default product images with personalized preview images.

**Key Features**:

- **Preview Detection**: Checks for `CANVAS_PREVIEW_PROPERTY_KEY` in cart item properties
- **Image Replacement**: Swaps src attribute with preview URL
- **Loading States**: Applies smooth opacity transitions during image loading
- **Fallback Handling**: Restores original image if preview fails to load
- **Duplicate Prevention**: Tracks processed items to avoid re-processing

### 4. DOM Interaction

```typescript
private getCartImages(): HTMLImageElement[]
```

**Purpose**: Locates cart item images using dynamic selectors from helper data.

**Dependencies**:

- Requires `window.TAILORKIT_HELPER_DATA.cart_item_image_selector`
- Uses theme-specific CSS selectors for maximum compatibility

### 5. Cart Change Observation

```typescript
private setupCartObserver(): void
```

**Purpose**: Monitors cart changes for AJAX-based cart updates.

**Implementation**:

- Uses external `observeCartChanges` utility
- Implements debounced reinitialization
- Provides cleanup mechanisms
- Handles observer setup failures gracefully

## Data Structures

### ShopifyCartItem Interface

```typescript
interface ShopifyCartItem {
  key: string // Unique cart item identifier
  id: number // Product variant ID
  properties: Record<string, any> // Custom properties (includes preview URLs)
  [key: string]: any // Additional Shopify cart item properties
}
```

### Preview Property Structure

Cart items store preview URLs in properties using the constant `CANVAS_PREVIEW_PROPERTY_KEY`:

```typescript
{
  properties: {
    [CANVAS_PREVIEW_PROPERTY_KEY]: "https://preview-url.com/image.png"
  }
}
```

## Configuration Requirements

### 1. Helper Data

The customizer requires global helper data:

```javascript
window.TAILORKIT_HELPER_DATA = {
  cart_item_image_selector: '.cart-item img', // Theme-specific selector
}
```

### 2. Shopify Routes

Utilizes Shopify's global routes object:

```javascript
window.Shopify.routes.root // Base URL for cart.js endpoint
window.routes.cart_url // Cart page URL for path detection
```

## Performance Considerations

### 1. Debounced Reinitialization

- **Purpose**: Prevents excessive API calls during rapid cart updates
- **Timeout**: 50ms debounce delay
- **Benefit**: Reduces server load and improves UX

### 2. Processed Items Tracking

- **Implementation**: Uses Set for O(1) lookup performance
- **Purpose**: Avoids reprocessing same cart items
- **Memory**: Cleared during reinitialization

### 3. Image Preloading

```typescript
private loadImage(url: string): Promise<void>
```

- **Approach**: Creates temporary Image objects for preloading
- **CORS**: Sets `crossOrigin = 'anonymous'` for cross-domain images
- **Error Handling**: Provides fallback to original images

## Error Handling Strategy

### 1. Graceful Degradation

- Initialization failures don't break the cart page
- Image loading failures restore original images
- Observer setup failures are logged but don't prevent core functionality

### 2. Comprehensive Logging

```typescript
console.error('[TailorKit Cart] Context:', error)
```

- All errors include `[TailorKit Cart]` prefix for easy debugging
- Contextual information provided for troubleshooting

### 3. State Recovery

- Failed operations restore previous state
- Cleanup methods prevent memory leaks
- Reinitialization clears corrupted state

## Integration Points

### 1. Theme Integration

- **Requirement**: Theme must provide cart item image selectors
- **Compatibility**: Works with any Shopify theme structure
- **Customization**: Selector configuration through helper data

### 2. Shopify Cart API

- **Endpoint**: `/cart.js` for cart data retrieval
- **Format**: Standard Shopify cart JSON format
- **Authentication**: Uses existing session cookies

### 3. TailorKit Ecosystem

- **Constants**: Imports `CANVAS_PREVIEW_PROPERTY_KEY`
- **Utilities**: Uses `welcomeMsg()` and `observeCartChanges()`
- **Logging**: Integrates with TailorKit logging system

## Usage Examples

### Basic Initialization

```typescript
// Automatic initialization on cart pages
// No manual instantiation required
```

### Manual Control

```typescript
// Access global instance
const customizer = window.__tailorkit_cart_customizer__

// Destroy instance
customizer?.destroy()

// Force reinitialization
window.__tailorkit_cart_customizer__ = new TailorKitCartPageCustomizer()
```

### Debug Information

```typescript
// Check if customizer is active
console.log('Customizer active:', !!window.__tailorkit_cart_customizer__)

// View processed items
console.log('Processed items:', customizer.processedItems)
```

## Troubleshooting

### Common Issues

1. **Images Not Customizing**
   - Check `TAILORKIT_HELPER_DATA.cart_item_image_selector`
   - Verify cart items have preview properties
   - Confirm cart page URL detection

2. **Performance Issues**
   - Verify debounce timeout is appropriate
   - Check for memory leaks in observer cleanup
   - Monitor processed items set size

3. **AJAX Cart Conflicts**
   - Ensure observer is properly setup
   - Check for conflicting cart update handlers
   - Verify reinitialization is triggered

### Debug Commands

```javascript
// Check helper data
console.log(window.TAILORKIT_HELPER_DATA)

// Verify cart data
fetch('/cart.js')
  .then(r => r.json())
  .then(console.log)

// Test image selector
console.log(document.querySelectorAll(window.TAILORKIT_HELPER_DATA?.cart_item_image_selector))
```

## Testing Considerations

### Unit Testing

- Mock Shopify cart API responses
- Test error handling scenarios
- Verify cleanup operations
- Test debounce functionality

### Integration Testing

- Test with various Shopify themes
- Verify AJAX cart compatibility
- Test image loading failures
- Validate observer behavior

### Performance Testing

- Monitor memory usage during cart updates
- Test with large cart item counts
- Verify debounce effectiveness
- Check image loading performance

## Future Enhancements

### Potential Improvements

1. **Configuration API**: Allow runtime selector configuration
2. **Image Caching**: Implement preview image caching
3. **Animation Options**: Configurable transition effects
4. **Batch Processing**: Optimize multiple image updates
5. **Analytics Integration**: Track customization success rates

### Scalability Considerations

- Support for multiple cart formats
- Enhanced error recovery mechanisms
- Performance monitoring integration
- Advanced debugging tools

## Dependencies

### External Dependencies

- `observeCartChanges` utility function
- `CANVAS_PREVIEW_PROPERTY_KEY` constant
- `welcomeMsg` logging function

### Browser Requirements

- ES2017+ support (async/await)
- DOM mutation observer support
- Fetch API support
- Image loading event support

### Shopify Requirements

- Standard Shopify cart.js endpoint
- Shopify global objects (routes, etc.)
- Theme compatibility for image selectors
