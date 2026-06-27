import type { PopoverProps, TextFieldProps } from '@shopify/polaris'
import { BlockStack, Button, Icon, InlineStack, Popover, Text, TextField, Tooltip } from '@shopify/polaris'
import { MagicIcon } from '@shopify/polaris-icons'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useEffect, useState } from 'react'
import styles from './style.module.css'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { useTranslation } from 'react-i18next'

type AITextFieldProps = TextFieldProps & {
  label: string
  popoverContent?: React.ReactNode
  popoverProps?: Omit<PopoverProps, 'active' | 'activator' | 'onClose'>
  requiredIndicator?: boolean
}

/**
 * A text field component with a popover for AI assistance.
 *
 * @param {AITextFieldProps} props - The component props.
 * @param {string} props.label - The label of the text field.
 * @param {React.ReactNode} props.children - The children of the popover.
 */
export default function AITextField(props: AITextFieldProps) {
  const { label, popoverContent, popoverProps, requiredIndicator, ...otherProps } = props
  const { t } = useTranslation()

  const [popoverActive, setPopoverActive] = useState(false)
  const togglePopoverActive = useCallback(() => setPopoverActive(!popoverActive), [popoverActive])

  const activator = (
    <Tooltip content={t('build-with-ai')}>
      <Button icon={<Icon source={MagicIcon} tone="success" />} variant="plain" onClick={togglePopoverActive} />
    </Tooltip>
  )

  useEffect(() => {
    if (popoverActive) {
      Transmitter.listen(
        TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE,
        togglePopoverActive
      )
    }

    return () => {
      Transmitter.remove(
        TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE,
        togglePopoverActive
      )
    }
  }, [popoverActive, togglePopoverActive])

  return (
    <div className={styles.AITextField}>
      <BlockStack gap="100">
        <InlineStack align="space-between">
          <Text as="p" variant="bodyMd">
            {label}
            {requiredIndicator && (
              <Text as="span" tone="critical">
                {' '}
                *
              </Text>
            )}
          </Text>
          <Popover
            {...popoverProps}
            active={popoverActive}
            activator={activator}
            autofocusTarget="first-node"
            onClose={togglePopoverActive}
            zIndexOverride={1000}
          >
            {popoverContent}
          </Popover>
        </InlineStack>
        <TextField {...otherProps} label={label} labelHidden />
      </BlockStack>
    </div>
  )
}
