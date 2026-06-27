import { memo, useMemo } from 'react'
import useDevices from '~/utils/hooks/useDevice'
import { SnowflakeIcon } from './icons'

export const Snowflakes = memo(function Snowflakes() {
  const { isMobileView, isIOS } = useDevices()

  /** Reduced from 200 to 80 for better performance on lower-end devices */
  const SNOWFLAKE_COUNT = isMobileView ? 80 : 200
  const snowflakes = useMemo(() => {
    return Array.from({ length: SNOWFLAKE_COUNT }, (_, i) => {
      const left = Math.random() * 100
      const duration = 12 + Math.random() * 8
      const size = 16 + Math.random() * 12
      // Negative delay makes snowflakes appear already in motion at different positions
      const negativeDelay = -(Math.random() * duration)

      return (
        <div
          key={i}
          className="christmas-snowflake"
          style={{
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDuration: `${duration}s, 0.5s`,
            animationDelay: `${negativeDelay}s, 0s`,
          }}
        >
          <SnowflakeIcon />
        </div>
      )
    })
  }, [SNOWFLAKE_COUNT])

  if (isIOS) return null

  return <div className="christmas-snowfall-container">{snowflakes}</div>
})
