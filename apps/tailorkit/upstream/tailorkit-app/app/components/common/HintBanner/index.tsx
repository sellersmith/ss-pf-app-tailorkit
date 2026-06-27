import React from 'react'
import { Button } from '@shopify/polaris'
import { XIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import styles from './styles.module.css'

interface HintBannerProps {
  show: boolean
  children: React.ReactNode
  /** When provided, renders a close button and enables pointer events. */
  onClose?: () => void
}

export default function HintBanner({ show, children, onClose }: HintBannerProps) {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div className={`${styles.banner} ${onClose ? styles.interactive : ''}`}>
      <div className={styles.content}>{children}</div>
      {onClose && (
        <Button
          icon={XIcon}
          variant="plain"
          size="micro"
          onClick={onClose}
          accessibilityLabel={t('close')}
          tone="critical"
        />
      )}
    </div>
  )
}
