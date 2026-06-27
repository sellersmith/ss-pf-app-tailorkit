/**
 * ColorButton - Color picker button with popover for fill/stroke editing
 */

import { useState, useEffect } from 'react'
import { Popover, Tooltip, Box, Button } from '@shopify/polaris'
import EditorColorPicker from '~/components/common/ColorPicker'
import styles from './styles.module.css'

interface ColorButtonProps {
  color: string | null
  tooltip: string
  icon: 'fill' | 'stroke'
  disabled?: boolean
  onChange: (color: string) => void
}

export default function ColorButton({ color, tooltip, icon, disabled, onChange }: ColorButtonProps) {
  const [active, setActive] = useState(false)
  const displayColor = color === 'none' ? 'transparent' : color || '#000000'

  // Close popover when button becomes disabled (e.g., path deselected)
  useEffect(() => {
    if (disabled) {
      setActive(false)
    }
  }, [disabled])

  const handleColorChange = (newColor: string) => {
    onChange(newColor)
  }

  const handleClear = () => {
    onChange('none')
  }

  const activator = (
    <Tooltip content={tooltip}>
      <Button
        className={styles.colorButton}
        disabled={disabled}
        onClick={() => !disabled && setActive(!active)}
        accessibilityLabel={tooltip}
      >
        {/* @ts-ignore */}
        {icon === 'fill' ? (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="10" height="10" rx="1" fill={displayColor} stroke="#666" strokeWidth="1" />
            {color === 'none' && <line x1="1" y1="11" x2="11" y2="1" stroke="#cc0000" strokeWidth="1.5" />}
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke={displayColor} strokeWidth="2" />
            {color === 'none' && <line x1="1" y1="11" x2="11" y2="1" stroke="#cc0000" strokeWidth="1.5" />}
          </svg>
        )}
      </Button>
    </Tooltip>
  )

  return (
    <Popover active={active && !disabled} activator={activator} onClose={() => setActive(false)}>
      <Box padding="200">
        <EditorColorPicker
          value={color === 'none' ? '' : color || '#000000'}
          showInPopover={false}
          onChange={handleColorChange}
          onClear={handleClear}
        />
      </Box>
    </Popover>
  )
}
