import { BlockStack, InlineStack } from '@shopify/polaris'
import { memo } from 'react'
import { ThumbnailListButton } from './ThumbnailButton'
import { type IItem } from './ListItems'

interface IListItemProps {
  item: IItem
  stylesImageItem?: React.CSSProperties
  showCheckbox?: boolean
  imageInSpecificWidth?: number
  onClickItem?: (newCheck: boolean, item: IItem) => void
  components?: (item: IItem) => React.ReactNode
}

export const ListItem = memo(function ListItem(props: IListItemProps) {
  const { item, components, onClickItem, stylesImageItem, showCheckbox = true, imageInSpecificWidth = 180 } = props
  const { selected, isUploading } = item

  return (
    <div
      className="emtlkit-image-list-select"
      style={{ ...stylesImageItem }}
      onClick={e => {
        if (isUploading) return

        onClickItem && onClickItem(!selected, item)
      }}
    >
      <InlineStack align="start" blockAlign="center" gap={'200'}>
        <ThumbnailListButton item={item} showCheckbox={showCheckbox} imageInSpecificWidth={imageInSpecificWidth} />

        <BlockStack inlineAlign="center" align="center">
          {components && components(item)}
        </BlockStack>
      </InlineStack>
    </div>
  )
})
