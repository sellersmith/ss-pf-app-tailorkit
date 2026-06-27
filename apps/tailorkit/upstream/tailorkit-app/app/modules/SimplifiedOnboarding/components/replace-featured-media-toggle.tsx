/**
 * Replace Featured Media Toggle — Step 5 component.
 *
 * Opt-in checkbox beneath the Publish Mode choice on StorefrontPreviewStep. When checked,
 * the generated composite mockup becomes the product's featured image (position 0) after
 * publish. HelpText varies by publish mode because the impact differs:
 *   - clone: the NEW duplicated product shows the mockup as its main image
 *   - integrate-direct: the merchant's ORIGINAL product featured image is replaced
 *
 * Default OFF — never modify the merchant's product photos without explicit consent.
 */

import { useCallback } from 'react'
import { Checkbox } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { PublishMode } from '../types'

export interface ReplaceFeaturedMediaToggleProps {
  checked: boolean
  /** Current publish mode — drives the help-text phrasing so merchants understand the impact. */
  mode: PublishMode
  onChange: (next: boolean) => void
  /** Disable interaction during publishing/completed phases so the choice can't change mid-flight. */
  disabled?: boolean
}

export function ReplaceFeaturedMediaToggle({ checked, mode, onChange, disabled }: ReplaceFeaturedMediaToggleProps) {
  const { t } = useTranslation()

  const handleChange = useCallback(
    (next: boolean) => {
      if (next !== checked) onChange(next)
    },
    [checked, onChange]
  )

  return (
    <Checkbox
      label={t('replace-featured-product-image-with-this-mockup')}
      checked={checked}
      disabled={disabled}
      onChange={handleChange}
      helpText={
        mode === 'integrate-direct'
          ? t('your-current-featured-image-will-be-moved-to-the-second-position-other-media-is-unchanged')
          : t('the-new-personalized-product-will-show-this-mockup-as-its-main-image')
      }
    />
  )
}
