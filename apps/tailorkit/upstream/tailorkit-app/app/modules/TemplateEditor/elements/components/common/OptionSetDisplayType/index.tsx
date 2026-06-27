import { BlockStack, Icon, OptionList, Popover, Text, TextField } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TLayerStore } from '~/stores/modules/layer'
import type { OptionSet } from '~/types/psd'
import type { DisplayStyleType } from '~/modules/TemplateEditor/elements/constants'
import { getDisplayStyleOptions, getDisplayStylesForOptionSet } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { SelectIcon } from '@shopify/polaris-icons'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'

interface OptionSetDisplayTypeProps {
  /**
   * Layer store instance for dispatching updates
   */
  layerStore: TLayerStore
  /**
   * Option set currently being edited
   */
  optionSetEditing: OptionSet
  /**
   * Whether the component is disabled
   */
  disabled?: boolean
}

/**
 * Component for selecting display style of option sets.
 * Shows a popover with available display style options based on the option set type.
 *
 * @param props - Component properties
 * @returns JSX element for the display style selector
 */
export default function OptionSetDisplayType({
  layerStore,
  optionSetEditing,
  disabled = false,
}: OptionSetDisplayTypeProps) {
  const { t } = useTranslation()
  const [popoverActive, setPopoverActive] = useState(false)
  const optionSetType = optionSetEditing.type
  const { trackEvent } = useEventsTracking()

  // Get available display styles for this option set type
  const availableStyles = getDisplayStylesForOptionSet(optionSetType)
  const displayStyleOptions = getDisplayStyleOptions(optionSetType, t)

  const currentDisplayStyle = optionSetEditing.data?.displayStyle || displayStyleOptions[0].value
  const currentDisplayLabel = displayStyleOptions.find(option => option.value === currentDisplayStyle)?.label

  const togglePopover = useCallback(() => {
    if (disabled) return
    setPopoverActive(prev => !prev)
  }, [disabled])

  const handleDisplayStyleSelect = useCallback(
    (selected: string[]) => {
      const newDisplayStyle = selected[0] as DisplayStyleType

      // Update the option set with the new display style
      const updatedOptionSet = {
        ...optionSetEditing,
        data: {
          ...optionSetEditing.data,
          displayStyle: newDisplayStyle,
        },
      }

      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: updatedOptionSet,
        },
      })

      setPopoverActive(false)
      trackEvent(EVENTS_TRACKING.SELECT_OPTION_SET_DISPLAY_STYLE, {
        [EVENTS_PARAMETERS_NAME.SELECTION]: optionSetType,
        [EVENTS_PARAMETERS_NAME.DISPLAY_STYLE]: newDisplayStyle,
      })
    },
    [layerStore, optionSetEditing, optionSetType, trackEvent]
  )

  // Don't render if no display styles are available for this option set type
  if (availableStyles.length === 0) {
    return null
  }

  const activator = (
    <div onClick={togglePopover} style={{ width: '100%' }} id={`${optionSetType}-display-style-selector`}>
      <TextField
        label={t('display-style')}
        focused={false}
        autoFocus={false}
        labelHidden
        autoComplete="off"
        value={currentDisplayLabel}
        suffix={<Icon source={SelectIcon} />}
        disabled={disabled}
      />
    </div>
  )

  return (
    <BlockStack gap="100">
      <Text as="p" variant="bodyMd">
        {t('display-style')}
      </Text>

      <Popover
        active={popoverActive}
        activator={activator}
        onClose={togglePopover}
        fullWidth
        preferredPosition="below"
        zIndexOverride={1000}
      >
        <Popover.Pane>
          <OptionList
            options={displayStyleOptions}
            selected={currentDisplayStyle ? [currentDisplayStyle] : []}
            onChange={handleDisplayStyleSelect}
          />
        </Popover.Pane>
      </Popover>

      <Text as="p" variant="bodySm" tone="subdued">
        {t('choose-how-buyers-will-see-options-on-storefront')}
      </Text>
    </BlockStack>
  )
}
