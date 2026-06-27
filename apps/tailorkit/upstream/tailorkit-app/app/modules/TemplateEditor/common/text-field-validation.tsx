import { TextField, type TextFieldProps } from '@shopify/polaris'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AITextField from '~/components/AITextField'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '../constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'

interface ITextFieldValidationProps {
  onValidate?: any
  showErrorDefault?: boolean
  enableAIContentGenerator?: boolean
  aiMetadata?: Record<string, any>
  allowSpecialCharacters?: boolean
}

export default function TextFieldValidation(props: ITextFieldValidationProps & TextFieldProps) {
  const {
    onValidate,
    onFocus,
    error,
    value,
    showErrorDefault = true,
    enableAIContentGenerator = true,
    aiMetadata,
    allowSpecialCharacters = false,
    onChange,
    ...otherProps
  } = props
  const [isDirty, setIsDirty] = useState(!!showErrorDefault)
  const { t } = useTranslation()

  const { trackEvent } = useEventsTracking()

  const onChangeHandler = useCallback(
    (value: string, id: string): void => {
      if (typeof onChange !== 'function') return

      if (!allowSpecialCharacters) {
        // Prevent special characters, can not input
        if (value.includes('"') || value.includes("'")) {
          return
        }
      }

      onChange(value, id)
    },
    [allowSpecialCharacters, onChange]
  )

  const onSelectOptionAfterGenerating = (options: string[]) => {
    props.onChange?.(options[0], '')

    trackEvent(EVENTS_TRACKING.BUILD_WITH_AI, {
      options,
      feature: 'ai_gen_text_select',
    })

    // Track the time when user use AI feature
    localStorage.setItem('TLK_USE_AI_FEATURE_AT', Date.now().toString())
  }

  const togglePopoverActive = () => {
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE)
  }

  useEffect(() => {
    // Only run validation step one time to update the validation errors without having focus action
    // And only show error once this text field is dirty
    if (onValidate) {
      onValidate(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const Component = useMemo(() => (enableAIContentGenerator ? AITextField : TextField), [enableAIContentGenerator])

  return (
    <Component
      onFocus={() => {
        setIsDirty(true)
        typeof onFocus === 'function' && onFocus()
      }}
      value={value}
      {...(isDirty ? { error } : {})}
      {...otherProps}
      onChange={onChangeHandler}
      label={otherProps.label as string}
      popoverContent={
        <PopoverAIContentGenerator
          title={t('generate-content')}
          value={value}
          mainTextLabel={t('what-is-this-text-about')}
          optionalTextLabel={t('special-instructions-optional')}
          onSelectOptionAfterGenerating={onSelectOptionAfterGenerating}
          onTogglePopoverActive={togglePopoverActive}
          maxContentLength={otherProps.maxLength}
          metadata={aiMetadata}
        />
      }
    />
  )
}
