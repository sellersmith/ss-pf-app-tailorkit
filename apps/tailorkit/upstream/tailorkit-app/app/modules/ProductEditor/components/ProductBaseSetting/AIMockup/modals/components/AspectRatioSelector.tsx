import { PopoverRatioSelector } from '~/components/AITextField/PopoverToneSelector'
import type { AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'

interface AspectRatioSelectorProps {
  value: AllowedAspectRatio
  onChange: (value: AllowedAspectRatio) => void
  width?: number
}

/**
 * Right-aligned aspect ratio selector used for AI generation output settings.
 */
export function AspectRatioSelector(props: AspectRatioSelectorProps) {
  const { value, onChange, width = 240 } = props

  return (
    <div style={{ width: `${width}px` }}>
      <PopoverRatioSelector selectedRatio={value} handleRatioChange={onChange} />
    </div>
  )
}
