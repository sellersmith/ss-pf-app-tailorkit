/**
 * SolidFillEditor - Color picker for solid fills
 *
 * Wraps the existing EditorColorPicker for solid color selection.
 *
 * @module TemplateEditor/elements/components/Text/Styling/Fill
 */

import { BlockStack } from '@shopify/polaris'
import type { Paint, SolidPaint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { useCallback } from 'react'
import EditorColorPicker from '~/components/common/ColorPicker'
import { DEBOUNCE_REQUEST_MINOR } from '~/constants/debounce'

interface SolidFillEditorProps {
  /** Current solid paint value */
  value: SolidPaint | undefined
  /** Callback when paint changes */
  onChange: (paint: Paint) => void
}

export function SolidFillEditor({ value, onChange }: SolidFillEditorProps) {
  const handleColorChange = useCallback(
    (color: string) => {
      onChange({
        type: 'SOLID',
        color,
        opacity: value?.opacity ?? 1,
        visible: true,
      })
    },
    [onChange, value?.opacity]
  )

  return (
    <BlockStack gap="200">
      <EditorColorPicker
        id="fill-solid-color"
        placeholder="#000000"
        value={value?.color || '#000000'}
        preferredPosition="below"
        showInPopover={false}
        width="100%"
        debounceMs={DEBOUNCE_REQUEST_MINOR}
        onChange={handleColorChange}
      />
    </BlockStack>
  )
}
