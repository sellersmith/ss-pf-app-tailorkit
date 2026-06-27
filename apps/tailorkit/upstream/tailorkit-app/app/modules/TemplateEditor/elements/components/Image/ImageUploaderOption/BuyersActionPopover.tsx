import { BlockStack, Checkbox, Icon, Popover, Text, TextField } from '@shopify/polaris'
import { SelectIcon } from '@shopify/polaris-icons'
import { FEATURE_FLAGS } from 'extensions/tailorkit-src/src/assets/constants/feature-flags'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export interface AllowCustomerToEditImage {
  allowTransform?: boolean
  allowRotate?: boolean
  allowZoom?: boolean
  allowRemoveBackground?: boolean
}

export type AllowCustomerToEditImageKey = keyof AllowCustomerToEditImage

interface BuyersActionPopoverProps {
  active: boolean
  allowCustomerToEditImage?: AllowCustomerToEditImage
  onToggle: () => void
  onClose: () => void
  onChange: (actionKey: AllowCustomerToEditImageKey, checked: boolean) => void
}

/**
 * Popover component for selecting buyers' edit actions (Move, Rotate, Zoom, Remove Background)
 */
export function BuyersActionPopover({
  active,
  allowCustomerToEditImage,
  onToggle,
  onClose,
  onChange,
}: BuyersActionPopoverProps) {
  const { t } = useTranslation()

  // Helper to get Buyers' Action display text
  const displayText = useMemo(() => {
    const actions = []
    if (allowCustomerToEditImage?.allowTransform) actions.push(t('move'))
    if (allowCustomerToEditImage?.allowRotate) actions.push(t('rotate'))
    if (allowCustomerToEditImage?.allowZoom) actions.push(t('zoom'))
    if (FEATURE_FLAGS.REMOVE_BACKGROUND_IMAGE && allowCustomerToEditImage?.allowRemoveBackground) {
      actions.push(t('remove-background'))
    }

    const totalActions = FEATURE_FLAGS.REMOVE_BACKGROUND_IMAGE ? 4 : 3

    if (actions.length === 0) {
      return '' // Empty - will show placeholder
    }
    if (actions.length === totalActions) {
      return t('all') // All options selected
    }
    if (actions.length === 1) {
      return actions[0]
    }
    return t('n-items-selected', { count: actions.length, type: t('actions') })
  }, [allowCustomerToEditImage, t])

  const handleChange = useCallback(
    (actionKey: AllowCustomerToEditImageKey) => (checked: boolean) => {
      onChange(actionKey, checked)
    },
    [onChange]
  )

  return (
    <BlockStack gap="100">
      <Text as="span" variant="bodyMd">
        {t('buyers-action')}
      </Text>
      <Popover
        active={active}
        activator={
          <div onClick={onToggle} style={{ cursor: 'pointer' }}>
            <TextField
              label={t('buyers-action')}
              labelHidden
              autoComplete="off"
              value={displayText}
              placeholder={t('select-buyers-actions')}
              suffix={<Icon source={SelectIcon} />}
              readOnly
            />
          </div>
        }
        onClose={onClose}
        preferredAlignment="left"
        fullWidth
      >
        <Popover.Section>
          <BlockStack gap="300">
            <BlockStack gap="200">
              <Checkbox
                label={t('move')}
                checked={allowCustomerToEditImage?.allowTransform || false}
                onChange={handleChange('allowTransform')}
              />
              <Checkbox
                label={t('rotate')}
                checked={allowCustomerToEditImage?.allowRotate || false}
                onChange={handleChange('allowRotate')}
              />
              <Checkbox
                label={t('zoom')}
                checked={allowCustomerToEditImage?.allowZoom || false}
                onChange={handleChange('allowZoom')}
              />
              {FEATURE_FLAGS.REMOVE_BACKGROUND_IMAGE && (
                <Checkbox
                  label={t('remove-background')}
                  checked={allowCustomerToEditImage?.allowRemoveBackground || false}
                  onChange={handleChange('allowRemoveBackground')}
                />
              )}
            </BlockStack>
          </BlockStack>
        </Popover.Section>
      </Popover>
    </BlockStack>
  )
}
