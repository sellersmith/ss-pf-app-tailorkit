/**
 * CSS styles for the <tailorkit-charm-picker> Web Component.
 * Injected once into document.head via <style> tag.
 * All classes use the emtlkit-- prefix for consistency.
 */
export const charmPickerStyles = /* css */ `
  .emtlkit--charm-picker {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 0;
  }

  /* Header: label + selection count/cost */
  .emtlkit--charm-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .emtlkit--charm-picker-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--emtlkit-text-color, #1a1a1a);
  }

  .emtlkit--charm-picker-count {
    font-size: 13px;
    font-weight: 500;
    color: var(--emtlkit-text-secondary, #666);
  }

  /* Collection tabs */
  .emtlkit--charm-picker-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .emtlkit--charm-picker-tabs button {
    padding: 4px 12px;
    border-radius: 16px;
    border: 1px solid var(--emtlkit-border-color, #d4d4d4);
    background: transparent;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    color: var(--emtlkit-text-color, #1a1a1a);
  }

  .emtlkit--charm-picker-tabs button:hover {
    border-color: var(--emtlkit-accent-color, #333);
  }

  .emtlkit--charm-picker-tabs button.emtlkit--active {
    background: var(--emtlkit-accent-color, #333);
    color: #fff;
    border-color: var(--emtlkit-accent-color, #333);
  }

  /* Charm product grid */
  .emtlkit--charm-picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
  }

  /* Individual charm item */
  .emtlkit--charm-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }

  /* Thumbnail wrapper */
  .emtlkit--charm-thumbnail {
    width: 80px;
    height: 80px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    transition: border-color 0.15s;
    cursor: pointer;
  }

  .emtlkit--charm-thumbnail:hover {
    border-color: var(--emtlkit-accent-color, #333);
  }

  .emtlkit--charm-item.emtlkit--selected .emtlkit--charm-thumbnail {
    border-color: var(--emtlkit-accent-color, #333);
  }

  .emtlkit--charm-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Charm title — truncated with native tooltip on hover via title attr */
  .emtlkit--charm-title {
    font-size: 11px;
    line-height: 1.2;
    color: var(--emtlkit-text-color, #1a1a1a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 80px;
  }

  /* Per-charm price */
  .emtlkit--charm-price {
    font-size: 11px;
    color: var(--emtlkit-text-secondary, #666);
  }

  /* Quantity stepper */
  .emtlkit--charm-stepper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .emtlkit--charm-stepper-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--emtlkit-border-color, #d4d4d4);
    background: transparent;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
    color: var(--emtlkit-text-color, #1a1a1a);
    padding: 0;
  }

  .emtlkit--charm-stepper-btn:hover:not(:disabled) {
    border-color: var(--emtlkit-accent-color, #333);
    background: var(--emtlkit-accent-color, #333);
    color: #fff;
  }

  .emtlkit--charm-stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .emtlkit--charm-stepper-count {
    font-size: 13px;
    min-width: 16px;
    text-align: center;
    font-weight: 500;
    color: var(--emtlkit-text-color, #1a1a1a);
  }

  /* Sold-out state */
  .emtlkit--charm-item.emtlkit--sold-out {
    opacity: 0.5;
    pointer-events: none;
    position: relative;
  }

  .emtlkit--charm-item.emtlkit--sold-out .emtlkit--charm-thumbnail {
    cursor: default;
  }

  .emtlkit--charm-sold-out-badge {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--emtlkit-text-secondary, #666);
    letter-spacing: 0.5px;
  }

  /* Sale / compare-at price */
  .emtlkit--charm-sale-price {
    color: #c00;
    font-weight: 500;
  }

  .emtlkit--charm-compare-price {
    text-decoration: line-through;
    color: var(--emtlkit-text-secondary, #999);
    font-size: 10px;
  }

  /* Empty state */
  .emtlkit--charm-picker-empty {
    font-size: 13px;
    color: var(--emtlkit-text-secondary, #666);
    text-align: center;
    padding: 16px 0;
  }

  /* Loading state */
  .emtlkit--charm-picker-loading {
    font-size: 13px;
    color: var(--emtlkit-text-secondary, #666);
    text-align: center;
    padding: 16px 0;
  }

  /* Error state with retry */
  .emtlkit--charm-picker-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
    font-size: 13px;
    color: var(--emtlkit-text-secondary, #666);
  }

  .emtlkit--charm-picker-error-detail {
    max-width: 400px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--emtlkit-text-secondary, #888);
    text-align: center;
  }

  .emtlkit--charm-retry-btn {
    padding: 4px 16px;
    border-radius: 4px;
    border: 1px solid var(--emtlkit-border-color, #d4d4d4);
    background: transparent;
    font-size: 12px;
    cursor: pointer;
    color: var(--emtlkit-text-color, #1a1a1a);
  }

  .emtlkit--charm-retry-btn:hover {
    background: var(--emtlkit-accent-color, #333);
    color: #fff;
    border-color: var(--emtlkit-accent-color, #333);
  }

  /* Mobile: larger touch targets for stepper buttons (44px per Apple HIG) */
  @media (max-width: 768px) {
    .emtlkit--charm-stepper-btn {
      width: 36px;
      height: 36px;
      font-size: 18px;
    }

    .emtlkit--charm-stepper-count {
      font-size: 15px;
      min-width: 24px;
    }

    .emtlkit--charm-stepper {
      gap: 8px;
    }
  }

  /* Pointer-coarse devices (touch screens) — overrides max-width rule above for larger tap targets */
  @media (pointer: coarse) {
    .emtlkit--charm-stepper-btn {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }
  }
`
