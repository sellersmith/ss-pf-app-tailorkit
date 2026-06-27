/** @jsxImportSource preact */
import type { JSX } from 'preact'

interface TextOption {
  i: string
  l: string
  v: string
  s?: number
  additionalPricing?: any
}

interface TextOptionsListProps {
  options: TextOption[]
  currentPrintAreaId: string
  currentOptionSetId: string
}

/**
 * TextOptionsList component renders a fieldset with text options for product customization
 * @param props - Component props containing options and configuration
 * @returns JSX element with text options fieldset
 */
export function TextOptionsList({
  options,
  currentPrintAreaId,
  currentOptionSetId,
}: TextOptionsListProps): JSX.Element {
  const radioName = `${currentPrintAreaId} / ${currentOptionSetId}`

  return (
    <>
      {options.map(option => {
        if (!option) return null

        const isSelected = option.s === 1
        const optionClass = `emtlkit--option-container emtlkit-text-option${isSelected ? ' active' : ''}`

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
          <div key={option.i} className={optionClass}>
            {option.v}
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
