import React, { useState, useCallback } from 'react'
import { Button, Text, ButtonGroup, Icon } from '@shopify/polaris'
import { PlusIcon, MinusIcon, SearchIcon, MenuHorizontalIcon, ResetIcon, PlayIcon } from '@shopify/polaris-icons'
import type { ShapeSelection, VectorResult } from '../../types'
import { MIN_SCALE } from '~/constants/canvas'
import styles from '../../styles.module.css'

interface MobileControlsProps {
  // State props
  shapeSelections: ShapeSelection[]
  showResult: boolean
  vectorResults: VectorResult[]
  isProcessing: boolean
  isApplying: boolean

  // Zoom props
  zoomScale?: number
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetZoom?: () => void

  // Action props
  onReset?: () => void
  onBack?: () => void
  onProcess?: () => void
  onApply?: () => void

  // Translation
  t: (key: string, options?: any) => string
}

export default function MobileControls({
  shapeSelections,
  showResult,
  vectorResults,
  isProcessing,
  isApplying,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onReset,
  onBack,
  onProcess,
  onApply,
  t,
}: MobileControlsProps) {
  const [showToolbar, setShowToolbar] = useState(false)
  const hasVectorResults = showResult && vectorResults.length > 0

  const toggleToolbar = useCallback(() => {
    setShowToolbar(!showToolbar)
  }, [showToolbar])

  const handleMainAction = useCallback(() => {
    if (hasVectorResults) {
      onApply?.()
    } else {
      onProcess?.()
    }
  }, [hasVectorResults, onApply, onProcess])

  const handleSecondaryAction = useCallback(() => {
    if (hasVectorResults) {
      onBack?.()
    } else {
      onReset?.()
    }
  }, [hasVectorResults, onBack, onReset])

  const isMainActionDisabled = hasVectorResults
    ? isApplying
    : isProcessing || shapeSelections.filter(shape => shape.source !== 'deleted-auto-detected').length === 0

  const isSecondaryActionDisabled = hasVectorResults ? false : isProcessing

  const mainActionText = hasVectorResults
    ? isApplying
      ? t('uploading')
      : t('apply')
    : isProcessing
      ? t('processing')
      : t('process')

  const secondaryActionText = hasVectorResults ? t('back') : t('reset')

  return (
    <div className={styles.mobileControlsContainer}>
      {/* Collapsible Toolbar */}
      {showToolbar && (
        <div className={styles.collapsibleToolbar}>
          {/* Zoom Controls */}
          {!hasVectorResults && zoomScale !== undefined && onZoomIn && onZoomOut && onResetZoom && (
            <>
              <Text variant="bodyMd" as="p" fontWeight="medium">
                {t('zoom-controls')}
              </Text>
              <ButtonGroup>
                <Button
                  size="medium"
                  icon={MinusIcon}
                  onClick={onZoomOut}
                  accessibilityLabel="Zoom out"
                  disabled={zoomScale <= MIN_SCALE}
                />
                <Button size="medium" icon={SearchIcon} onClick={onResetZoom} accessibilityLabel="Reset zoom" />
                <Button
                  size="medium"
                  icon={PlusIcon}
                  onClick={onZoomIn}
                  accessibilityLabel="Zoom in"
                  disabled={zoomScale >= 5.0}
                />
              </ButtonGroup>
              <Text variant="bodyMd" as="span" tone="subdued" alignment="center">
                {Math.round(zoomScale * 100)}%
              </Text>
            </>
          )}

          {/* Quick Actions */}
          <Text variant="bodyMd" as="p" fontWeight="medium">
            {t('quick-actions')}
          </Text>
          <ButtonGroup variant="segmented">
            <Button
              icon={secondaryActionText === t('back') ? ResetIcon : ResetIcon}
              onClick={handleSecondaryAction}
              disabled={isSecondaryActionDisabled}
              size="medium"
            >
              {secondaryActionText}
            </Button>
            <Button
              variant="primary"
              icon={mainActionText === t('apply') ? PlayIcon : PlayIcon}
              onClick={handleMainAction}
              loading={isProcessing || isApplying}
              disabled={isMainActionDisabled}
              size="medium"
            >
              {mainActionText}
            </Button>
          </ButtonGroup>
        </div>
      )}

      {/* Main FAB */}
      <button
        className={styles.fab}
        onClick={showToolbar ? handleMainAction : toggleToolbar}
        disabled={showToolbar && isMainActionDisabled}
        aria-label={showToolbar ? mainActionText : t('show-mobile-controls')}
      >
        {showToolbar ? (
          isProcessing || isApplying ? (
            <Icon source={PlayIcon} />
          ) : hasVectorResults ? (
            <Icon source={PlayIcon} />
          ) : (
            <Icon source={PlayIcon} />
          )
        ) : (
          <Icon source={MenuHorizontalIcon} />
        )}
      </button>

      {/* Secondary FAB (when toolbar is open) */}
      {showToolbar && (
        <button
          className={styles.fab}
          onClick={toggleToolbar}
          aria-label={t('hide-mobile-controls')}
          style={{
            backgroundColor: 'var(--p-color-bg-surface)',
            color: 'var(--p-color-text)',
            width: '48px',
            height: '48px',
            fontSize: '20px',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
