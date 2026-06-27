import type { Shape } from 'extensions/tailorkit-src/src/assets/constants/shape'
import { TEXT_SHAPE_OPTIONS } from 'extensions/tailorkit-src/src/assets/constants/shape'
import capitalize from 'lodash/capitalize'
import { useState } from 'react'
import { EXTRA_ICONS } from '~/constants/assets-url'

export const TextShape = (props: { label: string; value: string; onChange: (value: Shape) => void }) => {
  const { label, value, onChange } = props
  const [popoverActive, setPopoverActive] = useState(false)

  const onChangePopoverActive = () => setPopoverActive(!popoverActive)
  const onChangeTextShape = (value: Shape) => {
    onChange && onChange(value)
    onChangePopoverActive()
  }

  const popoverClassName = `emtlkit--text-shape emtlkit--select-input__popover ${popoverActive ? 'active' : ''}`

  return (
    <div className="emtlkit--option-set-container">
      <div className="mg-top-100">
        <label className="emtlkit--shape-label">{label}</label>
        <div className="emtlkit--select-input-container">
          <div style={{ position: 'relative' }}>
            <button className="emtlkit--select-input" onClick={onChangePopoverActive}>
              {capitalize(value) || '--'}
            </button>
            <img
              className="emtlkit-select-input__toggle-icon"
              width="15"
              height="15"
              src={EXTRA_ICONS.TOGGLE_ICON}
              alt="toggle icon"
              loading="lazy"
            />
          </div>
          <div className={popoverClassName}>
            {TEXT_SHAPE_OPTIONS.map(option => {
              return (
                <div key={option.value} onClick={() => onChangeTextShape(option.value as Shape)}>
                  <label className="emtlkit--select-option" data-selection="text-shape">
                    <div className="emtlkit--select-option__thumbnail">
                      {option.thumbnail && <img src={option.thumbnail} alt={option.label} loading="lazy" />}
                    </div>
                    <span>{option.label}</span>
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
