import type { PromptPresetType } from '~/api/services/prompt-presets'

export interface PromptPresetItem {
  id?: string
  name: string
  type: string
  thumbnail?: string[]
  description?: unknown
  instruction?: string
  hot?: boolean
  category?: string | null
}

export interface PromptPresetsProps {
  type?: PromptPresetType
  label?: string
  layout?: 'inline' | 'list' | 'carousel' | 'grid'
  viewAll?: boolean
  multiple?: boolean
  showLabel?: boolean
  showSearch?: boolean
  itemsPerRow?: number
  selected?: string | string[]
  toggleThumbnailOnMouseOver?: boolean
  showSelectAllButtons?: boolean
  /** When true, at least one item must be selected. Deselect all will select the first item. */
  required?: boolean
  filterItems?: (items: PromptPresetItem[]) => PromptPresetItem[]
  onSelect?: (itemName: string[], instruction?: string[]) => void
}

export interface PresetCardProps {
  preset: PromptPresetItem
  index: number
  isSelected: boolean
  isHovered: boolean
  thumbnailUrl: string | null
  hoverDelay?: number
  onMouseEnter: (name: string) => void
  onMouseLeave: () => void
  onClick: (name: string, index: number) => void
}

export interface LayoutProps {
  presets: PromptPresetItem[]
  selectedPreset: string[]
  hoveredItem: string | null
  itemsPerRow: number
  hasMoreItems: boolean
  showAll: boolean
  hoverDelay?: number
  getThumbnailUrl: (item: PromptPresetItem) => string | null
  onItemClick: (name: string, index: number) => void
  onMouseEnter: (name: string) => void
  onMouseLeave: () => void
  onToggleView: () => void
}
