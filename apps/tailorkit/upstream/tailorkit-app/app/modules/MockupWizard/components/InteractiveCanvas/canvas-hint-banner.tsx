import React from 'react'
import { ProgressBar, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import HintBanner from '~/components/common/HintBanner'
import styles from '../../styles.module.css'

interface CanvasHintBannerProps {
  isAutoDetectProcessing: boolean
  autoDetectPhase: string
  autoDetectProgress: { percent: number }
  autoDetectTips: readonly string[]
  tipIndex: number
}

export function CanvasHintBanner(props: CanvasHintBannerProps) {
  const { t } = useTranslation()
  const { isAutoDetectProcessing, autoDetectPhase, autoDetectProgress, autoDetectTips, tipIndex } = props

  return (
    <div className={styles.canvasHintBanner} aria-live="polite">
      <HintBanner show={isAutoDetectProcessing}>
        <Text variant="bodySm" as="p">
          {t(autoDetectTips[tipIndex])}
        </Text>
        {autoDetectPhase === 'downloading' && (
          <div style={{ marginTop: 4 }}>
            <ProgressBar progress={autoDetectProgress.percent} size="small" />
          </div>
        )}
      </HintBanner>
    </div>
  )
}
