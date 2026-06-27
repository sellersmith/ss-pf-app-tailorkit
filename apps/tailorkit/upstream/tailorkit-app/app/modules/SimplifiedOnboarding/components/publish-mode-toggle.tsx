/**
 * Publish Mode Toggle — Step 5 component.
 *
 * Lets the merchant choose between cloning the product (default — current safe behavior)
 * or integrating personalization directly into the original product (no duplicate).
 *
 * Conflict prevention happens upstream at Step 1 via the "Personalized" Badge that
 * disables already-integrated products, so this component does not render any
 * conflict warnings.
 */

import { useCallback } from 'react'
import { BlockStack, ChoiceList, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { PublishMode } from '../types'

export interface PublishModeToggleProps {
  mode: PublishMode
  onChange: (mode: PublishMode, previousMode: PublishMode) => void
  /** Disable interaction during publishing/completed phases so the choice can't change mid-flight */
  disabled?: boolean
}

export function PublishModeToggle({ mode, onChange, disabled }: PublishModeToggleProps) {
  const { t } = useTranslation()

  const handleChange = useCallback(
    (selected: string[]) => {
      const next = (selected[0] as PublishMode) || 'clone'
      if (next !== mode) onChange(next, mode)
    },
    [mode, onChange]
  )

  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingSm">
        {t('how-do-you-want-to-publish')}
      </Text>
      <ChoiceList
        title=""
        titleHidden
        disabled={disabled}
        selected={[mode]}
        onChange={handleChange}
        choices={[
          {
            label: t('publish-as-a-new-personalized-product'),
            value: 'clone',
            helpText: t(
              `Creates a duplicate of your product with a 'Personalized' prefix. Original product stays unchanged.`
            ),
          },
          {
            label: t('add-personalization-to-the-existing-product'),
            value: 'integrate-direct',
            helpText: t('no-duplicate-created-personalization-is-added-directly-to-the-product-you-selected'),
          },
        ]}
      />
    </BlockStack>
  )
}
