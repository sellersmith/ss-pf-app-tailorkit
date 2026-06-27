import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface UsesBadgeProps {
  /**
   * The click/usage count to display (minimum 100 as per Figma requirement)
   */
  clickCount: number
  /**
   * Additional inline styles
   */
  style?: React.CSSProperties
}

/**
 * UsesBadge Component
 * Displays a badge showing the usage count for a clipart item.
 * Positioned absolutely at the bottom-right of the clipart image.
 *
 * @example
 * <UsesBadge clickCount={150} />
 */
export default function UsesBadge({ clickCount, style }: UsesBadgeProps) {
  const { t } = useTranslation()

  const badgeContent = useMemo(() => {
    if (clickCount === 1) {
      return t('count-use', { count: clickCount })
    }

    return t('count-uses', { count: clickCount })
  }, [clickCount, t])

  const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '6px',
    right: '6px',
    zIndex: 20, // Higher than loading overlay (z-index: 2) and checkbox (z-index: 1)
    backgroundColor: 'var(--p-color-bg-fill-tertiary, #e3e3e3)',
    color: 'var(--p-color-text-secondary, #616161)',
    fontSize: '12px',
    fontWeight: 450,
    lineHeight: '16px',
    padding: '2px 8px',
    borderRadius: '8px',
    display: 'inline-block',
    ...style,
  }

  if (clickCount === 0) {
    return null
  }

  return <div style={badgeStyle}>{badgeContent}</div>
}
