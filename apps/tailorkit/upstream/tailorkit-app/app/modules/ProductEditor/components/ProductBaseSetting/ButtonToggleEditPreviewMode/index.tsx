import { useCallback, useMemo, useState } from 'react'
import { Icon, Text, InlineStack } from '@shopify/polaris'
import { EditIcon, HideIcon, ViewIcon } from '@shopify/polaris-icons'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import { useTranslation } from 'react-i18next'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import useDevices from '~/utils/hooks/useDevice'

export type EditPreviewMode = 'editor' | 'preview'

interface ButtonToggleEditPreviewModeProps {
  value?: EditPreviewMode
  onChange?: (mode: EditPreviewMode) => void
  disabled?: boolean
  disablePreview?: boolean
  showIcons?: boolean
  minWidth?: string
}

export function ButtonToggleEditPreviewMode({
  value = 'editor',
  onChange,
  disabled = false,
  disablePreview = false,
  showIcons = true,
  minWidth,
}: ButtonToggleEditPreviewModeProps) {
  const [internalValue, setInternalValue] = useState<EditPreviewMode>(value)
  const { t } = useTranslation()
  const { isSmallDesktopView } = useDevices()

  const { trackEvent } = useEventsTracking()

  const currentValue = onChange ? value : internalValue

  const handleChange = useCallback(
    (selectedValues: string[]) => {
      const newValue = (selectedValues[0] as EditPreviewMode) || 'editor'

      // Prevent switching to preview mode if it's disabled
      if (disablePreview && newValue === 'preview') {
        return
      }

      if (onChange) {
        onChange(newValue)
      } else {
        setInternalValue(newValue)
      }

      trackEvent(EVENTS_TRACKING.SELECT_MODE, {
        mode: newValue,
      })
    },
    [onChange, disablePreview, trackEvent]
  )

  const options = useMemo(
    () => [
      {
        id: 'button-toggle-editor',
        value: 'editor',
        label: showIcons ? (
          <InlineStack gap="200" align="center">
            <Icon source={EditIcon} />
            <Text as="span" variant="bodySm">
              {t('editor')}
            </Text>
          </InlineStack>
        ) : (
          <Text as="span" variant="bodySm">
            {t('editor')}
          </Text>
        ),
      },
      {
        id: 'button-toggle-preview',
        value: 'preview',
        label: showIcons ? (
          <InlineStack gap="200" align="center">
            <Icon source={disablePreview ? HideIcon : ViewIcon} tone={disablePreview ? 'subdued' : undefined} />
            <Text as="span" variant="bodySm" tone={disablePreview ? 'subdued' : undefined}>
              {t('preview')}
            </Text>
          </InlineStack>
        ) : (
          <Text as="span" variant="bodySm" tone={disablePreview ? 'subdued' : undefined}>
            {t('preview')}
          </Text>
        ),
        disabled: disablePreview,
      },
    ],
    [t, showIcons, disablePreview]
  )

  return (
    <div style={{ minWidth: minWidth || (isSmallDesktopView ? '150px' : '300px') }}>
      <MultipleButtonToggle
        options={options}
        selected={[currentValue]}
        onClick={handleChange}
        disableToggle={disabled}
      />
    </div>
  )
}
