import { BlockStack, Box, Divider, EmptyState, InlineStack, Text } from '@shopify/polaris'
import { /*useCallback, */ useContext, /*useState, */ type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FlexCenter } from '~/components/common/Flex'
import { KeyboardShortcutsTable } from '~/components/ui/KeyboardShortcutsTable'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { useLayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { ELayerType } from '~/types/psd'
import useDevices from '~/utils/hooks/useDevice'
import { createCanvasKeyboardShortcuts } from '~/utils/keyboardShortcuts'
import { TemplateEditorContext } from '../../context'
import { RenderConfigLayersInspector, RenderElementInspector } from '../../elements/render.client'
import { PreviewInspector } from '../Preview/index.client'

/**
 * Inspector content switcher.
 * Renders element inspector if a layer is clicked, otherwise renders
 * multi-select config, else shows keyboard shortcuts.
 */
export function Inspector() {
  const { t } = useTranslation()
  const { clickedLayerStore, checkedLayerStores } = useLayerStoreSelection()
  const { validationErrors, setValidationErrors } = useContext(TemplateEditorContext)
  const { isMobileView } = useDevices()

  const shortcutsData = createCanvasKeyboardShortcuts(t).filter(group => group.pinned)

  const layerState = clickedLayerStore && clickedLayerStore.getState()
  const shouldRenderElementInspector = clickedLayerStore && layerState?.type !== ELayerType.GROUP

  if (shouldRenderElementInspector) {
    return (
      <RenderElementInspector
        renderContext="inspector"
        layerStore={clickedLayerStore}
        onValidation={setValidationErrors}
        validationErrors={validationErrors}
      />
    )
  }

  if ((checkedLayerStores.length && !clickedLayerStore) || isMobileView) {
    return <RenderConfigLayersInspector />
  }

  if (layerState?.type === ELayerType.GROUP) {
    return (
      <FlexCenter style={{ height: '100%' }}>
        <EmptyState image={ILLUSTRATORS.EMPTY_OPTION_SET}>
          <Text variant="bodyMd" as="p">
            {t('group-layer-does-not-have-inspector-controls')}
          </Text>
        </EmptyState>
      </FlexCenter>
    )
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <Box padding="300">
        <BlockStack gap="300">
          <InlineStack>
            <Text as="h3" variant="headingMd">
              {t('keyboard-shortcuts')}
            </Text>
          </InlineStack>

          <KeyboardShortcutsTable t={t} data={shortcutsData} showPlatformLabels={false} />
        </BlockStack>
      </Box>
    </div>
  )
}

/** Props for the inspector container with optional header and custom content */
interface InspectorWithPreviewModeProps {
  renderAction?: ReactNode
  renderContent?: ReactNode
  includeHeader?: boolean
}

/** Shared inspector header with tutorial entry */
export function InspectorHeader() {
  /*const { t } = useTranslation()
  const [modalVideoTutorialOpen, setModalVideoTutorialOpen] = useState(false)

  const onCloseModalVideoTutorial = useCallback(() => {
    setModalVideoTutorialOpen(false)
  }, [])

  const onOpenModalVideoTutorial = useCallback(() => {
    setModalVideoTutorialOpen(true)
  }, [])*/

  return null

  /*return (
    <Box id="template-editor-inspector-header" paddingBlock="200" paddingInline="400">
      <InlineStack gap={'200'} blockAlign="center" align="end">
        <Tooltip content={t('learn-how-to-create-a-standout-template')} zIndexOverride={519}>
          <Button icon={LightbulbIcon} variant="tertiary" onClick={onOpenModalVideoTutorial} />
        </Tooltip>

        {modalVideoTutorialOpen ? (
          <Modal
            size="large"
            titleHidden
            onClose={onCloseModalVideoTutorial}
            open
            title={t('learn-how-to-create-a-standout-template')}
            secondaryActions={[{ content: t('close'), onAction: onCloseModalVideoTutorial }]}
          >
            <VideoCreateTemplateThumbnailWithSocialAction />
          </Modal>
        ) : null}
      </InlineStack>
    </Box>
  )*/
}

export function InspectorWithPreviewMode({
  renderAction,
  renderContent,
  includeHeader = true,
}: InspectorWithPreviewModeProps) {
  const { previewMode } = useEditorParams()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <BlockStack>
        {includeHeader ? <InspectorHeader /> : null}
        <Divider />
        {renderAction && renderAction}
      </BlockStack>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {renderContent ? (
          renderContent
        ) : previewMode ? (
          <div style={{ height: '100%', overflow: 'auto' }}>
            <PreviewInspector />
          </div>
        ) : (
          <Inspector />
        )}
      </div>
    </div>
  )
}
