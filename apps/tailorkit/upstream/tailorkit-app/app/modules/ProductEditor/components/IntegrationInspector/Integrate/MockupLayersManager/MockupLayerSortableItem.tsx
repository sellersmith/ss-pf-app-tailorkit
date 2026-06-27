import { BlockStack, Box, Button, InlineError, InlineStack, Text, TextField } from '@shopify/polaris'
import { DeleteIcon, DuplicateIcon, HideIcon, ViewIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SortableList } from '~/components/common/SortableList'
import { useStore } from '~/libs/external-store'
import type { Store } from '~/libs/external-store'
import { DEFAULT_PRINT_AREA_NAME, IntegrationStore } from '~/stores/modules/integration/integration'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import {
  getLayerIntegrationStoreById,
  type TLayerIntegrationStore,
} from '~/stores/modules/integration/layerIntegration'
import type { LayerIntegration, VariantIntegration } from '~/types/integration'
import {
  convertDegreesToRadians,
  getCenterPivotPoint,
  getCorner,
  getOriginalPoint,
  normalizeAngleToPositiveValue,
} from '~/utils/angle-fns'
import { getViewLayerIntegrationStoreByIds } from '~/stores/modules/integration/viewLayerIntegration'

export function MockupLayerSortableItem(props: {
  variants: VariantIntegration[]
  mockupId: string
  layerStore: TLayerIntegrationStore
  keepPrintArea?: boolean
  id?: string
  composing?: string
  hasMaskLayer?: LayerIntegration
  onCompositeMockup: (layerStore: TLayerIntegrationStore) => void
  viewId: string
}) {
  const {
    variants,
    layerStore,
    mockupId,
    // keepPrintArea,
    viewId,
    id,
    // composing, hasMaskLayer, onCompositeMockup,
  } = props

  const { t } = useTranslation()

  const firstVariant = variants[0]
  const printAreas = firstVariant.printAreas

  const _id = useStore(layerStore, state => state._id)
  const layerName = useStore(layerStore, state => state.name)
  const printAreaId = useStore(layerStore, state => state.printAreaId)
  // const type = useStore(layerStore, state => state.type)
  const templateName = useStore(layerStore, state => state.data?.template?.name)
  const templateDeleted = useStore(layerStore, state => state.data?.template?.deletedAt)

  // Use per-view visibility if inside a view
  const viewLayerStoreVisibility = useMemo<Store<LayerIntegration, any>>(
    () => getViewLayerIntegrationStoreByIds(mockupId, viewId, _id),
    [viewId, mockupId, _id]
  )
  const layerVisible = useStore(viewLayerStoreVisibility, state => state.visible)
  const name = printAreas.find(printArea => printArea._id === printAreaId)?.name || DEFAULT_PRINT_AREA_NAME

  // Base transformation values from global layer store
  // const width = useStore(layerStore, state => state.width)
  // const height = useStore(layerStore, state => state.height)
  // const left = useStore(layerStore, state => state.x)
  // const top = useStore(layerStore, state => state.y)
  // const rotate = useStore(layerStore, state => state.rotation)

  // Effective values via per-view layer store (unified logic)
  const viewLayerStore = useMemo<Store<LayerIntegration, any>>(
    () => getViewLayerIntegrationStoreByIds(mockupId, viewId, _id),
    [viewId, mockupId, _id]
  )
  const widthEff: number | undefined = useStore(viewLayerStore, state => state.width)
  const heightEff: number | undefined = useStore(viewLayerStore, state => state.height)
  const leftEff: number | undefined = useStore(viewLayerStore, state => state.x)
  const topEff: number | undefined = useStore(viewLayerStore, state => state.y)
  const rotateEff: number | undefined = useStore(viewLayerStore, state => state.rotation)

  const clickedLayerStore = useStore(LayerIntegrationStoreSelection, state => state.clickedLayerStore)

  const selecting = clickedLayerStore?.getState()._id === _id

  const labelItem = templateName || layerName || name

  // Set label to print area name + template name
  // if (!layerName) {
  //   if (type === 'template' && templateName) {
  //     labelItem += `: ${templateName}`
  //   } else if (type === 'image') {
  //     labelItem = t('mask-layer')
  //   }
  // }

  const onClickLayerIntegration = useCallback(() => {
    if (selecting) return

    LayerIntegrationStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: {
        clickedLayerStore: getLayerIntegrationStoreById(_id),
      },
    })
  }, [selecting, _id])

  const onShowHideLayerIntegration = useCallback(() => {
    IntegrationStore.dispatch({
      type: 'TOGGLE_VIEW_LAYER_VISIBILITY',
      payload: { mockupId, viewId, layerId: _id },
    })
  }, [viewId, mockupId, _id])

  const onDuplicateLayerIntegration = useCallback(() => {
    IntegrationStore.dispatch({
      type: 'DUPLICATE_LAYER_IN_VIEW',
      payload: { mockupId, viewId, layerId: _id },
    })
  }, [viewId, mockupId, _id])

  const onDeleteLayerIntegration = useCallback(() => {
    // Clear selection if selecting
    if (selecting) {
      LayerIntegrationStoreSelection.dispatch({
        type: 'RESET_STATE',
      })
    }

    // If inside a View manager, only remove the reference from this View
    const layerId = layerStore.getState()._id

    IntegrationStore.dispatch({
      type: 'REMOVE_LAYER_FROM_VIEW',
      payload: { mockupId, viewId, layerId },
    })
  }, [viewId, mockupId, layerStore, selecting])

  // const onVariantLabelChangeHandler = useCallback(
  //   (value: string) => {
  //     layerStore.dispatch({
  //       type: 'UPDATE_NAME',
  //       payload: {
  //         name: value,
  //       },
  //     })
  //   },
  //   [layerStore]
  // )

  // Transformation handlers
  const onWidthChangeHandler = useCallback(
    (value: string) => {
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_OVERRIDES',
        payload: { mockupId, viewId, layerId: _id, patch: { width: +value } },
      })
    },
    [mockupId, viewId, _id]
  )

  const onHeightChangeHandler = useCallback(
    (value: string) => {
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_OVERRIDES',
        payload: { mockupId, viewId, layerId: _id, patch: { height: +value } },
      })
    },
    [mockupId, viewId, _id]
  )

  const onXChangeHandler = useCallback(
    (value: string) => {
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_OVERRIDES',
        payload: { mockupId, viewId, layerId: _id, patch: { x: +value } },
      })
    },
    [mockupId, viewId, _id]
  )

  const onYChangeHandler = useCallback(
    (value: string) => {
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_OVERRIDES',
        payload: { mockupId, viewId, layerId: _id, patch: { y: +value } },
      })
    },
    [mockupId, viewId, _id]
  )

  const onRotationChangeHandler = useCallback(
    (value: string) => {
      const _rotation = normalizeAngleToPositiveValue(+(value as string))

      const pivotPoint = getCenterPivotPoint(
        {
          x: leftEff,
          y: topEff,
        },
        { width: widthEff, height: heightEff },
        rotateEff || 0
      )

      const originalPoint = getOriginalPoint(pivotPoint, { width: widthEff, height: heightEff })

      const topLeftCorner = getCorner(
        pivotPoint,
        { x: originalPoint.x, y: originalPoint.y },
        convertDegreesToRadians(_rotation || 0)
      )

      const updatedLeft = +topLeftCorner.x.toFixed(2)
      const updatedTop = +topLeftCorner.y.toFixed(2)

      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_OVERRIDES',
        payload: {
          mockupId,
          viewId,
          layerId: _id,
          patch: { rotation: _rotation, x: updatedLeft, y: updatedTop },
        },
      })
    },
    [heightEff, leftEff, rotateEff, topEff, widthEff, mockupId, viewId, _id]
  )

  const sortableItemClassName = `layer-integration ${selecting ? 'active' : ''}`

  // Handle auto-composite mockup
  // const isMaskLayer = useMemo(() => !layerName && type === 'image', [layerName, type])
  // const compositeMockup = useCallback(() => onCompositeMockup(layerStore), [layerStore, onCompositeMockup])

  return (
    <BlockStack gap={'100'} id={id}>
      <SortableList.Item id={_id} styles={{ padding: '0 0', marginBottom: '-4px' }} className={sortableItemClassName}>
        <Box padding={'100'} width="100%">
          <BlockStack gap={'200'}>
            {/* Main layer row */}
            <InlineStack gap={'200'} blockAlign="center" wrap={false} align="space-between">
              <div style={{ flex: 1, maxWidth: 'calc(100% - 60px)' }} onClick={onClickLayerIntegration}>
                <InlineStack align="start" wrap={false}>
                  <SortableList.DragHandle />
                  <Box maxWidth="192px">
                    <Text as="span" variant="bodyMd">
                      {labelItem}
                    </Text>
                    {/* <ContentEditableField
                      title={labelItem}
                      maxWidth={'192px'}
                      setTitle={onVariantLabelChangeHandler}
                      className="Polaris-Text--bodyMd Polaris-Text--break"
                      onClick={onClickLayerIntegration}
                    /> */}
                  </Box>
                </InlineStack>
              </div>
              <div className={`layer-integration-actions ${selecting ? 'd-block' : ''} `}>
                <InlineStack gap={'200'} blockAlign="center">
                  {/* {hasMaskLayer && !isMaskLayer && (
                    <Button
                      onClick={compositeMockup}
                      variant="monochromePlain"
                      id={`auto-compose-${_id}`}
                      icon={composing !== _id ? MagicIcon : <Spinner size="small" />}
                    />
                  )} */}
                  <Button
                    icon={layerVisible ? ViewIcon : HideIcon}
                    variant="monochromePlain"
                    onClick={onShowHideLayerIntegration}
                  />
                  <Button icon={DuplicateIcon} variant="monochromePlain" onClick={onDuplicateLayerIntegration} />
                  <Button
                    icon={DeleteIcon}
                    variant="monochromePlain"
                    id={`delete-layer-${_id}`}
                    onClick={onDeleteLayerIntegration}
                  />
                </InlineStack>
              </div>
            </InlineStack>

            {/* Transformation controls - only show when selected */}
            {selecting && (
              <Box paddingInlineStart={'800'}>
                <BlockStack gap={'200'}>
                  <InlineStack gap={'200'} align="start">
                    <BlockStack gap={'100'}>
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        {t('width')}
                      </Text>
                      <Box width="74px">
                        <TextField
                          labelHidden
                          label={t('width')}
                          suffix="px"
                          type="number"
                          autoComplete="off"
                          value={(widthEff as number | undefined)?.toString() || '0'}
                          onChange={onWidthChangeHandler}
                          size="slim"
                        />
                      </Box>
                    </BlockStack>

                    <BlockStack gap={'100'}>
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        {t('height')}
                      </Text>
                      <Box width="74px">
                        <TextField
                          labelHidden
                          label={t('height')}
                          suffix="px"
                          type="number"
                          autoComplete="off"
                          value={(heightEff as number | undefined)?.toString() || '0'}
                          onChange={onHeightChangeHandler}
                          size="slim"
                        />
                      </Box>
                    </BlockStack>

                    <BlockStack gap={'100'}>
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        {t('rotate')}
                      </Text>
                      <Box width="74px">
                        <TextField
                          labelHidden
                          label={t('rotation-degree')}
                          suffix="°"
                          type="number"
                          autoComplete="off"
                          value={(rotateEff as number | undefined)?.toString() || '0'}
                          onChange={onRotationChangeHandler}
                          size="slim"
                        />
                      </Box>
                    </BlockStack>
                  </InlineStack>

                  <InlineStack gap={'200'} align="start">
                    <BlockStack gap={'100'}>
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        X
                      </Text>
                      <Box width="74px">
                        <TextField
                          labelHidden
                          label="X"
                          suffix="px"
                          type="number"
                          autoComplete="off"
                          value={(leftEff as number | undefined)?.toString() || '0'}
                          onChange={onXChangeHandler}
                          size="slim"
                        />
                      </Box>
                    </BlockStack>

                    <BlockStack gap={'100'}>
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        Y
                      </Text>
                      <Box width="74px">
                        <TextField
                          labelHidden
                          label="Y"
                          suffix="px"
                          type="number"
                          autoComplete="off"
                          value={(topEff as number | undefined)?.toString() || '0'}
                          onChange={onYChangeHandler}
                          size="slim"
                        />
                      </Box>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Box>
            )}
          </BlockStack>
        </Box>
      </SortableList.Item>
      {templateDeleted && (
        <Box paddingInlineStart={'300'}>
          <InlineError message={t(`${templateName} template is not available`)} fieldID={_id} />
        </Box>
      )}
    </BlockStack>
  )
}
