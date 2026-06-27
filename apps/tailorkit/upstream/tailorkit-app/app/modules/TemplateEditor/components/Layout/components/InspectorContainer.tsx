/**
 * Inspector container component that handles compact and normal layouts
 */

import { Box, Button, InlineStack, Tooltip } from '@shopify/polaris'
import { ArrowLeftIcon } from '@shopify/polaris-icons'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import type { TFunction } from 'i18next'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ContentEditableField, {
  ContentEditableTagName,
  DisplayMode,
  EActionToEdit,
} from '~/components/common/ContentEditableField'
import { FlexCenter } from '~/components/common/Flex'
import { useStore } from '~/libs/external-store'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '~/modules/TemplateEditor/constants'
import { type TLayerStore } from '~/stores/modules/layer'
import { InspectorWithPreviewMode } from '../../Inspector'
import TemplateEditorOutline from '../../Navigation'
import useWindowSize from '~/utils/hooks/useWindowSize'
import { LayerToolMap } from '../../Outline/LayerToolbar/constants'

interface InspectorContainerProps {
  isCompactRightPane: boolean
  showInspectorOnCompact: boolean
  clickedLayerStore: any
  onBackToOutline: () => void
  t: TFunction
  isChatBotOpen?: boolean
}

/**
 * Renders the inspector container with optional back action and custom content.
 * This centralizes outline/inspector swapping logic for compact/tablet layouts.
 */
export function InspectorContainer({
  isCompactRightPane,
  showInspectorOnCompact,
  clickedLayerStore,
  onBackToOutline,
  t,
  isChatBotOpen = false,
}: InspectorContainerProps) {
  const { width: viewportWidth } = useWindowSize()
  const isTabletInspectorMode = viewportWidth > 784 && viewportWidth < 1056
  const renderInspectorContainer = (options?: {
    showBack?: boolean
    content?: React.ReactNode
    includeHeader?: boolean
  }) => {
    const { showBack, content, includeHeader } = options || {}

    return (
      <InspectorWithPreviewMode
        includeHeader={includeHeader}
        renderAction={
          showBack ? (
            <InspectorContainerBackButton onBackToOutline={onBackToOutline} clickedLayerStore={clickedLayerStore} />
          ) : null
        }
        renderContent={content}
      />
    )
  }

  // When chatbot is open, the outline is shown on the left via DesktopSidebar
  // So we don't need to render it inside the inspector
  if ((isCompactRightPane && !isChatBotOpen) || isTabletInspectorMode) {
    return renderInspectorContainer({
      showBack: showInspectorOnCompact,
      content: showInspectorOnCompact ? undefined : (
        <TemplateEditorOutline t={t} orientation="horizontal" defaultToolId={LayerToolMap.LAYERS_LISTING} />
      ),
    })
  }

  return renderInspectorContainer()
}

export function InspectorContainerBackButton({
  onBackToOutline,
  clickedLayerStore,
}: {
  onBackToOutline: () => void
  clickedLayerStore: TLayerStore
}) {
  const { t } = useTranslation()
  const name = useStore(clickedLayerStore, (state: any) => state?.label || state?.legacyName) || t('layer')

  const commit = useCallback(
    (newName: string) => {
      const trimmed = (newName || '').trim()
      if (!clickedLayerStore || !trimmed || trimmed === name) return

      clickedLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { label: trimmed } },
      })

      try {
        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
          id: clickedLayerStore.getState()._id,
          elementData: clickedLayerStore.getState(),
        })
      } catch {}
    },
    [clickedLayerStore, name]
  )
  return (
    <Box paddingBlock="300" paddingInline="400" borderBlockEndWidth="025" borderColor="border">
      <InlineStack gap={'100'} align="start" blockAlign="center" wrap={false}>
        <Tooltip content={t('back-to-layers')}>
          <FlexCenter>
            <Button onClick={onBackToOutline} variant="tertiary" icon={ArrowLeftIcon} size="slim" />
          </FlexCenter>
        </Tooltip>
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          <ContentEditableField
            title={name}
            setTitle={commit}
            maxWidth={'100%'}
            showTooltip={true}
            actionToEdit={EActionToEdit.Click}
            htmlTag={ContentEditableTagName.Div}
            displayMode={DisplayMode.InnerText}
            styles={{ fontSize: 'var(--p-font-size-325)', fontWeight: 'var(--p-font-weight-semibold)' }}
          />
        </div>
      </InlineStack>
    </Box>
  )
}
