import { Box, Button, Icon, InlineStack, Modal, Popover, Tooltip, ActionList } from '@shopify/polaris'
import {
  ButtonPressIcon,
  CursorIcon,
  MeasurementSizeIcon,
  KeyboardIcon,
  UndoIcon,
  RedoIcon,
  MenuHorizontalIcon,
  AppsIcon,
  ExitIcon,
  MagicIcon,
} from '@shopify/polaris-icons'
import type { EventObject } from 'extensions/tailorkit-src/src/assets/libraries/event-handler'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import cloneDeep from 'lodash/cloneDeep'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardShortcutsTable } from '~/components/ui/KeyboardShortcutsTable'
import { createCanvasKeyboardShortcuts } from '~/utils/keyboardShortcuts'
import { useTools } from '../../hooks/useTools'
import { useUndoRedo } from './UndoRedo/hooks/useUndoRedo'
import { isMacOS } from '~/bootstrap/fns/os'
import { DEFAULT_GRID_SIZE } from '~/components/canvas/Grid/constants'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import type { BackgroundUploaderResponse, BackgroundUploaderStatus } from '~/components/BackgroundUploader'
import BackgroundUploader from '~/components/BackgroundUploader'
import { TEMPLATES_ACTIONS } from '~/routes/api.templates/constants'
import { ProgressStoreActions } from '~/stores/canvas/progress'
import { getLayerStoreById, type TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useStore } from '~/libs/external-store'
import { EOptionSet } from '~/types/psd'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { FILE_UPLOAD_EVENTS } from '../../constants'
import FontUploaderModal from '../../modals/FontUploaderModal'
import ViewDetailedResultFontModal from '../../modals/ViewDetailedResultFontModal'
import { BackToProductButton } from './BackToProductButton'
import { SaveTemplateButton } from './SaveTemplateButton'
import { TemplateDimension } from './TemplateDimension'
import TemplateTitle from './TemplateTitle'
import { TemplateViewScale } from './TemplateViewScale'
import useDevices from '~/utils/hooks/useDevice'
import GridTool from './GridTool'
import { FlexCenter } from '~/components/common/Flex'
import { PreviewProductImage } from './PreviewProductImage'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { uploadedPreviewStoreActions } from '../Preview/stores/uploadedPreviewStore'
import DesignMockupPreviewTabs from '~/modules/ProductEditor/components/Canvas/DesignMockupPreviewTabs'
import { EDITOR_TABS } from '~/modules/ProductEditor/constants'
import { useEditorParams } from '~/modules/ProductEditor/hooks/useEditorParams'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { useChatBot } from '~/providers/ChatBotContext'

interface TemplateEditorHeaderProps {
  previewMode: boolean
}

export default function TemplateEditorHeader(props: TemplateEditorHeaderProps) {
  // Note: previewMode prop kept for backward compatibility but not used (URL-driven now)
  const { t } = useTranslation()
  const isMac = isMacOS()
  const { isMobileView } = useDevices()
  const navigate = useNavigateAppBridge()
  const extractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const { tab } = useEditorParams()
  const { isOpen: isChatOpen, toggleChatBot } = useChatBot()

  // Toolbar state and handlers
  const { mode, quickTools, toolBarSettings, onModeChangeHandler, onQuickToolsChangeHandler, onGridSizeChangeHandler }
    = useTools()

  // Undo/Redo state and handlers
  const { canUndo, canRedo, onUndo, onRedo } = useUndoRedo()

  // Canvas dimension for grid size unit
  const { measurementUnit } = useCanvasDimension()

  // Keyboard shortcuts modal state
  const [keyboardModalActive, setKeyboardModalActive] = useState(false)
  const toggleKeyboardModal = useCallback(() => setKeyboardModalActive(prev => !prev), [])
  const shortcutsData = createCanvasKeyboardShortcuts(t)

  // Prevent page scroll when keyboard shortcuts modal is open
  usePreventPageScroll(keyboardModalActive)

  // Grid size popover state
  const [gridPopoverActive, setGridPopoverActive] = useState(false)
  const toggleGridPopover = useCallback(() => setGridPopoverActive(prev => !prev), [])

  // Mobile menu popover state
  const [menuPopoverActive, setMenuPopoverActive] = useState(false)
  const toggleMenuPopover = useCallback(() => setMenuPopoverActive(prev => !prev), [])

  // Grid size input state
  const defaultGridSize = (toolBarSettings.grid?.gridSize || DEFAULT_GRID_SIZE).toString()
  const [gridSize, setGridSize] = useState(defaultGridSize)
  const [gridInputFocused, setGridInputFocused] = useState(false)

  // Update grid size when settings change
  useEffect(() => {
    if (!gridInputFocused) {
      setGridSize(defaultGridSize)
    }
  }, [defaultGridSize, gridInputFocused])

  // Toggle between move-tool and hand-tool
  const togglePointerMode = useCallback(() => {
    const newMode = mode === 'move-tool' ? 'hand-tool' : 'move-tool'
    onModeChangeHandler(newMode)
  }, [mode, onModeChangeHandler])

  // Handle preview mode changes - cache/reset optionSet when entering/leaving preview
  useEffect(() => {
    if (tab === EDITOR_TABS.PREVIEW) {
      // Cache original optionSet for all layers when entering preview
      extractedLayerStores?.forEach((layerStore: TLayerStore) => {
        const { _id, optionSet } = layerStore.getState()
        if (optionSet?.length) {
          uploadedPreviewStoreActions.cacheOptionSet(_id, optionSet)
        }
      })
    }

    if (tab === EDITOR_TABS.DESIGN) {
      // Restore original optionSet when returning to design (removes preview uploads)
      extractedLayerStores?.forEach((layerStore: TLayerStore) => {
        const { _id } = layerStore.getState()
        uploadedPreviewStoreActions.resetOptionSetForLayer(_id)
      })
    }
  }, [tab, extractedLayerStores])

  // Back to templates listing handler
  const onBackToProduct = useCallback(() => {
    navigate(NavMenuItems.PERSONALIZED_PRODUCTS)
  }, [navigate])

  // Listen to events from the background uploader
  useEffect(() => {
    // Define function to update the progress
    function updateProgress(e: EventObject) {
      const { failed, pending, completed, uploading } = (e.data || {}) as BackgroundUploaderStatus

      const index = failed + completed

      ProgressStoreActions.setProgress({ index, total: index + pending + uploading })
    }

    function replaceBase64SourceToURLSource(layerStore: TLayerStore, file: any, _id: string) {
      const layerState = layerStore.getState()
      const srcFile = file.image.originalSrc
      const altFile = file.alt
      const { image, optionSet = [] } = layerState
      let _optionSet: any[] = optionSet

      // Replace the new source of option set images
      if (optionSet && optionSet.length > 0) {
        const optionSetImage = optionSet.find(option => option.type === EOptionSet.IMAGE_OPTION)
        const files = optionSetImage?.data?.files || []

        if (optionSetImage && files.length > 0) {
          const _files = files.map((file: any) => {
            if (optionSetImage._id === _id) {
              file.src = srcFile
              file.imageName = undefined
            }

            return file
          })

          _optionSet = optionSet.map(option => {
            if (option._id === optionSetImage?._id) {
              return { ...option, data: { ...option.data, files: _files } }
            }

            return option
          })
        }
      }

      if (image && typeof image === 'object' && layerState._id === _id) {
        // Exclude base64 dataSrc out of the image object
        const { dataSrc, src, ...restImage } = image

        const updatedImage = { ...cloneDeep(restImage), dataSrc: srcFile, src: srcFile, imageName: altFile }

        layerStore.dispatch(
          {
            type: 'UPDATE_LAYER',
            payload: {
              state: {
                image: updatedImage,
                optionSet: _optionSet,
              },
            },
            // Don't need to listen if a dataSrc is replacing from base64 to URL
            skipTrace: true,
          },
          false
        )
      }
    }

    // Define function to process the response
    function handleResponse(e: EventObject) {
      // Parse response to update layer data
      const layerStores = TemplateEditorStore.getState().extractedLayerStores

      const { uploadedFiles = [], errorFiles, _id } = (e.data || {}) as BackgroundUploaderResponse & { _id: string }

      uploadedFiles.forEach((file: any) => {
        layerStores.forEach((layerStore: TLayerStore) => {
          const layerState = layerStore.getState()

          const { type } = layerState

          if (type === 'multi-layout') {
            const optionSet = layerState.optionSet?.find(ot => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)

            if (!optionSet) return

            // Get layer ids of layouts
            const layerIds = optionSet.data?.multi_layout?.layouts.map(layout => layout.layerIds).flat() || []

            // Loop through layer id of layout to replace the image
            layerIds.forEach(layerId => {
              const layerStore = getLayerStoreById(layerId)

              replaceBase64SourceToURLSource(layerStore, file, _id)
            })

            return
          }

          replaceBase64SourceToURLSource(layerStore, file, _id)
        })
      })

      if (errorFiles.length > 0) {
        errorFiles.forEach((file: any) => {
          console.error('Image layer is not uploaded successfully: ', file)
        })

        // Delete the image layer if the image is not uploaded successfully
        TemplateEditorStore.dispatch({
          type: 'SET_EXTRACTED_LAYER_IDS',
          payload: {
            extractedLayerStores: TemplateEditorStore.getState().extractedLayerStores.filter(
              store => store.getState()._id !== _id
            ),
          },
          skipTrace: true,
        })

        // Show toast to user
        showToast(t(TOAST.TEMPLATE_EDITOR.SOME_LAYERS_NOT_UPLOADED), { isError: true })
      }

      // Update the progress
      updateProgress(e)
    }

    Transmitter.listen(FILE_UPLOAD_EVENTS.UPLOAD, updateProgress)
    Transmitter.listen(FILE_UPLOAD_EVENTS.UPLOADED, handleResponse)

    return () => {
      Transmitter.remove(FILE_UPLOAD_EVENTS.UPLOAD, updateProgress)
      Transmitter.remove(FILE_UPLOAD_EVENTS.UPLOADED, handleResponse)
    }
  }, [t])

  const isShowingGridTool = quickTools.includes('grid-tool')
  const isShowingRulerTool = quickTools.includes('ruler-tool')

  const renderEditingTools = useCallback(
    () => (
      <InlineStack gap={'300'} blockAlign="center">
        {/* Cursor/Hand toggle tool */}
        <Tooltip content={t('select-move-hand-tool')}>
          <FlexCenter>
            <Button
              variant="monochromePlain"
              icon={<Icon source={mode === 'move-tool' ? CursorIcon : ButtonPressIcon} tone="emphasis" />}
              pressed={true}
              onClick={togglePointerMode}
            />
          </FlexCenter>
        </Tooltip>

        {/* Ruler/Measurement tool */}
        <Tooltip content={`${t('display-ruler')} (Shift + R)`}>
          <FlexCenter>
            <Button
              variant="monochromePlain"
              icon={<Icon source={MeasurementSizeIcon} tone="base" />}
              pressed={isShowingRulerTool}
              onClick={() => onQuickToolsChangeHandler('ruler-tool')}
            />
          </FlexCenter>
        </Tooltip>

        {/* Grid tool */}
        <GridTool
          t={t}
          isShowingGridTool={isShowingGridTool}
          gridPopoverActive={gridPopoverActive}
          toggleGridPopover={toggleGridPopover}
          measurementUnit={measurementUnit}
          gridSize={gridSize}
          setGridSize={setGridSize}
          setGridInputFocused={setGridInputFocused}
          onGridSizeChangeHandler={onGridSizeChangeHandler}
          onQuickToolsChangeHandler={onQuickToolsChangeHandler}
        />

        {/* Keyboard shortcuts */}
        <Tooltip content={t('view-keyboard-shortcuts')}>
          <FlexCenter>
            <Button
              variant="monochromePlain"
              icon={<Icon source={KeyboardIcon} tone="base" />}
              onClick={toggleKeyboardModal}
            />
          </FlexCenter>
        </Tooltip>

        {/* Undo */}
        <Tooltip content={`${t('undo')} (${isMac ? '⌘' : 'Ctrl'} + Z)`}>
          <FlexCenter>
            <Button
              variant="monochromePlain"
              size="micro"
              icon={<Icon source={UndoIcon} tone={canUndo ? 'base' : 'subdued'} />}
              disabled={!canUndo}
              onClick={onUndo}
            />
          </FlexCenter>
        </Tooltip>

        {/* Redo */}
        <Tooltip content={`${t('redo')} (${isMac ? '⌘ + ⇧' : 'Ctrl + Shift'} + Z)`}>
          <FlexCenter>
            <Button
              variant="monochromePlain"
              size="micro"
              icon={<Icon source={RedoIcon} tone={canRedo ? 'base' : 'subdued'} />}
              disabled={!canRedo}
              onClick={onRedo}
            />
          </FlexCenter>
        </Tooltip>

        {/* Elva AI chat toggle */}
        <Tooltip content={t('elva-ai-assistant')}>
          <div
            onClick={() => toggleChatBot()}
            style={{
              width: 'max-content',
              height: '100%',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px 10px 5px 6px',
              gap: '6px',
              background: isChatOpen
                ? 'linear-gradient(135deg, rgba(41, 132, 90, 0.15), rgba(28, 100, 67, 0.1))'
                : 'var(--p-color-bg-surface)',
              border: isChatOpen ? '1px solid rgba(41, 132, 90, 0.3)' : '1px solid var(--p-color-border)',
              transition: 'all 0.15s ease',
            }}
          >
            <img
              src="https://cdn.shopify.com/app-store/listing_images/958e5ec4440b11eb378c3c27a7a4097d/icon/CKPAh-fW_YYDEAE=.png"
              alt="Elva"
              style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
            />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Elva</span>
          </div>
        </Tooltip>
      </InlineStack>
    ),
    [
      t,
      mode,
      togglePointerMode,
      isShowingRulerTool,
      isShowingGridTool,
      gridPopoverActive,
      toggleGridPopover,
      measurementUnit,
      gridSize,
      onGridSizeChangeHandler,
      onQuickToolsChangeHandler,
      toggleKeyboardModal,
      isMac,
      canUndo,
      onUndo,
      canRedo,
      onRedo,
      isChatOpen,
      toggleChatBot,
    ]
  )

  const renderMobileMenu = useCallback(
    () => (
      <ActionList
        sections={[
          {
            items: [
              {
                content: `${t('undo')}`,
                icon: UndoIcon,
                onAction: onUndo,
                disabled: !canUndo,
              },
              {
                content: `${t('redo')}`,
                icon: RedoIcon,
                onAction: onRedo,
                disabled: !canRedo,
              },
            ],
          },
          {
            items: [
              {
                content: t('display-ruler'),
                icon: MeasurementSizeIcon,
                onAction: () => {
                  onQuickToolsChangeHandler('ruler-tool')
                  setMenuPopoverActive(false)
                },
                active: isShowingRulerTool,
              },
              {
                content: t('grid-tool'),
                icon: AppsIcon,
                onAction: () => {
                  setMenuPopoverActive(false)
                  onQuickToolsChangeHandler('grid-tool')
                },
              },
            ],
          },
          {
            items: [
              {
                content: t('elva-ai-assistant'),
                icon: MagicIcon,
                onAction: () => {
                  toggleChatBot()
                  setMenuPopoverActive(false)
                },
                active: isChatOpen,
              },
            ],
          },
        ]}
      />
    ),
    [t, isShowingRulerTool, onQuickToolsChangeHandler, canUndo, canRedo, onUndo, onRedo, isChatOpen, toggleChatBot]
  )

  return (
    <Box
      id="template-header"
      paddingBlock="200"
      paddingInline={'400'}
      borderBlockEndWidth="025"
      borderColor="border"
      position="relative"
      // visuallyHidden={previewMode}
    >
      <InlineStack blockAlign="center" gap={'300'} align="space-between">
        {/* Left section: Back button + Template title */}
        <InlineStack gap={'200'} blockAlign="center">
          <Button variant="monochromePlain" icon={ExitIcon} onClick={onBackToProduct} />
          <TemplateTitle t={t} />
        </InlineStack>

        {/* Center section: Unified tabs (Design/Mockup/Preview) */}
        <div style={{ flex: 1, maxWidth: '400px' }}>
          <DesignMockupPreviewTabs />
        </div>

        {/* Right section: Template info + Editing tools */}
        <InlineStack gap={'200'} blockAlign="center" align="space-between">
          {/* Template info section */}
          <InlineStack gap={'100'}>
            <TemplateDimension />
            <Box borderColor="border" borderInlineStartWidth="050" minHeight="20px" />
            <PreviewProductImage />
            <Box borderColor="border" borderInlineStartWidth="050" minHeight="20px" />
            <TemplateViewScale />
          </InlineStack>

          {/* Editing tools section - aligned to the right */}
          {isMobileView ? (
            <Popover
              active={menuPopoverActive}
              activator={
                <Button
                  variant="secondary"
                  icon={<Icon source={MenuHorizontalIcon} tone="base" />}
                  onClick={toggleMenuPopover}
                />
              }
              onClose={toggleMenuPopover}
            >
              <Box padding={'0'}>{renderMobileMenu()}</Box>
            </Popover>
          ) : (
            renderEditingTools()
          )}
        </InlineStack>
      </InlineStack>
      <InlineStack gap={'200'}>
        <BackgroundUploader
          t={t}
          resetStateEvent={FILE_UPLOAD_EVENTS.RESET}
          selectFileEvent={FILE_UPLOAD_EVENTS.SELECT}
          uploadFileEvent={FILE_UPLOAD_EVENTS.UPLOAD}
          uploadedFileEvent={FILE_UPLOAD_EVENTS.UPLOADED}
          message={t('uploading-index-of-total-layer-images')}
          actionUrl={`/api/templates?action=${TEMPLATES_ACTIONS.UPLOAD_FILES}`}
          // If an upload step takes too long to complete, end-users might be confused about whether the
          // process is hung, and this might result in actions we don't want. Therefore, to prevent this
          // potential not-good experience, we should let an upload step no longer than 20 seconds.
          maxFilesInOneUploadAction={5}
          maxSecondsPerUploadAction={20}
        />

        <SaveTemplateButton t={t} />
        <BackToProductButton />
        <FontUploaderModal />
        <ViewDetailedResultFontModal />
      </InlineStack>
      {/* Keyboard Shortcuts Modal */}
      <Modal
        open={keyboardModalActive}
        onClose={toggleKeyboardModal}
        title={t('keyboard-shortcuts')}
        secondaryActions={[{ content: t('close'), onAction: toggleKeyboardModal }]}
      >
        <Modal.Section>
          <KeyboardShortcutsTable t={t} data={shortcutsData} showPlatformLabels={false} />
        </Modal.Section>
      </Modal>
    </Box>
  )
}
