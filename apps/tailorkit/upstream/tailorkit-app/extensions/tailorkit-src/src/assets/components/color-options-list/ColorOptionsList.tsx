/** @jsxImportSource preact */
import type { JSX } from 'preact'

interface ColorOption {
  i: string
  l: string
  v: string
  s?: number
  additionalPricing?: any
}

interface ColorOptionsListProps {
  options: ColorOption[]
  currentPrintAreaId: string
  currentOptionSetId: string
}

/**
 * ColorOptionsList component renders a list of color options for product customization
 * @param props - Component props containing options and configuration
 * @returns JSX element with color options
 */
export function ColorOptionsList({
  options,
  currentPrintAreaId,
  currentOptionSetId,
}: ColorOptionsListProps): JSX.Element {
  const radioName = `${currentPrintAreaId} / ${currentOptionSetId}`

  // Compute once before the loop to avoid O(n²) complexity
  const hasSelectedOption = options.some(o => o.s === 1)

  return (
    <>
      {options.map((option, index) => {
        if (!option) return null

        // Check if this option is selected (first option by default or option with s === 1)
        const isSelected = option.s === 1 || (index === 0 && !hasSelectedOption)
        const optionClass = `emtlkit-color-option${isSelected ? ' active' : ''}`

        // Get pricing data for this option
        let pricingData = ''
        if (option.additionalPricing) {
          try {
            pricingData = JSON.stringify(option.additionalPricing)
          } catch (e) {
            console.error('Failed to stringify pricing data:', e)
          }
        }

        return (
          <div
            key={option.i}
            className={`emtlkit--option-container ${optionClass}`}
            style={{
              cursor: 'pointer',
              backgroundColor: option.v,
            }}
          >
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
