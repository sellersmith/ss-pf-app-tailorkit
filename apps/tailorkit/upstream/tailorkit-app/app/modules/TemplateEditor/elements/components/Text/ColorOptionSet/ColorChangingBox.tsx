import { useEffect, useState } from 'react'
import EditorColorPicker from '~/components/common/ColorPicker'
import { DEBOUNCE_REQUEST_MINOR } from '~/constants/debounce'
import { useDebounce } from '~/utils/hooks/useDebounce'

export const ColorChangingBox = (props: {
  colorValue: string
  disabled?: boolean
  style?: React.CSSProperties
  onChangeColor?: (newColor: string) => void
}) => {
  const { colorValue, disabled, onChangeColor, style } = props
  const [value, setValue] = useState(colorValue)
  const debounceColor = useDebounce(value, 200)

  const activator = (
    <div
      className="color-changing-activator"
      style={{
        width: '28px',
        backgroundColor: value,
        padding: '14px',
        borderRadius: 'var(--p-border-radius-100)',
        ...style,
      }}
    />
  )
  useEffect(() => {
    if (value === debounceColor) {
      onChangeColor && onChangeColor(debounceColor)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceColor])

  return disabled ? (
    activator
  ) : (
    <EditorColorPicker
      value={value}
      onChange={setValue}
      placeholder={value}
      activator={activator}
      debounceMs={DEBOUNCE_REQUEST_MINOR}
      preferredAlignment={'left'}
    />
  )
}
