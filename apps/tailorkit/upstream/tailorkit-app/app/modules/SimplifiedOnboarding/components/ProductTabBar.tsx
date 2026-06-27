/**
 * ProductTabBar: horizontal tab strip for switching between products in bulk mode.
 * Shows product thumbnail + truncated title per tab, with a checkmark badge
 * when the current step is complete for that product.
 * Only rendered when selectedProducts.length > 1 and currentStep !== 'product'.
 */

import { Icon } from '@shopify/polaris'
import { CheckCircleIcon } from '@shopify/polaris-icons'
import type { PerProductState, WizardProduct, WizardStep } from '../types'
import styles from '../styles.module.css'

interface ProductTabBarProps {
  products: WizardProduct[]
  activeIndex: number
  perProductState: Record<string, PerProductState>
  currentStep: WizardStep
  onTabChange: (index: number) => void
}

/** Check if a product's per-product state is complete for the given step */
function isStepComplete(pps: PerProductState | undefined, step: WizardStep): boolean {
  if (!pps) return false
  switch (step) {
    case 'image':
      return !!pps.selectedImageUrl
    case 'mockup':
      return !!pps.mockupResult
    case 'templates':
      return !!pps.selectedTemplateType || !!pps.selectedExistingTemplate
    case 'preview':
      return !!pps.publishResult
    default:
      return false
  }
}

export function ProductTabBar({
  products,
  activeIndex,
  perProductState,
  currentStep,
  onTabChange,
}: ProductTabBarProps) {
  return (
    <div className={styles.productTabBar} role="tablist">
      {products.map((product, index) => {
        const isActive = index === activeIndex
        const pps = perProductState[product.id]
        const complete = isStepComplete(pps, currentStep)
        // Prefer user-selected image, fall back to featured (first) image
        const thumbnail = pps?.selectedImageUrl ?? product.images[0]?.url

        return (
          <button
            key={product.id}
            className={`${styles.productTab} ${isActive ? styles.productTabActive : ''}`}
            onClick={() => onTabChange(index)}
            type="button"
            aria-selected={isActive}
            role="tab"
          >
            {thumbnail ? (
              <img src={thumbnail} alt="" className={styles.productTabThumb} loading="lazy" />
            ) : (
              <span className={styles.productTabThumbPlaceholder} />
            )}
            <span className={styles.productTabTitle}>{product.title}</span>
            {complete && (
              <span className={styles.productTabBadge}>
                <Icon source={CheckCircleIcon} tone="success" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
