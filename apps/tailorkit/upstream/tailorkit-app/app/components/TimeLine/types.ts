export interface TimelineItem {
  key: string
  label: string | React.ReactNode
  description?: string | React.ReactNode
  icon?: React.ReactNode
  progress?: number
}

export enum TLKitTimelineDirection {
  horizontal = 'horizontal',
  vertical = 'vertical',
}

export interface TimelineProps {
  /**
   * Array of timeline items to display
   */
  items: TimelineItem[]

  /**
   * Direction of the timeline
   * @default 'horizontal'
   */
  direction?: TLKitTimelineDirection

  /**
   * Custom class name for the timeline container
   */
  className?: string

  /**
   * Custom styles for timeline container
   */
  style?: React.CSSProperties
}
