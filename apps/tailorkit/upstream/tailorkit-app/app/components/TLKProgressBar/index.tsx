import React, { useMemo } from 'react'
import styles from './styles.module.css'
import type { TLKitProgressBarProps, TLKitProgressBarTone } from './types'

/**
 * @author KhanhNT
 * TLKitProgressBar component to display progress in various directions.
 * @param {TLKitProgressBarProps} props - The properties for the ProgressBar component.
 * @returns {JSX.Element} The rendered ProgressBar component.
 */
const TLKitProgressBar: React.FC<TLKitProgressBarProps> = props => {
  const { progress, width, height, tone = 'success', direction, label, labelPosition, labelAlignment } = props

  const colorMap: Record<TLKitProgressBarTone, string> = useMemo(() => {
    return {
      highlight: 'var(--p-color-bg-fill-info)',
      primary: 'var(--p-color-bg-fill-brand)',
      success: 'var(--p-color-bg-fill-success)',
      critical: 'var(--p-color-bg-fill-critical)',
    }
  }, [])

  const progressStyle = useMemo(() => {
    switch (direction) {
      case 'horizontal':
        return {
          width: `${progress}%`,
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor: colorMap[tone],
        }
      case 'vertical':
        return {
          width: typeof width === 'number' ? `${width}px` : width,
          height: `${progress}%`,
          backgroundColor: colorMap[tone],
        }
      default:
        return {}
    }
  }, [direction, progress, height, colorMap, tone, width])

  return (
    <div
      data-role="progressbar_container"
      className={`${styles.progressBarContainer} ${styles[`labelPosition_${labelPosition}`]} ${styles[`labelAlignment_${labelAlignment}`]}`}
    >
      {direction === 'circle' ? (
        <CircularProgress progress={progress} width={width} height={height} color={colorMap[tone]} />
      ) : (
        <div
          data-role="progressbar_element"
          style={{
            width: direction === 'horizontal' ? '100%' : typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
            borderRadius: 'var(--p-border-radius-100)',
          }}
          className={styles.progressBarElement}
        >
          <div style={progressStyle} />
        </div>
      )}
      {typeof label === 'string' ? <p className={styles.progressLabel}>{label}</p> : label}
    </div>
  )
}

export default TLKitProgressBar

const CircularProgress = (props: TLKitProgressBarProps & { color: string }) => {
  const { progress, width, height, color, label } = props

  const numericWidth = typeof width === 'number' ? width : 100 // Default to 100 if not a number
  const numericHeight = typeof height === 'number' ? height : 100 // Default to 100 if not a number
  const radius = Math.abs(numericHeight - numericWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference
  const center = numericHeight / 2

  return (
    <svg
      data-role="progressbar_element_svg"
      width={numericHeight}
      height={numericHeight}
      viewBox={`0 0 ${numericHeight} ${numericHeight}`}
    >
      {/* Background Circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={'var(--p-color-bg-fill-tertiary)'}
        strokeWidth={width}
        fill="none"
      />
      {/* Progress Circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      {typeof label === 'string' ? <p className={styles.progressLabel}>{label}</p> : label}
    </svg>
  )
}
