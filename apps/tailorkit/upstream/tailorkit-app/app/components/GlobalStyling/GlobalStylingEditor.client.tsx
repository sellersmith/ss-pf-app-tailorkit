import { BlockStack, InlineGrid } from '@shopify/polaris'
import { useDeferredValue } from 'react'
import type { DisplayMode, GlobalStyling } from '~/types/global-styling'
import { DisplayModeSelector } from './components/DisplayModeSelector'
import { SettingsPanel } from './components/SettingsPanel'
import useDevices from '~/utils/hooks/useDevice'

export interface GlobalStylingEditorProps {
  /** Current styling configuration */
  styling: GlobalStyling
  /** Callback to update styling with history tracking */
  onStylingChange: (styling: GlobalStyling) => void
  /** Current display mode (UI state only, not saved) */
  displayMode: DisplayMode
  /** Callback when display mode changes */
  onDisplayModeChange: (mode: DisplayMode) => void
}

/**
 * Main Global Styling Editor component that provides a split layout
 * with settings on the left and display mode selection on the right
 */
export default function GlobalStylingEditor({
  styling,
  onStylingChange,
  displayMode,
  onDisplayModeChange,
}: GlobalStylingEditorProps) {
  const { isSmallDesktopView } = useDevices()
  const deferredStyling = useDeferredValue(styling)

  return (
    <BlockStack gap="400">
      <InlineGrid gap="400" columns={isSmallDesktopView ? '1fr' : '1fr 2fr'}>
        {/* Settings Column - Scrollable */}
        <SettingsPanel
          styling={styling}
          onStylingChange={onStylingChange}
          displayMode={displayMode}
          onDisplayModeChange={onDisplayModeChange}
        />

        {/* Display Mode Column - Fixed */}
        <DisplayModeSelector
          styling={deferredStyling}
          displayMode={displayMode}
          onDisplayModeChange={onDisplayModeChange}
        />
      </InlineGrid>
    </BlockStack>
  )
}
