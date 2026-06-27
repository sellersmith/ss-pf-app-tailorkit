import { Button } from '@shopify/polaris'
import { EyeDropperIcon } from '@shopify/polaris-icons'
import React, { useCallback, useEffect, useState, startTransition } from 'react'
import tinycolor from 'tinycolor2'

/**
 * Check if the browser supports the EyeDropper API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper
 */
function isEyeDropperSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'EyeDropper' in window
}

interface EyeDropperButtonProps {
  /** Callback when a color is picked */
  onColorPicked: (hexColor: string) => void
  /** Button ID for testing/accessibility */
  id?: string
  /** Custom accessibility label */
  accessibilityLabel?: string
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'plain' | 'tertiary'
  /** Button full width */
  fullWidth?: boolean
  /** Button content */
  content?: string
}

/**
 * EyeDropperButton component
 * Provides a button to pick colors from anywhere on the screen using the EyeDropper API
 * Only renders if the browser supports the EyeDropper API
 */
export const EyeDropperButton: React.FC<EyeDropperButtonProps> = ({
  onColorPicked,
  id,
  accessibilityLabel = 'Pick color from screen',
  variant = 'secondary',
  fullWidth = false,
  content,
}) => {
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(isEyeDropperSupported())
  }, [])

  const handleClick = useCallback(async () => {
    if (!isSupported) return

    try {
      const eyeDropper = new (window as any).EyeDropper()
      const result = await eyeDropper.open()

      if (result?.sRGBHex) {
        // Validate the color
        const color = tinycolor(result.sRGBHex)
        if (color.isValid()) {
          // Use startTransition to make the update non-blocking
          startTransition(() => {
            onColorPicked(result.sRGBHex)
          })
        }
      }
    } catch (error) {
      // User cancelled the picker or an error occurred
      // This is normal behavior, so we just log it
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('EyeDropper error:', error)
      }
    }
  }, [isSupported, onColorPicked])

  // Don't render if not supported
  if (!isSupported) {
    return null
  }

  return (
    <Button
      id={id}
      icon={EyeDropperIcon}
      onClick={handleClick}
      accessibilityLabel={accessibilityLabel}
      variant={variant}
      fullWidth={fullWidth}
    >
      {content}
    </Button>
  )
}

export default EyeDropperButton
