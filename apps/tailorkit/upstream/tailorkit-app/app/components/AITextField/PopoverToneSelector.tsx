import { Popover, BlockStack, Scrollable, TextField, OptionList, Divider, Text, Icon } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IMAGE_STYLE_OPTIONS_MAP, TEXT_TONE_OPTIONS_MAP, TONE_TYPE } from './constants'
import { SelectIcon } from '@shopify/polaris-icons'
import type { AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'
import { AI_IMAGE_EDIT_LIMITS } from '~/routes/api.ai-assistant.suggestion/constants'

export const PopoverToneSelector = (props: {
  toneType: typeof TONE_TYPE.TEXT | typeof TONE_TYPE.IMAGE
  selectedTone: string
  defaultSelectedKey: string
  handleToneChange: (value: string) => void
}) => {
  const { toneType, selectedTone, defaultSelectedKey, handleToneChange } = props
  const { t } = useTranslation()

  const [customTone, setCustomTone] = useState('')
  const [popoverToneActive, setPopoverToneActive] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const TONE_OPTIONS_MAP = toneType === TONE_TYPE.TEXT ? TEXT_TONE_OPTIONS_MAP : IMAGE_STYLE_OPTIONS_MAP
  const TONE_OPTIONS = Object.values(TONE_OPTIONS_MAP).map(option => ({
    label: t(option.labelKey),
    value: option.value,
  }))
  const isTextTone = toneType === TONE_TYPE.TEXT
  const selectedToneOption = TONE_OPTIONS.find(option => option.value === selectedTone)

  const togglePopoverActive = useCallback(() => {
    setPopoverToneActive(!popoverToneActive)
  }, [popoverToneActive, setPopoverToneActive])

  const handleToneSelection = useCallback(
    (selected: string[]) => {
      togglePopoverActive()
      handleToneChange(selected[0])
    },
    [handleToneChange, togglePopoverActive]
  )

  const handleCustomToneSubmit = useCallback(() => {
    const tone = customTone.trim()
    if (tone) {
      setCustomTone(tone)
    }

    const defaultTone = TONE_OPTIONS_MAP[defaultSelectedKey].value
    handleToneChange(tone || defaultTone)
  }, [TONE_OPTIONS_MAP, customTone, defaultSelectedKey, handleToneChange])

  const activator = (
    <div onClick={togglePopoverActive} style={{ width: '100%' }} id={`ai-image-tone-selector`}>
      <TextField
        label={t(isTextTone ? 'tone' : 'style')}
        focused={false}
        autoFocus={false}
        autoComplete="off"
        value={selectedToneOption?.label || customTone || t(TONE_OPTIONS_MAP[defaultSelectedKey].labelKey)}
        suffix={<Icon source={SelectIcon} />}
      />
    </div>
  )

  const customToneMarkup = (
    <div style={{ padding: '12px', width: '200px' }}>
      <TextField
        clearButton
        focused={isFocused}
        label={
          <Text variant="bodyMd" as="p" fontWeight="semibold">
            {isTextTone ? t('custom-tone') : t('custom-image-style')}
          </Text>
        }
        placeholder={isTextTone ? t('e-g-optimistic') : t('e-g-paper-cutout')}
        autoComplete="off"
        value={customTone}
        onChange={setCustomTone}
        onClearButtonClick={() => {
          setCustomTone('')
        }}
        onFocus={() => {
          setIsFocused(true)
        }}
        onBlur={() => {
          setIsFocused(false)
          handleCustomToneSubmit()
        }}
      />
    </div>
  )

  useEffect(() => {
    // Add Enter key listener if any text fields are focused
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && isFocused) {
        handleCustomToneSubmit()
        togglePopoverActive()
        setIsFocused(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFocused, handleCustomToneSubmit, togglePopoverActive])

  return (
    <StopPropagation>
      <Popover
        activator={activator}
        active={popoverToneActive}
        preferredAlignment="left"
        zIndexOverride={1000}
        onClose={togglePopoverActive}
        fullHeight
      >
        <Popover.Pane>
          <BlockStack>
            <Scrollable shadow style={{ maxHeight: '190px' }}>
              <OptionList
                options={TONE_OPTIONS}
                selected={[selectedToneOption?.value || '']}
                onChange={handleToneSelection}
              />
            </Scrollable>
            <Divider borderColor="border" borderWidth="025" />
            {customToneMarkup}
          </BlockStack>
        </Popover.Pane>
      </Popover>
    </StopPropagation>
  )
}

export const PopoverRatioSelector = (props: {
  selectedRatio?: AllowedAspectRatio
  handleRatioChange: (value: AllowedAspectRatio) => void
}) => {
  const { t } = useTranslation()
  const { selectedRatio = AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS[0] as AllowedAspectRatio, handleRatioChange }
    = props

  const [popoverActive, setPopoverActive] = useState(false)

  const IMAGE_RATIOS: {
    label: AllowedAspectRatio
    value: AllowedAspectRatio
  }[] = useMemo(
    () =>
      AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS.map(ratio => ({
        label: ratio as AllowedAspectRatio,
        value: ratio as AllowedAspectRatio,
      })),
    []
  )

  const selectedOption = useMemo(
    () => IMAGE_RATIOS.find(option => option.value === selectedRatio),
    [IMAGE_RATIOS, selectedRatio]
  )

  const togglePopoverActive = useCallback(() => {
    setPopoverActive(!popoverActive)
  }, [popoverActive, setPopoverActive])

  const handleSelection = useCallback(
    (selected: AllowedAspectRatio[]) => {
      togglePopoverActive()
      handleRatioChange(selected[0])
    },
    [handleRatioChange, togglePopoverActive]
  )

  const activator = (
    <div onClick={togglePopoverActive} style={{ width: '100%' }} id={`ai-image-ratio-selector`}>
      <TextField
        label={t('ratio')}
        focused={false}
        autoFocus={false}
        autoComplete="off"
        value={selectedOption?.label || ''}
        suffix={<Icon source={SelectIcon} />}
      />
    </div>
  )

  return (
    <StopPropagation>
      <Popover
        activator={activator}
        active={popoverActive}
        preferredAlignment="left"
        zIndexOverride={1000}
        onClose={togglePopoverActive}
        fullHeight
      >
        <Popover.Pane>
          <BlockStack>
            <Scrollable shadow style={{ maxHeight: '190px' }}>
              <OptionList options={IMAGE_RATIOS} onChange={handleSelection} selected={[selectedOption?.value || '']} />
            </Scrollable>
          </BlockStack>
        </Popover.Pane>
      </Popover>
    </StopPropagation>
  )
}

const StopPropagation = ({ children }: React.PropsWithChildren<any>) => {
  const stopEventPropagation = (event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation()
  }

  return (
    <div onClick={stopEventPropagation} onTouchStart={stopEventPropagation}>
      {children}
    </div>
  )
}
