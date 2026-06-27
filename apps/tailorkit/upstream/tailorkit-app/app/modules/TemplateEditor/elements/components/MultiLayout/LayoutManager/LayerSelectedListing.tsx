import { Button, Icon, InlineStack, Thumbnail } from '@shopify/polaris'
import { DeleteIcon, DuplicateIcon, SkeletonIcon, TextIcon } from '@shopify/polaris-icons'
import { Fragment, useCallback, useMemo } from 'react'
import { MAX_LAYER_NAME_SIZE } from '~/constants/canvas'
import SortableItemList from '~/modules/SortableItemList'
import { LayerThumbnail } from '~/modules/TemplateEditor/components/Outline/LayerThumbnail'
import type { TLayerStore } from '~/stores/modules/layer'
import { getLayerStoreById } from '~/stores/modules/layer'
import type { Layer } from '~/types/psd'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useTranslation } from 'react-i18next'

export interface ILayerSelectedListingProps {
  items: TLayerStore[]
  onChange: (items: Layer[]) => void
  onDeleteItem: (id: string) => void
  onDuplicateItem: (id: string) => void
}

function LayerSelectedListing(props: ILayerSelectedListingProps) {
  const { items, onChange, onDeleteItem, onDuplicateItem } = props
  const { t } = useTranslation()
  const memoFiles = useMemo(
    () =>
      items.filter(Boolean).map(item => {
        const itemState = item.getState()
        return { ...itemState, id: itemState._id }
      }),
    [items]
  )

  const getItemDefaultLabel = useCallback(
    (item: any, index: number): string => {
      return item.name || t('layer-index', { index })
    },
    [t]
  )

  return (
    <SortableItemList
      items={memoFiles}
      canEditItems={false}
      canAddNewItems={false}
      onListChange={onChange}
      getItemDefaultLabel={(item: any) => getItemDefaultLabel(item, memoFiles.length)}
      maxLabelLength={MAX_LAYER_NAME_SIZE}
      sortableItemStyle={{ background: 'white' }}
      onItemChange={(id: string, data: any) =>
        getLayerStoreById(id)?.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              label: data.name,
            },
          },
        })
      }
      renderImage={(item: any) => {
        const { image } = item

        return item.type === 'text' ? (
          <Thumbnail source={TextIcon} alt="text-icon" size="extraSmall" />
        ) : item.type === 'imageless' ? (
          <Thumbnail source={SkeletonIcon} alt="text-icon" size="extraSmall" />
        ) : item.type === 'image' ? (
          <LayerThumbnail src={getShopifyThumbnail(image?.src || image?.dataSrc || '')} />
        ) : (
          <Fragment></Fragment>
        )
      }}
      renderActions={(item: any) => (
        <InlineStack wrap={false} gap={'050'} align="end" blockAlign="center">
          <Button
            variant="plain"
            onClick={() => onDuplicateItem(item._id)}
            icon={<Icon source={DuplicateIcon} tone="subdued" />}
          />
          <Button
            variant="plain"
            onClick={() => onDeleteItem(item._id)}
            icon={<Icon source={DeleteIcon} tone="subdued" />}
          />
        </InlineStack>
      )}
    />
  )
}

export default LayerSelectedListing
