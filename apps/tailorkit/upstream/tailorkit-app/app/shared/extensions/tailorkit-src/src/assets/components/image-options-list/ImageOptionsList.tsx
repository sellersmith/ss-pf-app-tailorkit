/** @jsxImportSource preact */
import type { JSX } from 'preact'

interface Option {
  i: string
  l: string
  v: string
  s?: number
  additionalPricing?: any
}

interface ImageOptionsListProps {
  options: Option[]
  currentPrintAreaId: string
  currentOptionSetId: string
  optionSetType: string
}

/**
 * ImageOptionsList component renders a list of image options for product customization
 * @param props - Component props containing options and configuration
 * @returns JSX element with image options
 */
export function ImageOptionsList({
  options,
  currentPrintAreaId,
  currentOptionSetId,
  optionSetType,
}: ImageOptionsListProps): JSX.Element {
  const radioName = `${currentPrintAreaId} / ${currentOptionSetId}`

  // Compute once before the loop to avoid O(n²) complexity
  const hasSelectedOption = options.some(o => o.s === 1)

  return (
    <>
      {options.map((option, index) => {
        if (!option) return null

        // Check if this option is selected (first option by default or option with s === 1)
        const isSelected = option.s === 1 || (index === 0 && !hasSelectedOption)
        const optionClass = `${optionSetType === 'mask_option' ? 'emtlkit-mask-option' : 'emtlkit-image-option'}${isSelected ? ' active' : ''}`

        // Get pricing data for this option
        let pricingData = ''
        if (option.additionalPricing) {
          try {
            pricingData = JSON.stringify(option.additionalPricing)
          } catch (e) {
            console.error('Failed to stringify pricing data:', e)
          }
        }

        const width = 60
        const height = 60

        // Handle image URL optimization
        const isShopifyCdn = option.v.includes('cdn.shopify.com') || option.v.includes('cdn/shop/files')
        const optionUrl = isShopifyCdn ? `${option.v}&width=${width * 2}` : option.v

        return (
          <div key={option.i} className={`emtlkit--option-container ${optionClass}`}>
            <img width={width} height={height} alt={option.l} src={optionUrl} loading="lazy" />
            <input
              type="radio"
              name={radioName}
              value={option.v}
              data-id={option.i}
              data-name={option.l}
              defaultChecked={isSelected}
              {...(pricingData && {
                'data-pricing': pricingData,
              })}
            />
          </div>
        )
      })}
    </>
  )
}
