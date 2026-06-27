import PromptPresets from '~/modules/PromptPresets'

interface PromptPresetSelectorPanelProps {
  type: string
  layout?: string
  selected?: string[]
  /** When true, at least one item must be selected (used for visual_style) */
  required?: boolean
  onSelect?: (names: string[]) => void
}

export function PromptPresetSelectorPanel({
  type,
  layout,
  onSelect,
  selected = [],
  required = false,
}: PromptPresetSelectorPanelProps) {
  return (
    <div style={{ paddingBlock: '0.25rem 0.5rem' }}>
      <PromptPresets
        type={type}
        viewAll={true}
        layout={layout as 'grid' | 'carousel' | 'inline' | 'list'}
        showManageLink={true}
        multiple={true}
        showLabel={false}
        onSelect={onSelect}
        selected={selected}
        showSelectAllButtons={true}
        required={required}
      />
    </div>
  )
}
