import { Bleed, BlockStack, Tabs } from '@shopify/polaris'
import { memo, useCallback, useMemo, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { EFFECT_CATEGORIES, type EffectCategory } from './constants'
import PromptPresets from './index'
import type { PromptPresetItem } from './types'
import useDevices from '~/utils/hooks/useDevice'
import type { PromptPresetType } from '~/api/services/prompt-presets'

interface CategorizedPromptPresetsProps {
  type?: PromptPresetType
  layout?: 'grid' | 'carousel'
  itemsPerRow?: number
  selected?: string | string[]
  multiple?: boolean
  onSelect?: (names: string[], instructions?: string[]) => void
  showSearch?: boolean
}

function CategorizedPromptPresets({
  type = 'quick_prompt',
  itemsPerRow = 3,
  selected,
  multiple = false,
  onSelect,
  showSearch = false,
}: CategorizedPromptPresetsProps) {
  const { t } = useTranslation()
  const { isMobileView } = useDevices()

  const [activeCategory, setActiveCategory] = useState<EffectCategory>('all')
  const [isPending, startTransition] = useTransition()

  // Tabs configuration
  const tabs = useMemo(
    () =>
      EFFECT_CATEGORIES.map(cat => ({
        id: cat.id,
        content: t(cat.label),
        accessibilityLabel: t(cat.label),
        panelID: `${cat.id}-panel`,
      })),
    [t]
  )

  const selectedTabIndex = tabs.findIndex(tab => tab.id === activeCategory)

  const handleTabChange = useCallback(
    (selectedIndex: number) => {
      const tab = EFFECT_CATEGORIES[selectedIndex]
      if (tab) {
        startTransition(() => {
          setActiveCategory(tab.id)
        })
      }
    },
    [startTransition]
  )

  // Filter function based on active category
  const filterByCategory = useCallback(
    (items: PromptPresetItem[]) => {
      if (activeCategory === 'all') return items
      if (activeCategory === 'popular') return items.filter(i => i.hot)
      return items.filter(i => i.category === activeCategory)
    },
    [activeCategory]
  )

  return (
    <BlockStack gap="100">
      <Bleed marginInline={isMobileView ? '0' : '300'}>
        <Tabs tabs={tabs} selected={selectedTabIndex} onSelect={handleTabChange} />
      </Bleed>

      <div style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 150ms' }}>
        <PromptPresets
          type={type}
          layout="grid"
          viewAll
          itemsPerRow={itemsPerRow}
          selected={selected}
          multiple={multiple}
          onSelect={onSelect}
          showLabel={false}
          showSearch={showSearch}
          filterItems={filterByCategory}
        />
      </div>
    </BlockStack>
  )
}

export default memo(CategorizedPromptPresets)
