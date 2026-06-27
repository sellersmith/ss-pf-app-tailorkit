import { BlockStack, Card, Scrollable } from '@shopify/polaris'
import type { DisplayMode, GlobalStyling } from '~/types/global-styling'
import { BoxSection } from './sections/BoxSection'
import { ButtonSection } from './sections/ButtonSection'
import { DividerSection } from './sections/DividerSection'
import { HeadingSection } from './sections/HeadingSection'
import { OptionSetSection } from './sections/OptionSetSection'
import { PersonalizationAreaSection } from './sections/PersonalizationAreaSection'

export interface SettingsPanelProps {
  /** Current styling configuration */
  styling: GlobalStyling
  /** Callback to update styling with history tracking */
  onStylingChange: (styling: GlobalStyling) => void
  /** Current display mode */
  displayMode: DisplayMode
  /** Callback when display mode changes */
  onDisplayModeChange: (mode: DisplayMode) => void
}

/**
 * Scrollable settings panel containing all styling sections
 */
export function SettingsPanel({ styling, onStylingChange, displayMode, onDisplayModeChange }: SettingsPanelProps) {
  return (
    <Card padding="0">
      <Scrollable style={{ maxHeight: 'calc(100vh - 110px)' }}>
        <BlockStack>
          <BoxSection boxStyle={styling.box} onBoxStyleChange={box => onStylingChange({ ...styling, box })} />

          <HeadingSection
            heading={styling.heading}
            onHeadingChange={heading => onStylingChange({ ...styling, heading })}
          />

          <DividerSection
            divider={styling.divider}
            onDividerChange={divider => onStylingChange({ ...styling, divider })}
          />

          <PersonalizationAreaSection
            personalizationArea={styling.personalizationArea}
            onPersonalizationAreaChange={personalizationArea => onStylingChange({ ...styling, personalizationArea })}
          />

          <OptionSetSection
            optionSet={styling.optionSet}
            onOptionSetChange={optionSet => onStylingChange({ ...styling, optionSet })}
          />

          <ButtonSection
            buttons={styling.buttons}
            onButtonsChange={buttons => onStylingChange({ ...styling, buttons })}
            displayMode={displayMode}
            onDisplayModeChange={onDisplayModeChange}
          />
        </BlockStack>
      </Scrollable>
    </Card>
  )
}
