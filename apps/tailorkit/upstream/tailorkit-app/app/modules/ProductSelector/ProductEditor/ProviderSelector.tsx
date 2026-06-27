import type { ProviderSelectorProps } from '../type'
import { useTranslation } from 'react-i18next'
import { LocationIcon, SelectIcon } from '@shopify/polaris-icons'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { Icon, Text, ResourceList, ResourceItem, Popover, TextField, InlineGrid, Box, Tooltip } from '@shopify/polaris'

export default function ProviderSelector({ disabled, selected, onSelect, providers }: ProviderSelectorProps) {
  const { t } = useTranslation()

  // Track event
  const { trackEvent } = useEventsTracking()

  // All options
  const allOptions = useMemo(
    () =>
      (providers || []).map((provider: any) => ({
        value: provider.id,
        label: provider.name,
        location: provider.location.country,
        facilities: provider.facilities.map((facility: any) => facility.country_label),
      })),
    [providers]
  )

  // Form state
  const [active, setActive] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [options, setOptions] = useState(allOptions)
  const [selectedOption, setSelectedOption] = useState<number | string | undefined>(selected)

  // Handlers
  const escapeSpecialRegExCharacters = useCallback((value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), [])

  const updateText = useCallback(
    (value: string) => {
      setInputValue(value)

      if (value === '') {
        setOptions(allOptions)
        return
      }

      const filterRegex = new RegExp(escapeSpecialRegExCharacters(value), 'i')

      setOptions(allOptions.filter(option => option.label.match(filterRegex)))
    },
    [allOptions, escapeSpecialRegExCharacters]
  )

  const handleOpen = useCallback(() => {
    setActive(true)
    setOptions(allOptions)

    // Set popover height
    let numTry = 0

    ;(function setPopoverHeight() {
      const popover = document.querySelector(
        '.Polaris-Popover__PopoverOverlay--open .Polaris-Popover__Content'
      ) as HTMLElement

      if (popover) {
        const items = popover.querySelectorAll('.Polaris-ResourceItem__ListItem')

        if (items[0]) {
          popover.style.overflowY = 'auto'
          popover.style.maxHeight = `${6 * (items[0] as HTMLElement).offsetHeight}px`
          popover.style.height = `${items.length * (items[0] as HTMLElement).offsetHeight}px`

          return
        }
      }

      if (numTry <= 10) {
        numTry++
        setTimeout(setPopoverHeight, 10)
      }
    })()
  }, [allOptions])

  const handleClose = useCallback(() => setActive(false), [])

  const updateSelection = useCallback(
    (args: any) => {
      const value = args instanceof Array ? args[1] : args
      const matchedOption = options.find(option => option.value.toString() === value)

      setSelectedOption(value)
      setInputValue(matchedOption?.label || '')

      onSelect?.(matchedOption?.value)

      setActive(false)

      // Track event
      trackEvent(EVENTS_TRACKING.SELECT_PRINT_PROVIDER, { providerName: matchedOption?.label || '' })
    },
    [onSelect, options, trackEvent]
  )

  useEffect(() => {
    updateText(inputValue)
  }, [inputValue, updateText])

  return (
    <>
      <Popover
        fullWidth
        active={active}
        onClose={handleClose}
        activatorWrapper="div"
        preferInputActivator={false}
        activator={
          <TextField
            labelHidden
            autoComplete="off"
            value={inputValue}
            disabled={disabled}
            onFocus={handleOpen}
            onChange={updateText}
            id="provider-selector"
            label={t('select-print-provider')}
            suffix={<Icon source={SelectIcon} />}
            placeholder={t('select-print-provider')}
          />
        }
      >
        {!disabled && options.length > 0 && (
          <ResourceList
            items={options}
            onSelectionChange={updateSelection}
            selectedItems={selectedOption ? [selectedOption.toString()] : []}
            renderItem={(item, index) => {
              const { label, value, location, facilities } = item

              return (
                <ResourceItem key={`${index}-${value}`} id={value.toString()} onClick={updateSelection}>
                  <Box paddingInline="100">
                    <InlineGrid columns="40% 40% 20%">
                      <Text as="span" variant="bodyMd" alignment="start">
                        {label}
                      </Text>
                      <InlineGrid columns="24px auto">
                        <Icon source={LocationIcon} />
                        <Text as="span" variant="bodyMd">
                          {location}
                        </Text>
                      </InlineGrid>
                      <Tooltip content={facilities.join(', ')} zIndexOverride={1000}>
                        <Text as="span" variant="bodyMd">
                          {facilities.length === 1 ? t('1-facility') : t('num-facilities', { num: facilities.length })}
                        </Text>
                      </Tooltip>
                    </InlineGrid>
                  </Box>
                </ResourceItem>
              )
            }}
          />
        )}
      </Popover>
    </>
  )
}
