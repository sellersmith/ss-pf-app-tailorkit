import React from 'react'
import { Text, ButtonGroup, Button, Tooltip } from '@shopify/polaris'
import { CheckIcon, XIcon, RefreshIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import styles from '../../styles.module.css'

interface DesktopAutoDetectControlsProps {
  isAutoDetectMode: boolean
  autoDetectPhase: string
  autoDetectHasOverlay: boolean
  autoDetectError: string | null
  onConfirm: () => void
  onCancel: () => void
  onRetry: () => void
}

export function DesktopAutoDetectControls({
  isAutoDetectMode,
  autoDetectPhase,
  autoDetectHasOverlay,
  autoDetectError,
  onConfirm,
  onCancel,
  onRetry,
}: DesktopAutoDetectControlsProps) {
  const { t } = useTranslation()

  if (!isAutoDetectMode) return null

  return (
    <>
      {autoDetectHasOverlay && (
        <div className={styles.desktopVectorControls}>
          <ButtonGroup variant="segmented">
            <Tooltip content={t('confirm-and-create-selection-shape')} dismissOnMouseOut>
              <Button
                onClick={onConfirm}
                size="slim"
                icon={CheckIcon}
                variant="primary"
                accessibilityLabel={t('confirm-selection')}
              />
            </Tooltip>
            <Tooltip content={t('discard-current-selection')} dismissOnMouseOut>
              <Button onClick={onCancel} size="slim" icon={XIcon} accessibilityLabel={t('cancel-selection')} />
            </Tooltip>
          </ButtonGroup>
        </div>
      )}
      {autoDetectPhase === 'error' && (
        <div className={styles.desktopVectorControls} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <Text variant="bodySm" as="span" tone="critical">
            {autoDetectError}
          </Text>
          <ButtonGroup>
            <Button onClick={onRetry} size="slim" icon={RefreshIcon}>
              {t('retry')}
            </Button>
            <Button onClick={onCancel} size="slim">
              {t('cancel')}
            </Button>
          </ButtonGroup>
        </div>
      )}
    </>
  )
}
