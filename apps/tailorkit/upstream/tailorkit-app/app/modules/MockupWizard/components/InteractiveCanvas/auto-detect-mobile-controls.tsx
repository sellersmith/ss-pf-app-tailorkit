import React from 'react'
import { ButtonGroup, Button } from '@shopify/polaris'
import { CheckIcon, XIcon, RefreshIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'

interface AutoDetectMobileControlsProps {
  isAutoDetectMode: boolean
  autoDetectPhase: string
  autoDetectHasOverlay: boolean
  onConfirm: () => void
  onCancel: () => void
  onRetry: () => void
}

export function AutoDetectMobileControls({
  isAutoDetectMode,
  autoDetectPhase,
  autoDetectHasOverlay,
  onConfirm,
  onCancel,
  onRetry,
}: AutoDetectMobileControlsProps) {
  const { t } = useTranslation()

  if (!isAutoDetectMode || (autoDetectPhase !== 'preview' && autoDetectPhase !== 'error')) return null

  return (
    <ButtonGroup variant="segmented">
      {autoDetectHasOverlay && (
        <Button
          onClick={onConfirm}
          size="slim"
          icon={CheckIcon}
          variant="primary"
          accessibilityLabel={t('confirm-selection')}
        />
      )}
      {autoDetectPhase === 'error' && (
        <Button onClick={onRetry} size="slim" icon={RefreshIcon} accessibilityLabel={t('retry')} />
      )}
      <Button onClick={onCancel} size="slim" icon={XIcon} accessibilityLabel={t('cancel')} />
    </ButtonGroup>
  )
}
