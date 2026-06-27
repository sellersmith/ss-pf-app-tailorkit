export enum TLKitProgressBarDirection {
  horizontal = 'horizontal',
  vertical = 'vertical',
  circle = 'circle',
}

export enum TLKitProgressBarLabelPosition {
  top = 'top',
  bottom = 'bottom',
  left = 'left',
  right = 'right',
}

export enum TLKitProgressBarLabelAlignment {
  start = 'start',
  center = 'center',
  end = 'end',
}

export enum TLKitProgressBarTone {
  highlight = 'highlight',
  primary = 'primary',
  success = 'success',
  critical = 'critical',
}

export interface TLKitProgressBarProps {
  /**
   * Progress percentage (0-100)
   */
  progress: number

  /**
   * Direction of the progress bar
   * @default 'horizontal'
   */
  direction?: TLKitProgressBarDirection

  /**
   * Width of the progress bar
   */
  width: number | string

  /**
   * Height of the progress bar
   */
  height: number | string

  /**
   * Color of the progress bar
   */
  tone?: TLKitProgressBarTone

  /**
   * Label of the progress bar
   */
  label?: React.ReactNode | string

  /**
   * Position of the label
   */
  labelPosition?: TLKitProgressBarLabelPosition

  /**
   * Alignment of the label
   */
  labelAlignment?: TLKitProgressBarLabelAlignment
}
