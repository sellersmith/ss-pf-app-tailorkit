import { Fragment, useEffect, useState, useMemo, useCallback, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetDrawer, BottomSheetStore } from '~/components/BottomSheet'
import { HEADER_HEIGHT } from '~/components/BottomSheet/constant'
import { useStore } from '~/libs/external-store'
import { LayerStoreSelection, clearAllSelectedLayerStores } from '~/stores/modules/layer-store-selection'
import {
  TEMPLATE_EDITOR_DRAWER_KEYS,
  MUTATION_LAYER_FROM_INSPECTOR_EVENTS,
  TEMPLATE_EDITOR_TRANSMISSION_EVENTS,
} from '../../constants'
import { Inspector } from '../Inspector'
import TemplateEditorOutline, { LAYER_TOOLS } from '../Navigation'
import AddElementsTools from '../Editor/AddElementsTools'
import { LayerToolMap, type LayerToolType } from '../Outline/LayerToolbar/constants'
import LayerToolbar, { type ILayerTool } from '../Outline/LayerToolbar'
import { TemplateEditorContext } from '../../context'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { snapBottomSheet } from '~/components/BottomSheet/utils'

export default function TemplateEditorOutlineInspectorMobile() {
  const { t } = useTranslation()
  const { validationErrors } = useContext(TemplateEditorContext)
  const [showInspector, setShowInspector] = useState(false)
  const defaultTool = LAYER_TOOLS.find(t => t.id === LayerToolMap.LAYERS_LISTING) || null
  const [activeTool, setActiveTool] = useState<ILayerTool | null>(defaultTool)

  const { clickedLayerStore, checkedLayerStores } = useStore(LayerStoreSelection, state => state)

  const findToolById = useCallback((toolId: LayerToolType) => {
    return LAYER_TOOLS.find(t => t.id === toolId) || null
  }, [])

  const handleSetActiveTool = useCallback(
    (tool: ILayerTool | LayerToolType | null) => {
      // Ensure the bottom sheet is OPEN when interacting with the toolbar
      snapBottomSheet(TEMPLATE_EDITOR_DRAWER_KEYS.TEMPLATE_EDITOR, '', { expandOnActive: true, force: true })

      clearAllSelectedLayerStores()

      if (Object.keys(validationErrors).length > 0) {
        const layersListingTool = findToolById(LayerToolMap.LAYERS_LISTING)
        setActiveTool(layersListingTool || null)
        // Trigger shake effect on error layers in the listing
        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.SHAKE_VALIDATION_ERROR_LAYERS, {})
        return
      }

      // Determine the tool to set
      let toolToSet: ILayerTool | null = null
      if (typeof tool === 'string') {
        toolToSet = LAYER_TOOLS.find(t => t.id === tool) || null
      } else {
        toolToSet = tool
      }

      // When switching tools, close inspector view to show the new tool
      // Exception: if switching to LAYERS_LISTING and we're already in inspector, keep inspector open
      if (toolToSet && toolToSet.id !== LayerToolMap.LAYERS_LISTING) {
        setShowInspector(false)
      }

      setActiveTool(toolToSet)
    },
    [findToolById, validationErrors]
  )

  useEffect(() => {
    if (clickedLayerStore || checkedLayerStores.length > 0) {
      setShowInspector(true)
    }
  }, [clickedLayerStore, checkedLayerStores])

  useEffect(() => {
    const onToggleLayerToolPanel = (event: any) => {
      const { toolId } = event?.data
      if (toolId) {
        const tool = findToolById(toolId)
        setActiveTool(tool || null)
      }
    }
    Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, onToggleLayerToolPanel)

    return () => {
      Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, onToggleLayerToolPanel)
    }
  }, [findToolById])

  useEffect(() => {
    BottomSheetStore.dispatch({
      type: 'SET_BOTTOM_SHEET',
      payload: {
        bottomSheets: {
          ...BottomSheetStore.getState().bottomSheets,
          [TEMPLATE_EDITOR_DRAWER_KEYS.TEMPLATE_EDITOR]: {
            ...BottomSheetStore.getState().bottomSheets[TEMPLATE_EDITOR_DRAWER_KEYS.TEMPLATE_EDITOR],
            expandOnActive: false,
            defaultClose: true,
          },
        },
        active: {
          [TEMPLATE_EDITOR_DRAWER_KEYS.TEMPLATE_EDITOR]: {
            drawerKey: TEMPLATE_EDITOR_DRAWER_KEYS.TEMPLATE_EDITOR,
            // Set default to false to prevent the drawer from being shown on mobile
            isActive: false,
          },
        },
      },
    })
  }, [])

  // Check if the bottom sheet is currently active (open)
  const isDrawerActive = useStore(BottomSheetStore, state =>
    Object.values(state.active || {}).some((a: any) => a?.drawerKey === TEMPLATE_EDITOR_DRAWER_KEYS.TEMPLATE_EDITOR)
  )

  const bottomSheetTitle = useMemo(
    () => (
      <div
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        <LayerToolbar
          tools={LAYER_TOOLS.filter(t => !t.hidden)}
          activeTool={activeTool}
          onToolSelect={handleSetActiveTool}
          orientation="horizontal"
          groupable={false}
          disabled={Object.keys(validationErrors).length > 0}
        />
      </div>
    ),
    [activeTool, handleSetActiveTool, validationErrors]
  )

  return (
    <Fragment>
      {/* Floating Add elements button above the drawer */}
      <div
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: `${(isDrawerActive ? HEADER_HEIGHT : 0) + 12}px`,
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        <AddElementsTools />
      </div>

      <BottomSheetDrawer
        title={bottomSheetTitle}
        drawerKey={TEMPLATE_EDITOR_DRAWER_KEYS.TEMPLATE_EDITOR}
        autoBackAction={false}
        useBackdrop={true}
        {...(showInspector
          ? {
              onBack: () => setShowInspector(false),
            }
          : {})}
      >
        <Fragment>
          {!showInspector ? (
            <TemplateEditorOutline
              t={t}
              orientation="horizontal"
              defaultToolId={LayerToolMap.LAYERS_LISTING}
              activeTool={activeTool}
              onToolSelect={handleSetActiveTool}
            />
          ) : (
            <Inspector />
          )}
        </Fragment>
      </BottomSheetDrawer>
    </Fragment>
  )
}
