import { BlockStack, InlineStack } from '@shopify/polaris'
import { memo } from 'react'
import styles from './Timeline.module.css'
import TLKitProgressBar from '../TLKProgressBar'
import { TLKitProgressBarLabelAlignment, TLKitProgressBarLabelPosition } from '../TLKProgressBar/types'
import { type TimelineProps, TLKitTimelineDirection } from './types'

/**
 * @author KhanhNT
 * A flexible Timeline component that can be rendered horizontally or vertically
 * @param props Timeline component props
 * @returns Timeline component
 */
const Timeline = memo(({ items, direction = TLKitTimelineDirection.horizontal, className, style }: TimelineProps) => {
  const isHorizontal = direction === TLKitTimelineDirection.horizontal
  const Container = isHorizontal ? InlineStack : BlockStack

  return (
    <div
      className={`${className} ${styles.timeline}`}
      style={style}
      data-direction={direction}
      data-role="timeline_container"
    >
      <Container gap="0" align={isHorizontal ? 'end' : 'start'} blockAlign={isHorizontal ? 'end' : 'start'}>
        {items.map(item => (
          <div key={item.key} className={styles.timelineItem} data-direction={direction} data-role="timeline_item">
            <div className={styles.progressSection}>
              {/* Progress Bar */}
              <div
                className={`${styles.progressBar} ${styles.indicator} ${item.progress === 100 ? styles.completedIndicator : styles.dot}`}
              >
                <TLKitProgressBar
                  key={item.key}
                  progress={item.progress || 0}
                  width={isHorizontal ? '100%' : 8}
                  height={isHorizontal ? 8 : 160}
                  direction={direction as any}
                  label={item.label}
                  labelPosition={isHorizontal ? TLKitProgressBarLabelPosition.top : TLKitProgressBarLabelPosition.right}
                  labelAlignment={
                    isHorizontal ? TLKitProgressBarLabelAlignment.start : TLKitProgressBarLabelAlignment.center
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </Container>
    </div>
  )
})

Timeline.displayName = 'Timeline'

export default Timeline
