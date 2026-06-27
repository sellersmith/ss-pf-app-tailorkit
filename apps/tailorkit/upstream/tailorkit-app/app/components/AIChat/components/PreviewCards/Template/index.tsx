import { BlockStack, Box, Button, Card, List, SkeletonBodyText, SkeletonDisplayText, Text } from '@shopify/polaris'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LayerDocument } from '~/models/Layer.server'
import type { TemplateData } from '~/libs/langchain/agents/templates/services/TemplateComposer'
import { TemplateEditorStore } from '~/stores/modules/template'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore, deleteLayerStores } from '~/stores/modules/layer'
import type Konva from 'konva'
import { ClipartCanvas } from '~/modules/TemplateEditor/components/Inspector/Cliparts/ClipartCanvas.client'
import { useInitTemplate } from '~/modules/TemplateEditor/hooks/useInitTemplate'
import { isMaxModalRoute, isTemplateModalRoute, navigateToShopifyAdmin } from '~/utils/shopify'
import { useLocation, useNavigate } from '@remix-run/react'
import { uuid } from '~/utils/uuid'
import { createTemplateFromFormData } from '~/routes/templates._index/fns'
import { saveTemplateAiMessage } from './fns'
import { useChatBot } from '~/providers/ChatBotContext'
import { useRootLoaderData } from '~/root'
import type { EOptionSet } from '~/types/psd'
import { optionSetDataKeys } from '~/types/psd'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'

interface TemplatePreviewCardProps {
  template: TemplateData & { cardId: string; ctaButton: { text: string } }
  onUseTemplate?: () => void
  loading?: boolean
  disabled?: boolean
}

/**
 * A card component to display AI-generated template information in a user-friendly way
 */
export const TemplatePreviewCard = memo(function TemplatePreviewCard({
  template,
  onUseTemplate,
  loading = false,
  disabled = false,
}: TemplatePreviewCardProps) {
  const { t } = useTranslation()
  const { PUBLIC_ENV: { APP_HANDLE } = {} } = useRootLoaderData() || {}
  const { layers, name, dimension, previewUrl, ctaButton } = template || ({} as TemplateData)
  const { currentConversation, saveAiMessage } = useChatBot()
  const { initTemplate } = useInitTemplate()

  const navigate = useNavigate()
  const location = useLocation()
  const isTemplateModal = isTemplateModalRoute(location.pathname)

  const reversedLayers = useMemo(() => (layers && layers.length ? [...layers].reverse() : []), [layers])

  const handleNavigate = useCallback(
    (urlPath: string) => {
      if (isMaxModalRoute(location.pathname)) {
        navigateToShopifyAdmin(`/apps/${APP_HANDLE}${urlPath}`)
      } else {
        navigate(urlPath)
      }
    },
    [APP_HANDLE, location.pathname, navigate]
  )

  const handleConversationMessagesAndTrackEvent = useCallback(
    async (templateUrl: string) => {
      const aiMessageTemplateCreated = currentConversation.messages.find(
        message =>
          message.metadata?.type === 'template_created' && message.metadata?.templateData?.cardId === template.cardId
      )
      const aiMessageTemplateCreatedCount = aiMessageTemplateCreated?.metadata?.clickCreateTemplateCount || 0

      // Save AI message for this integration using reusable utility
      await saveTemplateAiMessage({
        templateData: template,
        templateUrl,
        messageContent: t('ai-chat-template-preview-card-use-template-success-message'),
        aiMessageTemplateCreatedCount,
        messageId: aiMessageTemplateCreated?.id || '',
        saveAiMessage,
      })
    },
    [currentConversation.messages, saveAiMessage, t, template]
  )

  const scaleLayersToFitCanvas = useCallback(
    (
      layers: LayerDocument[],
      templateDimension: typeof dimension,
      canvasDimension: typeof dimension
    ): LayerDocument[] => {
      if (!templateDimension || !canvasDimension) return layers

      // Calculate scale factor needed to fit template into canvas
      const scaleX = canvasDimension.width / templateDimension.width
      const scaleY = canvasDimension.height / templateDimension.height
      const scaleFactor = Math.min(scaleX, scaleY)

      // Only scale down if template is larger than canvas
      if (scaleFactor >= 1) {
        return layers
      }

      // Calculate offset to center the scaled template
      const scaledTemplateWidth = templateDimension.width * scaleFactor
      const scaledTemplateHeight = templateDimension.height * scaleFactor
      const offsetX = (canvasDimension.width - scaledTemplateWidth) / 2
      const offsetY = (canvasDimension.height - scaledTemplateHeight) / 2

      // Scale all layer positions and dimensions, then center
      return layers.map(layer => ({
        ...layer,
        left: (layer.left || 0) * scaleFactor + offsetX,
        top: (layer.top || 0) * scaleFactor + offsetY,
        width: (layer.width || 0) * scaleFactor,
        height: (layer.height || 0) * scaleFactor,
      }))
    },
    []
  )

  const handleUseTemplate = useCallback(async () => {
    if (!loading && !disabled && onUseTemplate) {
      onUseTemplate()
    }

    // Track the time when user use AI feature
    localStorage.setItem('TLK_USE_AI_FEATURE_AT', Date.now().toString())

    // Use AIs generated template
    const layers = reversedLayers.map(layer => {
      const originalId = (layer as LayerDocument)?._id
      return {
        ...layer,
        _id: uuid(),
        clonedBy: originalId, // preserve lineage for stable mapping between preview -> editor
        ...(layer.image
          ? {
              image: {
                ...(layer.image as any),
                _id: uuid(),
              },
            }
          : {}),
        optionSet:
          layer.optionSet?.map(optionSet => {
            const optionSetType = optionSet.type as EOptionSet
            const optionSetDataKey = optionSetDataKeys[optionSetType as keyof typeof optionSetDataKeys]

            return {
              ...optionSet,
              _id: uuid(),
              data: {
                ...(optionSet.data || {}),
                [optionSetDataKey]: (optionSet.data as any)?.[optionSetDataKey]?.map((item: any) => ({
                  ...item,
                  _id: uuid(),
                })),
              },
            }
          }) || [],
      }
    }) as LayerDocument[]

    const formData = {
      ...template,
      title: name,
      ...dimension,
      layers,
      type: TEMPLATE_TYPE.TEMPLATE,
      // Do not auto-open AI Chat when navigating to editor; keep conversation linkage only if needed by downstream
      currentConversationId: currentConversation.id,
      autoSelectFirstLayer: true,
    }

    const templateUrl = await createTemplateFromFormData(formData)

    if (isTemplateModal) {
      const currentEditorState = TemplateEditorStore.getState()

      // Scale layers if template is larger than current canvas
      const templateDimension = template.dimension
      const currentDimension = currentEditorState.dimension
      const scaledLayers
        = templateDimension && currentDimension
          ? scaleLayersToFitCanvas(layers, templateDimension, currentDimension as typeof dimension)
          : layers

      // Align editor to the newly created template id to avoid duplications in mention list
      let newTemplateId = ''
      try {
        const match = templateUrl.match(/\/templates\/([^/?]+)/)
        newTemplateId = match ? match[1] : ''
      } catch {}

      initTemplate({
        ...currentEditorState,
        ...template,
        type: TEMPLATE_TYPE.TEMPLATE,
        _id: newTemplateId || currentEditorState._id,
        dimension: currentEditorState.dimension,
        layers: scaledLayers,
        templateActionType: 'SET_TEMPLATE_GENERATED_DATA',
        autoSelectFirstLayer: true,
        psds: [],
      } as any)

      handleConversationMessagesAndTrackEvent(templateUrl)
      return
    }

    // Save the time users start creating a template
    if (!localStorage?.getItem('TLK_CREATING_TEMPLATE_START_AT')) {
      localStorage?.setItem('TLK_CREATING_TEMPLATE_START_AT', Date.now().toString())
    }
    handleConversationMessagesAndTrackEvent(templateUrl)
    handleNavigate(templateUrl)
  }, [
    currentConversation.id,
    dimension,
    disabled,
    isTemplateModal,
    loading,
    name,
    reversedLayers,
    template,
    initTemplate,
    onUseTemplate,
    handleConversationMessagesAndTrackEvent,
    handleNavigate,
    scaleLayersToFitCanvas,
  ])

  // If no template data, show skeleton
  if (!template || loading) {
    return <TemplatePreviewCardSkeleton />
  }

  return (
    <Card>
      <BlockStack gap="200">
        {/* Template Title */}
        <Text variant="bodyMd" as="h3" fontWeight="semibold">
          {t(ctaButton?.text || 'create-template')}
        </Text>

        {/* Template Details */}
        <List type="bullet">
          <List.Item>
            <Text as="span" variant="bodyMd">
              {t('template-title-name', { name })}
            </Text>
          </List.Item>

          {template.dimension && (
            <List.Item>{t('dimensions-width-x-height-measurementunit', { ...dimension })}</List.Item>
          )}
        </List>

        <Box background="bg-surface-secondary" borderRadius="200" padding="400">
          <div
            style={{
              width: 'calc(var(--chat-bot-drawer-width) - 126px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt={name} width={'100%'} height={'100%'} />
            ) : (
              <TemplatePreviewCardWithCanvas template={template} />
            )}
          </div>
        </Box>

        {/* Action Button */}
        <Button
          variant="primary"
          size="large"
          fullWidth
          onClick={handleUseTemplate}
          loading={loading}
          disabled={disabled}
        >
          {loading ? t('processing') : t(ctaButton?.text || 'create-template')}
        </Button>
      </BlockStack>
    </Card>
  )
})

function TemplatePreviewCardWithCanvas({ template }: { template: TemplateData }) {
  const { layers, dimension } = template || ({} as TemplateData)

  const stageRef = useRef<Konva.Stage>(null)
  const layerStoresRef = useRef<TLayerStore[] | null>(null)
  const createdStoreIdsRef = useRef<string[]>([])
  const [layerStoresReady, setLayerStoresReady] = useState(false)

  const boundingBox = useMemo(
    () => ({
      x: 0,
      y: 0,
      width: dimension?.width ?? 0,
      height: dimension?.height ?? 0,
    }),
    [dimension?.width, dimension?.height]
  )

  useEffect(() => {
    // Reset when incoming template changes so we can rebuild layer stores
    layerStoresRef.current = null
    setLayerStoresReady(false)
  }, [template])

  useEffect(() => {
    if (!layers || !layers.length) return

    let isDisposed = false

    // Mark not ready while rebuilding to prevent stale preview
    setLayerStoresReady(false)

    // Clean up any previously created preview stores before rebuilding
    if (createdStoreIdsRef.current.length) {
      deleteLayerStores(createdStoreIdsRef.current)
      createdStoreIdsRef.current = []
    }

    const stores: TLayerStore[] = layers.map((layer: Partial<LayerDocument>) => {
      // Create ephemeral preview stores with fresh IDs to avoid collisions
      const clonedLayer = { ...(layer as LayerDocument), _id: uuid() }
      return createLayerStore(clonedLayer as LayerDocument)
    })

    if (!isDisposed) {
      layerStoresRef.current = stores
      createdStoreIdsRef.current = stores.map(s => s.getState()._id)
      setLayerStoresReady(true)
    }

    // Cleanup on unmount or when layers change
    return () => {
      isDisposed = true
      if (createdStoreIdsRef.current.length) {
        deleteLayerStores(createdStoreIdsRef.current)
        createdStoreIdsRef.current = []
      }
      layerStoresRef.current = null
    }
  }, [layers])

  if (!layerStoresReady) {
    return <TemplatePreviewCardSkeleton />
  }

  return (
    <ClipartCanvas
      boundingBox={boundingBox}
      layersStore={layerStoresRef.current || []}
      stageRef={stageRef}
      fitToContainer
    />
  )
}

/**
 * Loading skeleton for TemplatePreviewCard
 */
export function TemplatePreviewCardSkeleton() {
  return (
    <Card>
      <BlockStack gap="400">
        <SkeletonDisplayText size="small" />
        <SkeletonBodyText lines={4} />
        <div style={{ height: '200px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
          <SkeletonBodyText lines={6} />
        </div>
        <div style={{ height: '36px', backgroundColor: '#f6f6f7', borderRadius: '6px' }}>
          <SkeletonBodyText lines={1} />
        </div>
      </BlockStack>
    </Card>
  )
}
