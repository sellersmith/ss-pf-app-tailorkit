# TailorKit Buy It Now Handler

## Overview

TailorKit's Buy It Now handler solves the challenge of handling **all express checkout buttons** for products with customizations and additional pricing. Instead of complex draft order creation, we use a simpler and more reliable approach:

1. **Intercept** all express checkout button clicks for customized products
2. **Prevent** the default bypass-cart behavior
3. **Use** the existing Add to Cart middleware (which already handles pricing)
4. **Redirect** to checkout after successful add to cart

This provides the same fast checkout experience users expect while ensuring all customization data and pricing is properly handled.

## Express Checkout Buttons Handled

### **Modern Shopify Accelerated Checkout (2023+)**

- ✅ **Shop Pay** - Shopify's own payment method
- ✅ **PayPal Express Checkout** - PayPal's one-click payment
- ✅ **Apple Pay** - Apple's payment system
- ✅ **Google Pay** - Google's payment system
- ✅ **Microsoft Pay** - Microsoft's payment system
- ✅ **Amazon Pay** - Amazon's payment system
- ✅ **Meta Pay** - Facebook's payment system

### **Legacy Shopify Buttons**

- ✅ **Traditional Buy It Now** - Standard Shopify buy it now
- ✅ **Shopify Payment Button** - Legacy payment buttons

### **Additional Payment Methods**

- ✅ **Shop Pay Installments** - Buy now, pay later
- ✅ **Express Checkout** - Theme-specific express buttons
- ✅ **Quick Buy** - Theme variations
- ✅ **Instant Checkout** - Theme variations

## How It Works

### For Non-Customized Products

- All express checkout buttons work normally (no interference)
- Direct to checkout as expected
- Fast checkout experience preserved

### For Customized Products

1. **Button Click** → Handler intercepts the click
2. **Customization Check** → Verifies if product has active customizations
3. **Prevent Default** → Stops the express checkout flow
4. **Add to Cart** → Uses existing middleware to handle pricing
5. **Redirect** → Sends user to `/checkout` with proper cart data

## Technical Implementation

### Button Detection

The handler uses comprehensive CSS selectors to detect all express checkout buttons:

```typescript
const EXPRESS_CHECKOUT_SELECTORS = [
  // Modern Shopify Accelerated Checkout
  'shopify-accelerated-checkout button',
  'shopify-accelerated-checkout-cart button',

  // Legacy Shopify
  '[data-shopify="buy-now"]',
  '.shopify-payment-button button',

  // Payment Method Specific
  '[data-funding-source="paypal"]',
  '.apple-pay-button',
  '.google-pay-button',
  '.shop-pay-button',
  '[data-amazon-pay-button]',

  // Theme variations
  '.btn-buy-now',
  '.quick-buy',
  '.instant-checkout',
  // ... and many more
]
```

### Customization Detection

The handler checks for:

- Active option selections
- Text input content
- Uploaded images
- Any TailorKit properties

### Configuration

```typescript
initializeBuyItNowHandler({
  debugMode: false, // Enable console logging
  enabled: true, // Enable/disable feature
  redirectDelay: 200, // ms delay before redirect
})
```

## Integration

### Automatic Initialization

The handler is automatically initialized in `tailorkit.ts`:

```typescript
// Initialize Buy It Now handler
initializeBuyItNowHandler({
  debugMode: false,
  enabled: true,
  redirectDelay: 200,
})
```

### App Settings Override

You can control the behavior via app settings:

```json
{
  "buyItNowHandling": {
    "enabled": true,
    "mode": "redirect", // or "disable"
    "debugMode": false
  }
}
```

## User Experience

### Success Flow

1. User clicks any express checkout button
2. Shows toast: "Added to cart! Redirecting to checkout..."
3. Redirects to checkout with all customization data

### Error Handling

- Network errors → "Please try using the 'Add to Cart' button instead"
- Missing form → "Please use the 'Add to Cart' button for customized products"
- Graceful degradation in all cases

### Visual Feedback

- Toast notifications for all actions
- Smooth animations and transitions
- Clear, friendly error messages

## Inter-App Communication (Events API)

The Buy It Now handler dispatches events that other apps can listen to for integration.

### `tailorkit-prepare-cart-data` Event

Dispatched **before** cart submission, allowing other apps to inject data into the FormData.

```javascript
document.addEventListener('tailorkit-prepare-cart-data', event => {
  const { formData, variantId } = event.detail

  // Add your app's data to the cart request
  formData.append('items[addon_0][id]', 'addon_variant_id')
  formData.append('items[addon_0][quantity]', '1')
})
```

**Event Detail:**

- `formData` - The FormData object being submitted to `/cart/add.js`
- `variantId` - The variant ID of the main product

> **See also:** [Events API Documentation](./docs/events-api.md) for full details.

## Compatibility

### ✅ **App Compatible**

- Works with bundle apps
- Compatible with upsell apps (via Events API)
- No interference with cart apps
- Preserves discount functionality

### ✅ **Theme Compatible**

- Works with any Shopify theme
- Handles dynamic content loading
- Supports AJAX cart updates
- Responsive design friendly

### ✅ **Payment Method Compatible**

- All major payment providers
- Future-proof for new payment methods
- Handles payment method updates automatically

## Debugging

### Enable Debug Mode

```typescript
// In tailorkit.ts
initializeBuyItNowHandler({
  debugMode: true,
})
```

### Debug Output

```
[TailorKit] Initializing Buy It Now handler with config: {...}
[TailorKit] Attached handler to button: shopify-accelerated-checkout button
[TailorKit] Buy It Now clicked: <button>
[TailorKit] Intercepted Buy It Now for customized product
[TailorKit] Successfully added to cart: {...}
```

## Advanced Usage

### Custom Configuration Per Product

```typescript
// In customizer.ts initBuyItNowHandling method
const productSpecificConfig = {
  enabled: true,
  redirectDelay: 300, // Longer delay for complex products
  debugMode: this.getAttribute('data-debug') === 'true',
}
```

### Disable for Specific Products

```typescript
const appSettings = {
  buyItNowHandling: {
    enabled: false, // Disables for this product
  },
}
```

## Benefits

### **For Merchants**

- ✅ No lost sales from express checkout buttons
- ✅ Proper pricing for all checkout methods
- ✅ Consistent customization data
- ✅ Better conversion tracking

### **For Customers**

- ✅ Fast checkout experience maintained
- ✅ Clear feedback on actions
- ✅ Reliable customization handling
- ✅ All payment methods still available

### **For Developers**

- ✅ Simple, reliable implementation
- ✅ No complex API integrations
- ✅ Easy to debug and maintain
- ✅ Future-proof architecture

## Troubleshooting

### Common Issues

**Issue**: Express checkout buttons not being intercepted
**Solution**: Check if `EXPRESS_CHECKOUT_SELECTORS` includes your theme's specific selectors

**Issue**: Customizations not detected
**Solution**: Verify that `tailorkit-set-options` event is properly triggered

**Issue**: Redirect not working
**Solution**: Check browser console for errors, ensure `/checkout` is accessible

### Testing Checklist

- [ ] Non-customized products work normally
- [ ] Customized products get intercepted
- [ ] All payment buttons are handled
- [ ] Toast notifications appear
- [ ] Redirects to checkout properly
- [ ] Pricing is calculated correctly
- [ ] Error handling works gracefully
