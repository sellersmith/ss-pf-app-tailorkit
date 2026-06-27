import React, { useState, useCallback } from 'react'
import { Button, Text, ButtonGroup, Icon } from '@shopify/polaris'
import { PlusIcon, MinusIcon, SearchIcon, MenuHorizontalIcon, ResetIcon, PlayIcon } from '@shopify/polaris-icons'
import type { ShapeSelection } from '../../types'
import { MIN_SCALE } from '~/constants/canvas'
import styles from '../../styles.module.css'

interface MobileControlsProps {
  // State props
  shapeSelections: ShapeSelection[]
  showResult: boolean
  processedImageUrl: string | null
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

  /** Hide Quick Actions and FAB buttons (keep zoom controls only) */
  hideQuickActions?: boolean

  // Translation
  t: (key: string, options?: any) => string
}

export default function MobileControls({
  shapeSelections,
  showResult,
  processedImageUrl,
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
  hideQuickActions = false,
  t,
}: MobileControlsProps) {
  const [showToolbar, setShowToolbar] = useState(false)

  const toggleToolbar = useCallback(() => {
    setShowToolbar(!showToolbar)
  }, [showToolbar])

  const handleMainAction = useCallback(() => {
    if (showResult && processedImageUrl) {
      onApply?.()
    } else {
      onProcess?.()
    }
  }, [showResult, processedImageUrl, onApply, onProcess])

  const handleSecondaryAction = useCallback(() => {
    if (showResult && processedImageUrl) {
      onBack?.()
    } else {
      onReset?.()
    }
  }, [showResult, processedImageUrl, onBack, onReset])

  const isMainActionDisabled
    = showResult && processedImageUrl ? isApplying : isProcessing || shapeSelections.length === 0

  const isSecondaryActionDisabled = showResult && processedImageUrl ? false : isProcessing

  const mainActionText
    = showResult && processedImageUrl
      ? isApplying
        ? t('uploading')
        : t('apply')
      : isProcessing
        ? t('processing')
        : t('process')

  const secondaryActionText = showResult && processedImageUrl ? t('back') : t('reset')

  // Simplified mode: just floating zoom buttons at bottom-left of canvas
  if (hideQuickActions) {
    const showZoom
      = !(showResult && processedImageUrl) && zoomScale !== undefined && onZoomIn && onZoomOut && onResetZoom
    if (!showZoom) return null
    return (
      <div className={styles.floatingZoomControls}>
        <ButtonGroup variant="segmented">
          <Button
            size="slim"
            icon={MinusIcon}
            onClick={onZoomOut}
            accessibilityLabel="Zoom out"
            disabled={zoomScale <= MIN_SCALE}
          />
          <Button size="slim" icon={SearchIcon} onClick={onResetZoom} accessibilityLabel="Reset zoom" />
          <Button
            size="slim"
            icon={PlusIcon}
            onClick={onZoomIn}
            accessibilityLabel="Zoom in"
            disabled={zoomScale >= 5.0}
          />
        </ButtonGroup>
      </div>
    )
  }

  return (
    <div className={styles.mobileControlsContainer}>
      {/* Collapsible Toolbar */}
      {showToolbar && (
        <div className={styles.collapsibleToolbar}>
          {/* Zoom Controls */}
          {!(showResult && processedImageUrl) && zoomScale !== undefined && onZoomIn && onZoomOut && onResetZoom && (
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
          ) : showResult && processedImageUrl ? (
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
