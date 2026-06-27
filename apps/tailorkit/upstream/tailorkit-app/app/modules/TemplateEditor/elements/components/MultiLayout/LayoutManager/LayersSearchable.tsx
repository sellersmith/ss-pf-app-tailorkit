import type { BoxProps } from '@shopify/polaris'
import {
  BlockStack,
  Box,
  Button,
  Checkbox,
  Icon,
  InlineStack,
  RadioButton,
  Scrollable,
  Text,
  TextField,
  Thumbnail,
} from '@shopify/polaris'
import {
  HideIcon,
  LockFilledIcon,
  LockIcon,
  SearchIcon,
  SkeletonIcon,
  TextIcon,
  ViewIcon,
} from '@shopify/polaris-icons'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEBOUNCE_REQUEST_MINOR } from '~/constants/debounce'
import { useStore } from '~/libs/external-store'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '~/modules/TemplateEditor/constants'
import { isLayerOfTemplateVisible } from '~/modules/TemplateEditor/fns'
import { getLayerStoreById, type TLayerStore } from '~/stores/modules/layer'
import { ELayerType } from '~/types/psd'
import { getShopifyThumbnail } from '~/utils/loadImage'

interface ILayersSearchableProps {
  initialLayers: TLayerStore[]
  extractedLayersStore: TLayerStore[]
  queryValue: string
  selectedLayers: string[]
  scrollableHeight?: string
  emptyState?: React.ReactNode
  debounceTime?: number
  borderless?: boolean
  onQueryValueChange: (queryValue: string) => void
  onSelectLayers: (layerId: string) => void
  allowMultiple?: boolean
}

const LayersSearchableComponent = (props: ILayersSearchableProps) => {
  const {
    initialLayers,
    extractedLayersStore,
    queryValue,
    selectedLayers,
    scrollableHeight = 'calc(-310px + 100vh)',
    debounceTime = DEBOUNCE_REQUEST_MINOR,
    borderless,
    emptyState,
    onSelectLayers,
    onQueryValueChange,
    allowMultiple = true,
  } = props

  const { t } = useTranslation()

  const [filteredLayers, setFilteredLayers] = useState(initialLayers)

  const existedLayers = initialLayers.length

  const timeout = useRef<NodeJS.Timeout>()

  const onChangeQueryValueHandler = useCallback(
    (value: string) => {
      onQueryValueChange(value)

      const currentTimeout = timeout.current

      if (currentTimeout) {
        clearTimeout(currentTimeout)
      }

      timeout.current = setTimeout(() => {
        const _filteredLayers = initialLayers.filter(layer => {
          const state = layer.getState()
          const { label = '', legacyName = '', _id: layerId } = state

          // Normalize display label to match LayerListing behavior
          const displayLabel = label || legacyName || layerId

          // Regex to check if display label matches or includes value
          const regex = new RegExp(value, 'i')
          return regex.test(displayLabel)
        })

        setFilteredLayers(_filteredLayers)
      }, debounceTime)
    },
    [debounceTime, initialLayers, onQueryValueChange]
  )

  useEffect(() => {
    // Update filtered layers to latest initial layers
    setFilteredLayers(initialLayers)

    // Reset the query value change
    onQueryValueChange('')
  }, [initialLayers, onQueryValueChange])

  // TODO: This props need to be improved because the UI component design is not being inherited
  const containerProps: BoxProps = borderless
    ? {}
    : {
        paddingBlock: '200',
        paddingInline: '300',
        borderBlockEndWidth: '025',
        borderColor: 'border',
      }

  const layersContainerProps: BoxProps = borderless
    ? {
        paddingBlockStart: '150',
      }
    : {
        padding: '300',
      }

  const scrollableContainerProps: BoxProps = borderless
    ? {}
    : {
        borderColor: 'border',
        borderWidth: '025',
        borderRadius: '200',
      }

  return (
    <BlockStack>
      <Box {...containerProps}>
        <TextField
          autoComplete="false"
          label={t('search-layer')}
          labelHidden
          type="text"
          prefix={<Icon source={SearchIcon} tone="base" />}
          placeholder={t('search-layer')}
          value={queryValue}
          onChange={onChangeQueryValueHandler}
        />
      </Box>

      <Box {...layersContainerProps}>
        {filteredLayers.length > 0 && (
          <Box {...scrollableContainerProps}>
            <Scrollable style={{ height: scrollableHeight }}>
              {filteredLayers.map((layer: TLayerStore, index: number) => (
                <LayersSearchableItem
                  key={index}
                  index={index}
                  layer={layer}
                  borderless={borderless}
                  allowMultiple={allowMultiple}
                  initialLayers={initialLayers}
                  selectedLayers={selectedLayers}
                  extractedLayersStore={extractedLayersStore}
                  onSelectLayers={onSelectLayers}
                />
              ))}
            </Scrollable>
          </Box>
        )}

        {!existedLayers && (
          <div style={{ height: scrollableHeight, display: 'grid', placeItems: 'center' }}>{emptyState}</div>
        )}
      </Box>
    </BlockStack>
  )
}

function LayersSearchableItem(props: {
  index: number
  layer: TLayerStore
  borderless?: boolean
  allowMultiple: boolean
  selectedLayers: string[]
  initialLayers: TLayerStore[]
  extractedLayersStore: TLayerStore[]
  onSelectLayers: (layerId: string) => void
}) {
  const {
    index,
    layer,
    borderless,
    allowMultiple,
    selectedLayers,
    initialLayers,
    extractedLayersStore,
    onSelectLayers,
  } = props

  const _id = useStore(layer, state => state._id)
  const legacyName = useStore(layer, state => state.legacyName)
  const image = useStore(layer, state => state.image)
  const label = useStore(layer, state => state.label)
  const type = useStore(layer, state => state.type)

  const locked = useStore(layer, state => state.locked)
  const layerVisible = useStore(layer, state => state.visible)

  // Normalize label to match LayerListing behavior: label || legacyName
  const displayLabel = useMemo(() => label || legacyName || _id, [label, legacyName, _id])

  const visible = useMemo(
    () =>
      isLayerOfTemplateVisible(
        { ...layer.getState(), visible: layerVisible },
        extractedLayersStore.map(store => store.getState())
      ),
    [layer, layerVisible, extractedLayersStore]
  )

  const layerContainerProps: BoxProps = borderless
    ? {
        paddingBlock: '150',
      }
    : {
        paddingBlock: '200',
        paddingInline: '150',
        borderColor: 'border',
        borderBlockEndWidth: index === initialLayers.length - 1 ? '0' : '025',
      }

  const selectLayer = useCallback(() => {
    if (visible && !locked) {
      onSelectLayers(_id)
    }
  }, [_id, locked, onSelectLayers, visible])

  const toggleLayerVisibility = useCallback(
    (e?: any) => {
      e?.preventDefault()
      e?.stopPropagation()

      const layerStore = getLayerStoreById(_id)

      if (layerStore) {
        const newVisibilityState = !visible

        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: { visible: newVisibilityState },
          },
        })

        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
          id: _id,
          elementData: layerStore.getState(),
        })

        if (newVisibilityState && selectedLayers.includes(_id)) {
          onSelectLayers(_id)
        }
      }
    },
    [_id, onSelectLayers, selectedLayers, visible]
  )

  const toggleLayerLockedState = useCallback(
    (e?: any) => {
      e?.preventDefault()
      e?.stopPropagation()

      const layerStore = getLayerStoreById(_id)

      if (layerStore) {
        const newLockedState = !locked

        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: { locked: newLockedState },
          },
        })

        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
          id: _id,
          elementData: layerStore.getState(),
        })

        if (newLockedState && selectedLayers.includes(_id)) {
          onSelectLayers(_id)
        }
      }
    },
    [_id, locked, onSelectLayers, selectedLayers]
  )

  const enabled = visible && !locked

  return (
    <div key={_id} onClick={selectLayer} style={{ cursor: 'pointer', opacity: enabled ? 1 : 0.5 }}>
      <Box {...layerContainerProps}>
        <InlineStack gap={'100'} wrap={false} blockAlign="center" align="space-between">
          <InlineStack gap={'100'} wrap={false} blockAlign="center">
            <InlineStack>
              {allowMultiple ? (
                <Checkbox label="" labelHidden checked={selectedLayers.includes(_id)} disabled={!enabled} />
              ) : (
                <RadioButton label="" labelHidden checked={selectedLayers.includes(_id)} disabled={!enabled} />
              )}
            </InlineStack>

            <Thumbnail
              alt={''}
              size="extraSmall"
              source={
                type === ELayerType.TEXT
                  ? TextIcon
                  : type === ELayerType.IMAGELESS
                    ? SkeletonIcon
                    : getShopifyThumbnail((image as any)?.src) || ''
              }
            />

            <Box width="calc(360px - 134px)">
              <Text as="span" variant="bodyMd" truncate>
                {displayLabel}
              </Text>
            </Box>
          </InlineStack>
          <InlineStack wrap={false} gap="050" align="end" blockAlign="center">
            <Button
              variant="plain"
              onClick={toggleLayerVisibility}
              icon={<Icon source={visible ? ViewIcon : HideIcon} tone="subdued" />}
            />
            <Button
              variant="plain"
              onClick={toggleLayerLockedState}
              icon={<Icon source={locked ? LockFilledIcon : LockIcon} />}
            />
          </InlineStack>
        </InlineStack>
      </Box>
    </div>
  )
}

export default LayersSearchableComponent
