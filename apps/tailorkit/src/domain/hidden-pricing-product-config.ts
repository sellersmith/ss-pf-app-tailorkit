// Shared definition of the hidden Shopify product that carries the TailorKit personalization fee.
// The storefront add-to-cart middleware charges the fee by adding this product to the cart, and it
// reads the product at `/products/<handle>.js` — so the handle MUST stay `tailorkit-item-personalization`
// (= `${APP_HANDLE}-item-personalization`, APP_HANDLE = 'tailorkit') to match the storefront reader.
// Both the /option-pricing route and the theme-config server-side provisioner use this single source.
export const TAILORKIT_HIDDEN_PRICING_PRODUCT = {
  handle: 'tailorkit-item-personalization',
  title: 'Personalization Price',
  productType: 'TLK_HIDDEN_PRODUCT',
  vendor: 'TailorKit',
  tags: ['tailorkit', 'internal', 'hidden', 'option-pricing'],
  descriptionHtml:
    '<p>Hidden product used by <strong>TailorKit Product Personalizer</strong> to charge personalization fees. Not for sale — do not delete, unpublish, or change its price/handle/availability.</p>',
}
