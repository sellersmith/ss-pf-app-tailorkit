import { BlockStack } from '@shopify/polaris'
import { memo, useCallback } from 'react'
import { ThumbnailGridButton } from './ThumbnailButton'
import { type IItem } from './ListItems'

interface IGridItemProps {
  item: IItem
  stylesImageItem?: React.CSSProperties
  showCheckbox?: boolean
  imageInSpecificWidth?: number
  onClickItem?: (newCheck: boolean, item: IItem) => void
  components?: (item: IItem) => React.ReactNode
}

export const GridItem = memo(function GridItem(props: IGridItemProps) {
  const { item, components, onClickItem, stylesImageItem, showCheckbox = true, imageInSpecificWidth = 180 } = props
  const { selected, isUploading } = item

  // Extract onClick handler to prevent recreations and enable proper memoization
  const handleClick = useCallback(() => {
    if (isUploading) return
    onClickItem?.(!selected, item)
  }, [isUploading, selected, item, onClickItem])

  return (
    <div style={{ ...stylesImageItem, borderRadius: '8px' }} onClick={handleClick}>
      <BlockStack align="center" inlineAlign="center" gap={'100'}>
        <ThumbnailGridButton item={item} showCheckbox={showCheckbox} imageInSpecificWidth={imageInSpecificWidth} />

        <BlockStack inlineAlign="center" align="center">
          {components && components(item)}
        </BlockStack>
      </BlockStack>
    </div>
  )
})
