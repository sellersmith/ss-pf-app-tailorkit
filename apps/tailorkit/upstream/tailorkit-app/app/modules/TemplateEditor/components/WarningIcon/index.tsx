import { Icon, Tooltip } from '@shopify/polaris'
import styles from './styles.module.css'
import { EWarningIconPosition, EWarningIconType } from './constants'
import { AlertTriangleIcon } from '@shopify/polaris-icons'

interface IWarningIconProps {
  tooltipContent: string
  iconType: EWarningIconType
  position: EWarningIconPosition
  display?: boolean
}

/**
 * WarningIcon component displays a warning icon with tooltip at specified position
 * @param {string} tooltipContent - Content to display in tooltip
 * @param {EWarningIconType} iconType - Type of warning icon to display
 * @param {EWarningIconPosition} position - Position of the warning icon relative to parent
 */
export default function WarningIcon({ tooltipContent, iconType, position, display = false }: IWarningIconProps) {
  const iconMap = {
    [EWarningIconType.TRIANGLE]: (
      <div style={{ width: 16, height: 16 }}>
        <Icon source={AlertTriangleIcon} tone="critical" />
      </div>
    ),
  }

  const getPositionClassName = () => {
    switch (position) {
      case EWarningIconPosition.BOTTOM_LEFT:
        return styles.bottomLeft
      default:
        return styles.topLeft
    }
  }

  if (!display) return null
  return (
    <div className={`${styles.warningWrapper} ${getPositionClassName()}`}>
      <Tooltip content={tooltipContent}>
        <div className={styles.warningIcon}>{iconMap[iconType]}</div>
      </Tooltip>
    </div>
  )
}
