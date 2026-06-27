# TailorKit Fetch API Interceptor System

## Overview

The TailorKit Fetch API Interceptor System provides a powerful way to intercept and modify HTTP requests and responses, specifically designed for Shopify cart management and add-to-cart functionality with enhanced canvas preview handling.

## Architecture

### Core Components

1. **createFetchProxy.ts** - Creates a proxy wrapper around the native fetch API with enhanced error handling
2. **interceptorTypes.ts** - TypeScript interfaces and types for interceptor functionality
3. **parseRequestBody.ts** - Advanced utility for parsing multiple request body formats (JSON, FormData, URL-encoded)
4. **constant.ts** - Configuration constants for cart API URLs and endpoints

### Interceptors

1. **handlerATCInterceptor** - Enhanced Add-to-Cart (ATC) interceptor with canvas preview support and base64 validation

## Features

### 🛒 Advanced Add-to-Cart Interception

- Intercepts and monitors all `/cart/add` requests with enhanced error handling
- Handles multiple request body formats (JSON, FormData, URL-encoded)
- Canvas preview image processing with base64 validation and server upload
- Supports both request-time and response-time processing modes
- Comprehensive logging system for debugging and monitoring

### ⚡ Flexible Processing

- **Request-time processing** (default) - Processes data when request is made
- **Response-time processing** - Processes data when response is received
- **FormData enhancement** - Automatically handles canvas preview uploads
- **Base64 validation** - Validates and processes canvas preview data URLs

### 🔧 Enhanced Configuration

- Window function overrides for custom implementations
- Environment-specific behavior controls
- Extensible interceptor pattern with TypeScript support
- Base64 data URL validation for secure image handling

## Usage

### Basic Setup

The interceptor system is automatically initialized when TailorKit loads:

```typescript
import { applyProxyForFetchApi } from './utils/interceptorFetchApi'

// Initialize interceptors
applyProxyForFetchApi()
```

### Custom Window Functions

Override default behavior using window functions:

```javascript
// Enable response-time processing instead of request-time
window.TailorKit.ADD_PRODUCT_FROM_TAILORKIT_PERSONALIZER_WITH_RESPONSE = true

// Custom reset interceptor handler
window.TailorKit.RESET_INTERCEPTOR_FETCH_API = proxiedFetch => {
  // Custom logic when interceptor is reset
}
```

## Interceptor Flow

### Request Interception

1. **handlerATCInterceptor** - Monitors `/cart/add` requests with enhanced error handling
2. **Base64 validation** - Validates canvas preview data URLs using `isValidBase64DataURL`
3. **FormData processing** - Handles canvas preview uploads via `handleAddProductToCartByFormData`
4. **Content type detection** - Parses request body based on content type (JSON, FormData, URL-encoded)
5. **Server upload** - Converts base64 previews to server URLs for cart storage

### Response Interception

1. **handlerATCInterceptor** - Processes cart addition responses with improved error handling
2. **JSON extraction** - Safely extracts JSON response data with error recovery
3. **Post-addition logic** - Handles subsequent cart updates and notifications

## Configuration

### Cart API URLs

```typescript
export const CART_API_URL = {
  cartChange: '/cart/change',
  cartItems: '/cart',
  cartAdd: '/cart/add',
}
```

### Processing Modes

The interceptor supports two processing modes:

1. **Request-time processing** (default) - Processes data when request is made
2. **Response-time processing** - Processes data when response is received

### Canvas Preview Handling

The system automatically handles canvas preview images in cart operations:

```typescript
// Canvas preview property key
const CANVAS_PREVIEW_PROPERTY_KEY = '_TailorKit_Canvas_Preview'

// Base64 validation regex
const dataURLRegex = /^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/i
```

### Interceptor Monitoring

The interceptor specifically monitors the `/cart/add` endpoint for:

- Adding items to cart
- Processing canvas preview data
- Handling FormData and JSON requests
- Base64 validation and server upload

## Events

The interceptor system provides comprehensive logging for monitoring and debugging:

```javascript
// Interceptor initialization
console.log('[TailorKit] Fetch API interceptors applied successfully')

// Add-to-cart processing
console.log('[TailorKit]: Handle for add to cart request by JSON', body)
console.log('[TailorKit]: Handle for add to cart request by FormData', formData)

// Base64 validation and upload
console.log('[TailorKit] Invalid base64 data URL:', error)
console.log('[TailorKit] Error uploading preview:', error)

// Request/response processing
console.log('[TailorKit handleAddToCartInterceptor] Error reading request:', error)
console.log('[TailorKit handleAddToCartInterceptor] Error reading response:', error)
```

## Development

### Adding New Interceptors

1. Create interceptor file in `interceptors/` directory
2. Implement `FetchInterceptor` interface
3. Add to interceptors array in `index.ts`

```typescript
import { type FetchInterceptor } from '../interceptorTypes'

export const myCustomInterceptor: FetchInterceptor = {
  async request(input, init) {
    // Modify request
    return [input, init]
  },

  async response(response) {
    // Modify response
    return response
  },
}
```

### Testing

Test interceptors by monitoring console logs:

- `[TailorKit]` prefix for all system logs
- Request/response logging available
- Error handling with graceful fallbacks

## Troubleshooting

### Common Issues

1. **Interceptors not working**
   - Check console for initialization logs
   - Verify no other code overwrites `window.fetch`
   - Ensure interceptor is properly initialized with `applyProxyForFetchApi()`

2. **Add-to-cart not being intercepted**
   - Verify requests use `/cart/add` endpoint
   - Check request format matches supported types
   - Validate base64 data URLs are properly formatted

3. **Processing mode conflicts**
   - Ensure consistent window function configuration
   - Check for conflicting request/response processing

4. **Base64 upload failures**
   - Verify base64 data URLs are valid image formats
   - Check server upload endpoint availability
   - Monitor network requests for upload errors

### Debug Mode

Monitor console output for detailed logging:

```javascript
// Check initialization
// Should see: "[TailorKit] Fetch API interceptors applied successfully"

// Monitor request/response processing
// Look for: "[TailorKit]: Handle for add to cart request..."

// Base64 validation and upload
// Look for: "[TailorKit] Invalid base64 data URL:" or upload confirmations

// Error handling
// Look for: "[TailorKit handleAddToCartInterceptor] Error reading request:"
```

## Performance

The interceptor system is designed for minimal performance impact:

- Only intercepts relevant cart API calls
- Efficient request body parsing
- Graceful error handling with fallbacks
- Minimal memory footprint

## Browser Support

- Modern browsers with Proxy support
- Shopify storefront environments
- Mobile browsers

## API Reference

### FetchInterceptor Interface

```typescript
interface FetchInterceptor {
  request?(
    input: RequestInfo,
    init?: RequestInit
  ): void | [RequestInfo, RequestInit] | [RequestInfo] | Promise<void | [RequestInfo, RequestInit] | [RequestInfo]>

  response?(
    response: Response,
    { input, init }: { input: RequestInfo; init?: RequestInit }
  ): Response | Promise<Response>
}
```

### Window Functions

```typescript
interface WindowFunctions {
  ADD_PRODUCT_FROM_TAILORKIT_PERSONALIZER_WITH_RESPONSE?: boolean
  RESET_INTERCEPTOR_FETCH_API?: (proxiedFetch: typeof fetch) => void
}
```

### Base64 Validation

```typescript
function isValidBase64DataURL(base64String: string): boolean
```

### FormData Handler

```typescript
function handleAddProductToCartByFormData(formData: FormData): Promise<FormData>
```

## Version History

- v1.0.0 - Initial implementation
  - Add-to-Cart request/response interception
  - Multiple request body format support (JSON, FormData, URL-encoded)
  - Canvas preview processing with base64 validation and server upload
  - Request-time and response-time processing modes
  - Window function configuration support
  - Comprehensive error handling and logging
  - TypeScript interfaces and type safety
