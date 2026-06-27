import React from 'react'
import { ButtonGroup, Button } from '@shopify/polaris'
import { PlusIcon, MinusIcon, CheckIcon, XIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { MAGIC_WAND_CONSTANTS } from '../../constants'

interface MagicWandControlsProps {
  tolerance: number
  hasOverlay: boolean
  onToleranceChange: (v: number) => void
  onConfirm: () => void
  onCancel: () => void
}

export function MagicWandControls({
  tolerance,
  hasOverlay,
  onToleranceChange,
  onConfirm,
  onCancel,
}: MagicWandControlsProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Tolerance */}
      <ButtonGroup variant="segmented">
        <Button
          onClick={() => onToleranceChange(Math.max(tolerance - 1, MAGIC_WAND_CONSTANTS.MIN_TOLERANCE))}
          size="slim"
          icon={MinusIcon}
          disabled={tolerance <= MAGIC_WAND_CONSTANTS.MIN_TOLERANCE}
          accessibilityLabel={t('decrease-sensitivity')}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 6px',
            fontSize: 12,
            fontWeight: 600,
            minWidth: 28,
            justifyContent: 'center',
          }}
        >
          {tolerance}
        </div>
        <Button
          onClick={() => onToleranceChange(Math.min(tolerance + 1, MAGIC_WAND_CONSTANTS.MAX_TOLERANCE))}
          size="slim"
          icon={PlusIcon}
          disabled={tolerance >= MAGIC_WAND_CONSTANTS.MAX_TOLERANCE}
          accessibilityLabel={t('increase-sensitivity')}
        />
      </ButtonGroup>
      {/* Confirm / Cancel */}
      <ButtonGroup variant="segmented">
        <Button
          onClick={onConfirm}
          size="slim"
          icon={CheckIcon}
          variant="primary"
          disabled={!hasOverlay}
          accessibilityLabel={t('confirm-selection')}
        />
        <Button onClick={onCancel} size="slim" icon={XIcon} accessibilityLabel={t('cancel-selection')} />
      </ButtonGroup>
    </>
  )
}
