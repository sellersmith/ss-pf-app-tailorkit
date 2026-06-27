import { BlockStack, Box, Button, Divider, InlineError, InlineStack, Label } from '@shopify/polaris'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createLayerStore, getLayerStoreById } from '~/stores/modules/layer'
import type { Layer } from '~/types/psd'
import { insertAt } from '~/utils/insertAt'
import { uuid } from '~/utils/uuid'
import type { ILayoutManagerProps } from '.'
import LayerAdditional from './LayerAdditional'
import LayerSelectedListing from './LayerSelectedListing'
import { duplicateLabel } from '~/utils/duplicateLabel'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'

function LayoutCreation(props: ILayoutManagerProps) {
  const {
    layerId,
    originalLayersSelected,
    creatingLayout,
    onCreate,
    onCancel,
    onAddLayersForCreatingLayout,
    onChangeOriginalLayersSelected,
    onDeleteOriginalLayersSelected,
    checkExistedLayerHasNoOptionSet,
    onNavigateToOutlineToCreateOptionSet,
  } = props
  const { t } = useTranslation()
  const { validationErrors, setValidationErrors } = useContext(TemplateEditorContext)
  const keyError = 'multiLayout.creatingLayout'
  const errorMsg = t('you-have-not-created-layout-yet')

  const error = validationErrors?.[`${layerId}-${keyError}`]

  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([])

  const selectedLayerStores = useMemo(
    () => originalLayersSelected.map(id => getLayerStoreById(id)),
    [originalLayersSelected]
  )

  const onChangeSortableList = useCallback(
    (items: Layer[]) => {
      onChangeOriginalLayersSelected(items.map(item => item._id))
    },
    [onChangeOriginalLayersSelected]
  )

  const onDeleteItem = useCallback(
    (_id: string) => {
      onDeleteOriginalLayersSelected(_id)

      onChangeOriginalLayersSelected(originalLayersSelected.filter(id => id !== _id))
    },
    [onChangeOriginalLayersSelected, onDeleteOriginalLayersSelected, originalLayersSelected]
  )

  const onDuplicateItem = useCallback(
    (_id: string) => {
      const newId = uuid()

      const originLayer = getLayerStoreById(_id)
      const originalLayerState = originLayer.getState()

      const duplicatedLabel = duplicateLabel(
        originalLayerState.label || originalLayerState.legacyName || '',
        originalLayersSelected.map(layerId => ({ label: getLayerStoreById(layerId).getState().legacyName || '' }))
      )

      createLayerStore({
        ...originLayer.getState(),
        // Set visible to true to show the layer in layout
        visible: true,
        legacyName: duplicatedLabel,
        label: duplicatedLabel,
        _id: newId,
      })

      const indexOriginalItem = originalLayersSelected.indexOf(_id)

      const insertedSelectedLayerIds = insertAt(originalLayersSelected, indexOriginalItem + 1, newId)

      onChangeOriginalLayersSelected(insertedSelectedLayerIds)
    },
    [onChangeOriginalLayersSelected, originalLayersSelected]
  )

  const disabled = useMemo(() => !originalLayersSelected.length, [originalLayersSelected])

  // Always block navigation while layout creation is in progress.
  // The Navigation component checks Object.keys(validationErrors).length > 0 before switching tools,
  // so keeping an error set prevents users from accidentally leaving mid-creation.
  // The error message is always valid — the user hasn't created the layout yet.
  useEffect(() => {
    setValidationErrors(layerId, keyError, errorMsg)
    return () => {
      setValidationErrors(layerId, keyError, null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyError, layerId, errorMsg, t])

  return (
    <Box>
      <Label id={'create-layout'} requiredIndicator>
        {t('create-layout')}
      </Label>

      <Box padding={'200'} background="bg" borderRadius="100">
        <BlockStack gap={'200'}>
          <InlineStack>
            <LayerAdditional
              selectedLayerIds={selectedLayerIds}
              setSelectedLayerIds={setSelectedLayerIds}
              onAddLayersForCreatingLayout={onAddLayersForCreatingLayout}
              checkExistedLayerHasNoOptionSet={checkExistedLayerHasNoOptionSet}
              onNavigateToOutlineToCreateOptionSet={onNavigateToOutlineToCreateOptionSet}
            />
          </InlineStack>

          <Divider borderColor="border" />

          <LayerSelectedListing
            items={selectedLayerStores}
            onDeleteItem={onDeleteItem}
            onDuplicateItem={onDuplicateItem}
            onChange={onChangeSortableList}
          />

          <BlockStack gap={'100'}>
            <InlineError fieldID={`${layerId}-${keyError}`} message={error} />
            <InlineStack align="space-between">
              <Button disabled={creatingLayout} onClick={onCancel}>
                {t('cancel')}
              </Button>
              <Button disabled={disabled} loading={creatingLayout} onClick={() => onCreate(originalLayersSelected)}>
                {t('create')}
              </Button>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Box>
    </Box>
  )
}

export default LayoutCreation
