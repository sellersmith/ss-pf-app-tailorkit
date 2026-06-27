import React from 'react'
import { Text, ButtonGroup, Button, Tooltip, Spinner } from '@shopify/polaris'
import { PlusIcon, MinusIcon, CheckIcon, XIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { MAGIC_WAND_CONSTANTS } from '../../constants'
import styles from '../../styles.module.css'

interface DesktopMagicWandControlsProps {
  isMagicWandMode: boolean
  magicWandHasOverlay: boolean
  magicWandTolerance: number
  magicWandIsLoading: boolean
  magicWandError: string | null
  onToleranceChange: (v: number) => void
  onConfirm: () => void
  onCancel: () => void
}

export function DesktopMagicWandControls({
  isMagicWandMode,
  magicWandHasOverlay,
  magicWandTolerance,
  magicWandIsLoading,
  magicWandError,
  onToleranceChange,
  onConfirm,
  onCancel,
}: DesktopMagicWandControlsProps) {
  const { t } = useTranslation()

  if (!isMagicWandMode) return null

  return (
    <div className={styles.desktopVectorControls}>
      {/* Tolerance */}
      <ButtonGroup variant="segmented">
        <Tooltip content={t('decrease-sensitivity')} dismissOnMouseOut>
          <Button
            onClick={() => onToleranceChange(Math.max(magicWandTolerance - 1, MAGIC_WAND_CONSTANTS.MIN_TOLERANCE))}
            size="slim"
            icon={MinusIcon}
            disabled={magicWandTolerance <= MAGIC_WAND_CONSTANTS.MIN_TOLERANCE}
            accessibilityLabel={t('decrease-sensitivity')}
          />
        </Tooltip>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            fontSize: 12,
            fontWeight: 600,
            minWidth: 32,
            justifyContent: 'center',
          }}
        >
          {magicWandTolerance}
        </div>
        <Tooltip content={t('increase-sensitivity')} dismissOnMouseOut>
          <Button
            onClick={() => onToleranceChange(Math.min(magicWandTolerance + 1, MAGIC_WAND_CONSTANTS.MAX_TOLERANCE))}
            size="slim"
            icon={PlusIcon}
            disabled={magicWandTolerance >= MAGIC_WAND_CONSTANTS.MAX_TOLERANCE}
            accessibilityLabel={t('increase-sensitivity')}
          />
        </Tooltip>
      </ButtonGroup>

      {/* Confirm / Cancel */}
      <ButtonGroup variant="segmented">
        <Tooltip content={t('confirm-and-create-selection-shape')} dismissOnMouseOut>
          <Button
            onClick={onConfirm}
            size="slim"
            icon={CheckIcon}
            variant="primary"
            disabled={!magicWandHasOverlay}
            accessibilityLabel={t('confirm-selection')}
          />
        </Tooltip>
        <Tooltip content={t('discard-current-selection')} dismissOnMouseOut>
          <Button onClick={onCancel} size="slim" icon={XIcon} accessibilityLabel={t('cancel-selection')} />
        </Tooltip>
      </ButtonGroup>
      {magicWandIsLoading && (
        <div className={styles.magicWandLoadingBadge}>
          <Spinner size="small" />
          <span>{t('loading-opencv')}</span>
        </div>
      )}
      {magicWandError && (
        <Text variant="bodySm" as="span" tone="critical">
          {magicWandError}
        </Text>
      )}
    </div>
  )
}
