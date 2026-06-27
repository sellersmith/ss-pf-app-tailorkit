/**
 * Thumbnail card for a template type in Step 4.
 * Shows idle/generating/ready/error states with magic wand icon.
 */

import { useEffect, useState } from 'react'
import { BlockStack, Icon, Text } from '@shopify/polaris'
import { WandIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { TemplateThumbCardProps } from '../types'
import styles from '../styles.module.css'

const GENERATING_MESSAGES = [
  'generating-analyzing-product',
  'generating-designing-layout',
  'generating-applying-effects',
  'generating-almost-ready',
] as const

export function TemplateThumbCard({
  type,
  label,
  state,
  isSelected,
  isInstant,
  onClick,
  onRegenerate,
}: TemplateThumbCardProps) {
  const { t } = useTranslation()
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    if (state.status !== 'generating') {
      setMsgIndex(0)
      return
    }
    const interval = setInterval(() => setMsgIndex(i => (i + 1) % GENERATING_MESSAGES.length), 3000)
    return () => clearInterval(interval)
  }, [state.status])

  const isGenerating = state.status === 'generating'
  const cardClassName = [
    styles.thumbCard,
    isSelected && styles.thumbCardSelected,
    state.status === 'error' && styles.thumbCardError,
    isGenerating && styles.thumbCardDisabled,
  ]
    .filter(Boolean)
    .join(' ')

  // Show magic wand icon for idle and generating-without-thumbnail states
  const hasThumbnail = !!state.thumbnailUrl
  const showWand = state.status === 'idle' || (state.status === 'generating' && !hasThumbnail)
  const isBouncing = state.status === 'generating' && !hasThumbnail

  return (
    <div
      className={cardClassName}
      onClick={isGenerating ? undefined : onClick}
      role="radio"
      aria-checked={isSelected}
      aria-disabled={isGenerating}
      aria-label={t(label)}
      tabIndex={isGenerating ? -1 : 0}
      onKeyDown={e => {
        if (isGenerating) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Thumbnail area */}
      {isBouncing ? (
        <div className={`${styles.thumbCardPlaceholder} ${styles.thumbCardSkeleton}`}>
          <div className={styles.thumbCardWandBounce}>
            <Icon source={WandIcon} tone="success" />
          </div>
        </div>
      ) : (
        showWand && (
          <div className={`${styles.thumbCardPlaceholder} ${styles.thumbCardWandIdle}`}>
            <Icon source={WandIcon} tone="success" />
          </div>
        )
      )}
      {(state.status === 'ready' || state.status === 'generating') && state.thumbnailUrl && (
        <img src={state.thumbnailUrl} alt={t(label)} className={styles.thumbCardThumbnail} loading="lazy" />
      )}
      {state.status === 'error' && (
        <div className={styles.thumbCardPlaceholder}>
          <Text as="span" tone="critical" variant="bodyMd">
            !
          </Text>
        </div>
      )}

      {/* Label and status text */}
      <BlockStack gap="050">
        <Text as="span" variant="bodyMd" fontWeight={isSelected ? 'semibold' : 'regular'}>
          {state.status === 'generating' ? t(GENERATING_MESSAGES[msgIndex]) : t(label)}
        </Text>
        {state.status === 'idle' && !isInstant && (
          <Text as="span" variant="bodyMd" tone="subdued">
            {t('let-ai-generate')}
          </Text>
        )}
        {state.status === 'ready' && !isInstant && onRegenerate && (
          <button
            type="button"
            className={styles.regenerateLink}
            onClick={e => {
              e.stopPropagation()
              onRegenerate()
            }}
          >
            {t('let-ai-regenerate')}
          </button>
        )}
        {state.status === 'error' && (
          <button
            type="button"
            className={styles.regenerateLink}
            onClick={e => {
              e.stopPropagation()
              onClick()
            }}
          >
            {t('retry')}
          </button>
        )}
      </BlockStack>
    </div>
  )
}
