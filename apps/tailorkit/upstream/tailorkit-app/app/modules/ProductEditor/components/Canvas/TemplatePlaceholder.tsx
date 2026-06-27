import { useTranslation } from 'react-i18next'
import { Group, Path, Text } from 'react-konva'

interface TemplatePlaceholderProps {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  visible?: boolean
  text?: string
  color?: string
}

/**
 * TemplatePlaceholder - A reusable component for showing template placeholder areas
 * Features:
 * - Lightbulb icon (shown when space allows, scales with canvas size)
 * - Explanatory text (shown when space allows, scales with canvas size)
 * - Proper rotation handling around the correct center point
 * - Automatic scaling based on canvas dimensions to maintain visibility
 * Note: This component does NOT render the background - that should be handled by the parent
 */
export function TemplatePlaceholder(props: TemplatePlaceholderProps) {
  const { t } = useTranslation()
  const {
    x,
    y,
    width,
    height,
    rotation = 0,
    visible = true,
    text = t('this-is-the-personalization-area-your-personalization-template-will-appear-here'),
    color = '#616161',
  } = props

  // Calculate scaling factors based on available space (more conservative scaling)
  const minDimension = Math.min(width, height)
  const iconScale = Math.max(1, Math.min(3, minDimension / 200)) // Scale icon based on smallest dimension, max 3x
  const baseFontSize = Math.max(12, Math.min(24, minDimension / 40)) // Scale font size proportionally, max 24px
  const iconSpacing = Math.max(25, Math.min(50, minDimension / 12)) // Scale spacing between icon and text, max 50px

  const shouldShowIcon = width > 60 && height > 50
  const shouldShowText = width > 120 && height > 40

  return (
    <Group listening={false}>
      {/* Lightbulb icon - only show if there's enough space */}
      {shouldShowIcon && (
        <Group x={x} y={y} rotation={rotation} visible={visible}>
          {/* Position lightbulb at center of rectangle */}
          <Group x={width / 2} y={height / 2 - iconSpacing}>
            {/* Lightbulb icon using SVG paths - centered around 0,0 with scaling */}
            <Group x={-10.5 * iconScale} y={-10 * iconScale} scaleX={iconScale} scaleY={iconScale}>
              {/* Top ray */}
              <Path
                data={
                  'M10.5 2C10.9142 2 11.25 2.33579 11.25 2.75V3.25C11.25 3.66421 '
                  + '10.9142 4 10.5 4C10.0858 4 9.75 3.66421 9.75 3.25V2.75C9.75 2.33579 '
                  + '10.0858 2 10.5 2Z'
                }
                fill={color}
              />
              {/* Top-left ray */}
              <Path
                data={
                  'M6.08059 4.16656C5.7877 3.87367 5.31283 3.87367 5.01993 4.16656C4.72704 '
                  + '4.45945 4.72704 4.93433 5.01993 5.22722L5.37349 5.58077C5.66638 5.87367 '
                  + '6.14125 5.87367 6.43415 5.58077C6.72704 5.28788 6.72704 4.81301 '
                  + '6.43415 4.52011L6.08059 4.16656Z'
                }
                fill={color}
              />
              {/* Left ray */}
              <Path
                data={
                  'M2.5 9.75C2.5 9.33579 2.83579 9 3.25 9H3.75C4.16421 9 4.5 9.33579 '
                  + '4.5 9.75C4.5 10.1642 4.16421 10.5 3.75 10.5H3.25C2.83579 10.5 '
                  + '2.5 10.1642 2.5 9.75Z'
                }
                fill={color}
              />
              {/* Right ray */}
              <Path
                data={
                  'M16.5 9.75C16.5 9.33579 16.8358 9 17.25 9H17.75C18.1642 9 '
                  + '18.5 9.33579 18.5 9.75C18.5 10.1642 18.1642 10.5 17.75 10.5H17.25C16.8358 '
                  + '10.5 16.5 10.1642 16.5 9.75Z'
                }
                fill={color}
              />
              {/* Top-right ray */}
              <Path
                data={
                  'M16.1569 5.40398C16.4497 5.11109 16.4497 4.63621 16.1569 4.34332C15.864 '
                  + '4.05043 15.3891 4.05043 15.0962 4.34332L14.7426 4.69687C14.4497 4.98976 '
                  + '14.4497 5.46464 14.7426 5.75753C15.0355 6.05043 15.5104 6.05043 '
                  + '15.8033 5.75753L16.1569 5.40398Z'
                }
                fill={color}
              />
              {/* Main bulb body */}
              <Path
                data={
                  'M6.9737 5.99824C8.92123 4.05072 12.0788 4.05072 14.0263 5.99824C14.9753 '
                  + '6.94719 15.4869 8.10141 15.4869 9.29552C15.4869 10.4896 14.9753 11.6438 '
                  + '14.0263 12.5928C14.0085 12.6106 13.9905 12.6282 13.9725 12.6456C13.4997 '
                  + '13.1009 13.25 13.5121 13.25 13.8864V14.9999C13.25 16.3806 12.1307 17.4999 '
                  + '10.75 17.4999H10.25C8.8693 17.4999 7.75001 16.3806 7.75001 14.9999V13.8864C7.75001 '
                  + '13.5121 7.50032 13.1009 7.02755 12.6456C7.00949 12.6282 6.99154 12.6106 '
                  + '6.9737 12.5928C6.02476 11.6438 5.51306 10.4896 5.51306 9.29552C5.51306 '
                  + '8.10141 6.02476 6.94719 6.9737 5.99824ZM12.9656 7.0589C11.6039 5.69716 '
                  + '9.3961 5.69716 8.03436 7.0589C7.32868 7.76458 7.01306 8.54999 7.01306 '
                  + '9.29552C7.01306 10.041 7.32868 10.8265 8.03436 11.5321C8.04555 11.5433 '
                  + '8.05678 11.5543 8.06805 11.5652C8.43411 11.9177 8.85586 12.4006 9.08345 '
                  + '13H11.9166C12.1442 12.4006 12.5659 11.9177 12.932 11.5652C12.9432 11.5543 '
                  + '12.9545 11.5433 12.9656 11.5321C13.6713 10.8265 13.9869 10.041 13.9869 '
                  + '9.29552C13.9869 8.54999 13.6713 7.76458 12.9656 7.0589ZM11.75 14.5H9.25001V14.9999C9.25001 '
                  + '15.5522 9.69772 15.9999 10.25 15.9999H10.75C11.3023 15.9999 11.75 '
                  + '15.5522 11.75 14.9999V14.5Z'
                }
                fill={color}
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </Group>
          </Group>
        </Group>
      )}

      {/* Explanatory text - only show if there's enough space */}
      {shouldShowText && (
        <Group x={x} y={y} rotation={rotation} visible={visible}>
          {/* Position text at center of rectangle */}
          <Group x={width / 2} y={height / 2 + iconSpacing * 0.6}>
            <Text
              x={0}
              y={0}
              text={text}
              fontSize={baseFontSize}
              fontFamily="Inter"
              fontWeight="450"
              fill={color}
              fillEnabled={true}
              strokeHitEnabled={true}
              align="center"
              width={Math.min(width * 0.8, width - 32)}
              offsetX={Math.min(width * 0.4, (width - 32) / 2)}
              lineHeight={1.4}
            />
          </Group>
        </Group>
      )}
    </Group>
  )
}
