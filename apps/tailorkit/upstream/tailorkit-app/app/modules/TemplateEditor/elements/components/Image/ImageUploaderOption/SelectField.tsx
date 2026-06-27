import { BlockStack, Icon, InlineStack, Text, TextField, Tooltip } from '@shopify/polaris'
import { InfoIcon, SelectIcon } from '@shopify/polaris-icons'
import type { ReactNode } from 'react'

export interface SelectFieldProps {
  label: ReactNode
  value: string
  placeholder?: string
  onClick: () => void
  infoTooltip?: string
  helpText?: ReactNode
}

/**
 * Clickable Select Field component that opens a sub-inspector when clicked
 */
export function SelectField({ label, value, placeholder, onClick, infoTooltip, helpText }: SelectFieldProps) {
  return (
    <BlockStack gap="100">
      <InlineStack gap="100" blockAlign="center">
        <Text as="span" variant="bodyMd">
          {label}
        </Text>
        {infoTooltip && (
          <Tooltip content={infoTooltip}>
            <Icon source={InfoIcon} tone="subdued" />
          </Tooltip>
        )}
      </InlineStack>
      <div onClick={onClick} style={{ cursor: 'pointer' }}>
        <TextField
          label={label}
          labelHidden
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          suffix={<Icon source={SelectIcon} />}
          readOnly
          helpText={helpText}
        />
      </div>
    </BlockStack>
  )
}

/**
 * Helper function to get display text for selection
 * @param selected - Array of selected item names
 * @param itemType - Type of items (styles, prompts, types, themes, actions, effects)
 * @param t - Translation function
 * @returns Display text: name if 1 selected, "{count} {itemType} selected" if multiple, empty string if none
 */
export function getSelectionDisplayText(
  selected: readonly string[] | string[] | undefined,
  itemType: 'styles' | 'prompts' | 'types' | 'themes' | 'actions' | 'effects',
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!selected || selected.length === 0) {
    return '' // Empty - will show placeholder
  }
  if (selected.length === 1) {
    return selected[0]
  }
  return t('n-items-selected', { count: selected.length, type: t(itemType) })
}
