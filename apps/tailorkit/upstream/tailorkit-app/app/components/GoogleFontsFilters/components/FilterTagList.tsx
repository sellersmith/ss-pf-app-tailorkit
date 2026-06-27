import { InlineStack, Tag } from '@shopify/polaris'
import { useCallback } from 'react'

export interface FilterTagItem {
  id: string
  label: string
}

export interface FilterTagListProps {
  items: FilterTagItem[]
  onRemove: (id: string) => void
  disabled?: boolean
}

export function FilterTagList({ items, onRemove, disabled }: FilterTagListProps) {
  const handleRemove = useCallback(
    (id: string) => () => {
      onRemove(id)
    },
    [onRemove]
  )

  if (items.length === 0) return null

  return (
    <InlineStack gap="100" wrap>
      {items.map(item => (
        <Tag key={item.id} onRemove={handleRemove(item.id)} disabled={disabled}>
          {item.label}
        </Tag>
      ))}
    </InlineStack>
  )
}
