import type { Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { StrokePicker } from './StrokePicker'

interface ITextStrokeProps {
  /** Paint-based stroke value (supports solid, image, gradient) */
  strokePaint: Paint | undefined
  /** Stroke weight in pixels */
  strokeWeight: number
  /** Callback when stroke paint changes */
  onChangeStrokePaint: (paint: Paint) => void
  /** Callback when stroke weight changes */
  onChangeStrokeWeight: (value: number) => void
  /** Shop domain for asset uploads (optional) */
  shopDomain?: string
}

export const TextStroke = (props: ITextStrokeProps) => {
  const { strokePaint, strokeWeight, onChangeStrokePaint, onChangeStrokeWeight, shopDomain } = props

  return (
    <StrokePicker
      value={strokePaint}
      strokeWeight={strokeWeight}
      onChange={onChangeStrokePaint}
      onChangeWeight={onChangeStrokeWeight}
      shopDomain={shopDomain}
    />
  )
}
