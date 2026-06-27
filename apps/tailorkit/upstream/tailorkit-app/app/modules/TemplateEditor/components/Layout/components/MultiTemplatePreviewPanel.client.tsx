/**
 * Multi-template preview panel for the right column of the desktop editor.
 *
 * Renders option sets for ALL print areas via InspectorCard — the same component
 * used by the old Preview tab. Each print area becomes an AccordionCustomized section
 * with its template name as the header.
 *
 * - Standalone template editor (no product context): falls back to PreviewInspector
 * - Single print area: no accordion headers (groupName hidden)
 * - Multiple print areas: AccordionCustomized headers per print area
 *
 * Active print area uses live TemplateEditorStore (reactive to canvas changes).
 * Inactive print areas build layer stores from template data on the variant.
 */
import { useCallback, useMemo } from 'react'
import { clearAllSelectedLayerStores } from '~/stores/modules/layer-store-selection'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { TemplateEditorStore } from '~/stores/modules/template'
import { createLayerStore, type TLayerStore } from '~/stores/modules/layer'
import { checkLayerInsideMultiLayout } from '~/modules/TemplateEditor/elements/fns'
import { PreviewInspector } from '../../Preview/index.client'
import { InspectorCard } from '../../Preview/components/Inspector'
import type { ILayerStoreGroup } from '../../Preview/components/Inspector/Personalized'
import type { Template, Layer } from '~/types/psd'
import type { MockUp } from '~/types/integration'

/** Create layer stores from a serialized template object (for inactive print areas) */
function buildLayerStoresFromTemplate(template: Template | null): TLayerStore[] {
  if (!template?.layers?.length) return []
  const allLayers = template.layers as Layer[]
  return allLayers
    .map(layer => createLayerStore(layer))
    .filter(store => {
      const state = store.getState()
      const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(state, allLayers)
      return !isLayerInsideMultiLayout
    })
}

export default function MultiTemplatePreviewPanel() {
  const { t } = useTranslation()
  const { mockupId, printAreaId, setPrintAreaId } = useEditorParams()
  const variants = useStore(IntegrationStore, state => state.variants)
  const activeLayers = useStore(TemplateEditorStore, state => state.extractedLayerStores)

  // Build layerStoreGroups — same shape as IntegrationInspectorCard
  const layerStoreGroups = useMemo((): ILayerStoreGroup[] => {
    if (!mockupId || !variants?.length) return []

    const variant
      = variants.find(v => {
        const mockup = v.mockup as MockUp | string
        const id = typeof mockup === 'string' ? mockup : mockup?._id
        return id === mockupId
      }) || variants[0]

    if (!variant?.printAreas?.length) return []

    const groups = variant.printAreas
      .filter(pa => pa?.template)
      .map(printArea => {
        const paId = printArea._id
        const isActive = paId === printAreaId
        const template = typeof printArea.template === 'object' ? printArea.template : null
        const displayName = template?.name || printArea.name || t('unnamed-area')
        const layerStores: TLayerStore[] = isActive ? activeLayers : buildLayerStoresFromTemplate(template)

        return {
          groupId: paId,
          groupName: displayName,
          layerStores,
          allLayerStores: layerStores,
        } satisfies ILayerStoreGroup
      })

    // Single print area: hide accordion header (matches IntegrationInspectorCard)
    if (groups.length === 1) {
      return groups.map(g => ({ ...g, groupName: undefined }))
    }

    return groups
  }, [variants, mockupId, printAreaId, activeLayers, t])

  // Click handler: switch canvas to the clicked print area.
  // Clear layer selection first so the left panel resets to layers listing
  // (prevents showing stale inspector from the previous template).
  const handleGroupClick = useCallback(
    (groupId: string) => {
      clearAllSelectedLayerStores()
      setPrintAreaId(groupId)
    },
    [setPrintAreaId]
  )

  // Standalone mode or no print areas
  if (!mockupId || layerStoreGroups.length === 0) {
    return <PreviewInspector showInfoBanner={true} />
  }

  // Multiple print areas: controlled accordion — only active print area expanded
  const isMultiGroup = layerStoreGroups.length > 1

  // Pass all groups to InspectorCard — it renders heading, accordions, banners via
  // PersonalizedWithGlobalStyling → Personalized → AccordionCustomized.
  // For multi-group: expandedGroupId + onGroupClick enable one-at-a-time + click-to-switch.
  // previewMode={true}: this IS a preview context even though it renders on the Design tab.
  // Without this, useConditionalLogic gates visibility behind previewMode=true and all
  // conditionally-hidden layers would show as visible in the preview panel.
  return (
    <InspectorCard
      previewMode={true}
      layerStoreGroups={layerStoreGroups}
      showInfoBanner={true}
      expandedGroupId={isMultiGroup ? printAreaId : undefined}
      onGroupClick={isMultiGroup ? handleGroupClick : undefined}
    />
  )
}
