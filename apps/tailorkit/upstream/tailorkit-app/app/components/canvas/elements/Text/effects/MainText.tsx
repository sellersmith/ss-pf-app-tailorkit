/**
 * Unified Main Text Layer Component
 *
 * Renders the final visible text with optional stroke for both Text and TextPath variants.
 * This is the top-most layer that users see and interact with.
 *
 * @module components/canvas/elements/Text/effects
 */

import { memo } from 'react'
import { Text, TextPath } from 'react-konva'
import type { KonvaTextProps } from '../types'
import type { KonvaTextPathPropsBuilt } from 'extensions/tailorkit-src/src/shared/libraries/konva/text/text-style-utils'

// Discriminated union for type-safe variant handling
type MainTextProps =
  | {
      variant: 'text'
      textProps: KonvaTextProps
      textColor: string
    }
  | {
      variant: 'textPath'
      textPathProps: KonvaTextPathPropsBuilt
      textColor: string
    }

/**
 * Renders the main text layer with full styling support.
 * Supports both regular Text and TextPath variants.
 */
function MainTextComponent(props: MainTextProps) {
  const { variant, textColor } = props

  const commonProps = {
    fill: textColor,
    listening: false,
    perfectDrawEnabled: false,
  }

  if (variant === 'text') {
    return <Text {...props.textProps} {...commonProps} />
  }

  return <TextPath {...props.textPathProps} {...commonProps} />
}

export const MainText = memo(MainTextComponent)
