/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'

interface FontFamily {
  src: string
  family: string
  additionalPricing?: any
}

interface FontOptionsListProps {
  defaultFontFamily: FontFamily
  fieldsetData?: {
    layerId: string
    printAreaId: string
    optionSetId: string
  } | null
}

interface SelectedFont {
  family: string
  src: string
  name: string
  isDefault: boolean
}

/**
 * FontOptionsList component renders a font selector with dropdown functionality
 * @param props - Component props containing font options and configuration
 * @returns JSX element with font selector fieldset
 */
export function FontOptionsList({ defaultFontFamily, fieldsetData }: FontOptionsListProps): JSX.Element {
  const [selectedFont, setSelectedFont] = useState<SelectedFont | null>(null)
  // {
  // family: defaultFontFamily.family,
  // src: defaultFontFamily.src,
  // name: defaultFontFamily.family,
  // isDefault: true,
  // }

  useEffect(() => {
    // Check localStorage for saved font selection
    const checkLocalStorage = () => {
      try {
        if (!fieldsetData || !fieldsetData.layerId || !fieldsetData.printAreaId || !fieldsetData.optionSetId) {
          return
        }

        const { layerId, printAreaId, optionSetId } = fieldsetData
        const valueKey = `tlk_${printAreaId}_${layerId}_${optionSetId}`
        const dataKey = `tlk_${printAreaId}_${layerId}_${optionSetId}_data`

        const savedValue = localStorage.getItem(valueKey)
        const savedData = localStorage.getItem(dataKey)

        if (savedValue && savedData) {
          try {
            const fontData = JSON.parse(savedData)
            const newSelectedFont = {
              family: fontData.family || defaultFontFamily.family,
              src: savedValue,
              name: fontData.name || fontData.family || defaultFontFamily.family,
              isDefault: false, //fontData.isDefault === 'true',
            }

            // Update component state
            setSelectedFont(newSelectedFont)

            const fieldset = document.querySelector(
              `fieldset[data-option-type="font_option"][data-layer-id="${layerId}"]`
            )
            if (fieldset) {
              fieldset.setAttribute('value', savedValue)
              fieldset.setAttribute('data-name', newSelectedFont.name)
              fieldset.setAttribute('data-family', newSelectedFont.family)
              fieldset.setAttribute('data-default', fontData.isDefault || 'false')

              // Update pricing if available
              if (fontData.additionalPricing) {
                fieldset.setAttribute('data-pricing', JSON.stringify(fontData.additionalPricing))
              }
            }
          } catch (e) {
            console.error('Failed to parse saved font data:', e)
          }
        }
      } catch (error) {
        console.error('Error checking localStorage for font:', error)
      }
    }

    // Check localStorage after component mounts
    checkLocalStorage()
  }, [defaultFontFamily, fieldsetData])

  const displayText
    = selectedFont?.isDefault && selectedFont?.name ? `${selectedFont.name} (Default)` : selectedFont?.name || '--'

  return (
    <div className="emtlkit--font-option-set">
      <button
        className="emtlkit--font-selector emtlkit--w-100 emtlkit--d-flex emtlkit--flex-between emtlkit--flex-center emtlkit--flex-space-between"
        data-popover-trigger="true"
        aria-label="Select font"
        data-name={selectedFont?.name}
        data-family={selectedFont?.family}
        key={`${selectedFont?.src}-${selectedFont?.family}`}
      >
        <span className="emtlkit--selected-font" style={{ fontFamily: `'${selectedFont?.family}'` }}>
          {displayText}
        </span>
        <span className="emtlkit--dropdown-arrow">
          <svg className="down" viewBox="0 0 20 20" focusable="false" aria-hidden="true">
            <path
              // eslint-disable-next-line max-len
              d="M10 14a.997.997 0 0 1-.707-.293l-5-5a.999.999 0 1 1 1.414-1.414L10 11.586l4.293-4.293a.999.999 0 1 1 1.414 1.414l-5 5A.997.997 0 0 1 10 14z"
              fill="currentColor"
            />
          </svg>
        </span>
      </button>
    </div>
  )
}
