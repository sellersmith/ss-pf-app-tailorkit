import { Text } from '@shopify/polaris'
import type { StatusBlock } from './fns'
import styles from './styles.module.css'
import { useTranslation } from 'react-i18next'

interface StatusMessageProps {
  status: StatusBlock
}

/**
 * StatusMessage component displays real-time process indicators
 * Matches the design with purple text color as shown in Figma
 */
export function StatusMessage({ status }: StatusMessageProps) {
  const { t } = useTranslation()

  if (!status.message) return null

  return (
    <span className={styles.statusFlash}>
      <Text as="p" tone="success" variant="bodyMd" fontWeight="medium">
        {t(status.message)}
      </Text>
    </span>
  )
}

export default StatusMessage
