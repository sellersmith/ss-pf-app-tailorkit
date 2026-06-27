import type { IconSource } from '@shopify/polaris'
import { Icon, Text } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import styles from './element-card.module.css'

interface ElementCardProps {
  id: string
  icon: IconSource
  label: string
  onClick: () => void
  /** Tone passed to Polaris Icon — subset of valid Tone values */
  iconTone?:
    | 'base'
    | 'subdued'
    | 'caution'
    | 'warning'
    | 'critical'
    | 'interactive'
    | 'info'
    | 'success'
    | 'primary'
    | 'magic'
    | 'disabled'
    | 'inherit'
    | 'text-inverse'
}

/**
 * ElementCard — a clickable card with icon and label used in ElementsToolPanel.
 * Supports 3 visual states: default, hover (CSS), and active (clicked).
 */
export default function ElementCard({ id, icon, label, onClick, iconTone }: ElementCardProps) {
  const [isActive, setIsActive] = useState(false)

  const handleClick = useCallback(() => {
    setIsActive(true)
    onClick()
    setTimeout(() => setIsActive(false), 200)
  }, [onClick])

  return (
    <button
      id={`element-card-${id}`}
      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
      onClick={handleClick}
      type="button"
    >
      <div className={styles.iconWrapper}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Icon source={icon} tone={iconTone as any} />
      </div>
      <Text as="span" variant="bodyXs" alignment="center">
        {label}
      </Text>
    </button>
  )
}
