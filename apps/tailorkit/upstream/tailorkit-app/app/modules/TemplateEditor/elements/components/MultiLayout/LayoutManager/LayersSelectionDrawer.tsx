import { Box, EmptyState, Text } from '@shopify/polaris'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { BASE_LAYERS } from '~/constants/canvas'
import { useStore } from '~/libs/external-store'
import { SubInspector } from '~/modules/TemplateEditor/components/Inspector/SubInspector'
import { TemplateEditorStore } from '~/stores/modules/template'
import LayersSearchable from './LayersSearchable'
import { ClipartsSelector } from '~/modules/modals/ClipartsSelector'
import type { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { createLayerStore, getLayerStoreById } from '~/stores/modules/layer'
import { uuid } from '~/utils/uuid'
import { getClipartsDetails } from '~/modules/TemplateEditor/components/Inspector/Cliparts/fns'
import { duplicateLayers } from '~/modules/TemplateEditor/fns'
import { ELayerType, type Layer } from '~/types/psd'
import { ClickContext } from '~/models/ClipartClickEvent'

interface ISelectLayerCardDrawerProps {
  selectedLayers: string[]
  setSelectedLayers: Dispatch<SetStateAction<string[]>>
  activeDrawer: boolean
  toggleDrawer: () => void
  onDone: (layerIds: string[]) => void
  allowMultiple?: boolean
}

function SelectLayerCardDrawer(props: ISelectLayerCardDrawerProps) {
  const { t } = useTranslation()
  const { activeDrawer, selectedLayers, setSelectedLayers, toggleDrawer, onDone, allowMultiple = true } = props

  const {
    extractedLayerStores: extractedLayers,
    clipartsAdded,
    shopDomain,
  } = useStore(TemplateEditorStore, state => state)

  const baseLayers = useMemo(() => {
    return extractedLayers.filter(extractedLayer => BASE_LAYERS.includes(extractedLayer.getState().type))
  }, [extractedLayers])

  const [searchedLayer, setSearchedLayer] = useState('')

  const [openClipartsDialog, setOpenClipartsDialog] = useState(false)

  const toggleOpenClipartsDialog = useCallback(
    () => setOpenClipartsDialog(openClipartsDialog => !openClipartsDialog),
    []
  )

  const onQueryValueChange = useCallback((value: string) => {
    setSearchedLayer(value)
  }, [])

  const onSelectLayers = useCallback(
    (_id: string) => {
      let _selectLayers: any[] = []

      if (allowMultiple) {
        _selectLayers = !selectedLayers.includes(_id) ? [...selectedLayers, _id] : selectedLayers.filter(l => l !== _id)
      } else {
        _selectLayers = [_id]
      }

      setSelectedLayers(_selectLayers)
    },
    [allowMultiple, selectedLayers, setSelectedLayers]
  )

  const onDoneHandler = useCallback(() => {
    const extractedLayerIds = baseLayers.map(layerStore => layerStore.getState()._id)
    const layerIdsSorted = selectedLayers.sort((a: string, b: string) => {
      return extractedLayerIds.indexOf(a) - extractedLayerIds.indexOf(b)
    })
    setSelectedLayers(prev => [...layerIdsSorted])

    onDone(selectedLayers)
  }, [baseLayers, onDone, selectedLayers, setSelectedLayers])

  const existedLayers = baseLayers.length
  const isSelectingLayers = selectedLayers.length

  const addClipart = useCallback(
    async (clipartsSelected: { _id: string; type: TEMPLATE_TYPE }[]) => {
      const clipartsDetails: any[] = await getClipartsDetails({ clipartsSelected })

      if (clipartsDetails.length > 0) {
        // Create layer store from clip arts
        const _clipartsAdded = new Set(clipartsAdded)

        // Create layer store from clip arts
        const layerStoresFromClipArts = clipartsDetails
          .map(clipartDetails => {
            const layersClipart = clipartDetails.layers || []
            _clipartsAdded.add(clipartDetails)

            const newId = uuid()
            const isFromTailorkit = clipartDetails.isFromTailorkit
            const layerStoreFromClipart = createLayerStore({
              _id: newId,
              parent: '',
              type: ELayerType.GROUP,
              label: clipartDetails.name,
              visible: true,
              open: true,
              shopDomain,
            })

            // Generate new layers from the clipart
            const createdLayers = duplicateLayers({
              layers: layersClipart,
              shopDomain,
              shouldUploadImageToShopify: isFromTailorkit,
              newId,
            }) as Layer[]

            const layerStores = createdLayers.map((layer: any) => {
              return createLayerStore(layer)
            })

            return [layerStoreFromClipart, ...layerStores]
          })
          .flat()

        // Append layer stores from clip arts to extracted layer stores
        TemplateEditorStore.dispatch({
          type: 'SET_CLIPARTS',
          payload: {
            extractedLayerStores: [...layerStoresFromClipArts, ...extractedLayers],
            clipartsAdded: Array.from(_clipartsAdded),
          },
        })

        // Auto select layer after importing from clip arts
        const layerIdsFromClipArts = layerStoresFromClipArts
          // Exclude group layers
          .filter(store => store.getState().type !== 'group')
          .map(store => store.getState()._id)

        setSelectedLayers(pre => [...pre, ...(allowMultiple ? layerIdsFromClipArts : [layerIdsFromClipArts[0]])])
      }
    },
    [clipartsAdded, extractedLayers, setSelectedLayers, shopDomain, allowMultiple]
  )

  useEffect(() => {
    // Store unsubscribe functions so we can clean them up
    const unsubscribers: Array<() => void> = []

    selectedLayers.forEach(layerId => {
      const layerStore = getLayerStoreById(layerId)
      const unsubscribe = layerStore.subscribe(state => {
        if (!state.visible || state.locked) {
          setSelectedLayers(prev => prev.filter(l => l !== layerId))
        }
      })

      // Add unsubscribe function to our array
      unsubscribers.push(unsubscribe)
    })

    // Return cleanup function to unsubscribe from all subscriptions
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }, [selectedLayers, setSelectedLayers])

  return (
    <SubInspector
      key={'select-layer-sub-inspector'}
      title={t('select-layers')}
      onClose={() => toggleDrawer()}
      isOpen={activeDrawer}
      secondaryAction={{
        action: t('from-asset-library'),
        onAction: () => toggleOpenClipartsDialog(),
      }}
      primaryAction={{
        action: t('done'),
        onAction: onDoneHandler,
        disabled: !existedLayers || !isSelectingLayers,
      }}
    >
      <LayersSearchable
        extractedLayersStore={extractedLayers}
        initialLayers={baseLayers}
        queryValue={searchedLayer}
        onQueryValueChange={onQueryValueChange}
        selectedLayers={selectedLayers}
        onSelectLayers={onSelectLayers}
        emptyState={<EmptyLayer />}
        allowMultiple={allowMultiple}
      />

      {openClipartsDialog && (
        <ClipartsSelector
          active={true}
          allowMultiple={true}
          trackingContext={ClickContext.MODAL_TEMPLATE_EDITOR_MULTI_LAYOUT}
          onSelect={addClipart}
          onClose={toggleOpenClipartsDialog}
        />
      )}
    </SubInspector>
  )
}

export default SelectLayerCardDrawer

function EmptyLayer() {
  const { t } = useTranslation()

  return (
    <Box>
      <EmptyState image={ILLUSTRATORS.EMPTY_OPTION_SET}>
        <Text variant="bodyMd" as="p">
          {t('let-start-adding-elements-to-build-list-for-choosing')}
        </Text>
      </EmptyState>
    </Box>
  )
}
