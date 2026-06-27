import { BlockStack, Divider, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Accordion } from '~/components/Accordion'
import EditorColorPicker from '~/components/common/ColorPicker'
import { NumericSliderField } from '~/modules/TemplateEditor/elements/components/Text/Styling/Typography/NumericSliderField'
import type { ButtonsStyle, DisplayMode } from '~/types/global-styling'
import { defaultButtonsStyling } from '~/types/global-styling'

export interface ButtonSectionProps {
  /** Current button styling configuration */
  buttons?: ButtonsStyle
  /** Callback when button style changes */
  onButtonsChange: (buttons: ButtonsStyle) => void
  /** Current display mode */
  displayMode: DisplayMode
  /** Callback when display mode changes */
  onDisplayModeChange: (mode: DisplayMode) => void
}

/**
 * Button styling section with primary and secondary button customization
 */
export function ButtonSection({ buttons, onButtonsChange, displayMode, onDisplayModeChange }: ButtonSectionProps) {
  const { t } = useTranslation()

  // Use defaults if buttons is undefined (backward compatibility)
  const currentButtons = buttons ?? defaultButtonsStyling

  // Switch to modal_desktop if currently on inline (buttons only visible in modal)
  const ensureModalView = useCallback(() => {
    if (displayMode === 'inline') {
      onDisplayModeChange('modal_desktop')
    }
  }, [displayMode, onDisplayModeChange])

  const updatePrimary = (updates: Partial<ButtonsStyle['primary']>) => {
    ensureModalView()
    onButtonsChange({
      ...currentButtons,
      primary: { ...currentButtons.primary, ...updates },
    })
  }

  const updateSecondary = (updates: Partial<ButtonsStyle['secondary']>) => {
    ensureModalView()
    onButtonsChange({
      ...currentButtons,
      secondary: { ...currentButtons.secondary, ...updates },
    })
  }

  const updateBorderRadius = (borderRadius: number) => {
    ensureModalView()
    onButtonsChange({ ...currentButtons, borderRadius })
  }

  return (
    <Accordion
      id="buttons"
      label={t('buttons')}
      open={true}
      content={
        <BlockStack gap="400">
          {/* Primary Button Section */}
          <BlockStack gap="300">
            <Text as="p" variant="headingSm">
              {t('primary-button')}
            </Text>
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                {t('background-color')}
              </Text>
              <EditorColorPicker
                value={currentButtons.primary.backgroundColor}
                debounceMs={150}
                onChange={v => updatePrimary({ backgroundColor: v })}
              />
            </BlockStack>

            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                {t('text-color')}
              </Text>
              <EditorColorPicker
                value={currentButtons.primary.textColor}
                debounceMs={150}
                onChange={v => updatePrimary({ textColor: v })}
              />
            </BlockStack>

            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                {t('border-color')}
              </Text>
              <EditorColorPicker
                value={currentButtons.primary.borderColor}
                debounceMs={150}
                onChange={v => updatePrimary({ borderColor: v })}
              />
            </BlockStack>
          </BlockStack>

          <Divider />

          {/* Secondary Button Section */}
          <BlockStack gap="300">
            <Text as="p" variant="headingSm">
              {t('secondary-button')}
            </Text>
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                {t('background-color')}
              </Text>
              <EditorColorPicker
                value={currentButtons.secondary.backgroundColor}
                debounceMs={150}
                onChange={v => updateSecondary({ backgroundColor: v })}
              />
            </BlockStack>

            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                {t('text-color')}
              </Text>
              <EditorColorPicker
                value={currentButtons.secondary.textColor}
                debounceMs={150}
                onChange={v => updateSecondary({ textColor: v })}
              />
            </BlockStack>

            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                {t('border-color')}
              </Text>
              <EditorColorPicker
                value={currentButtons.secondary.borderColor}
                debounceMs={150}
                onChange={v => updateSecondary({ borderColor: v })}
              />
            </BlockStack>
          </BlockStack>

          <Divider />

          {/* Shared Border Radius */}
          <NumericSliderField
            label={t('corner-radius')}
            value={currentButtons.borderRadius}
            min={0}
            max={30}
            step={1}
            suffix="px"
            onChange={updateBorderRadius}
          />
        </BlockStack>
      }
    />
  )
}
