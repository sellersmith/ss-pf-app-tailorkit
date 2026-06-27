import { type ILayerStoreGroup } from './Personalized'
import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import PersonalizedWithGlobalStyling from '~/components/GlobalStyling/PersonalizedWithGlobalStyling'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { collectCustomizationItems, resolveLegacyItemIndex, type CollectorLayer } from '~/shared/customization-items'

interface IInspectorCardProps {
  previewMode?: boolean
  layerStoreGroups: ILayerStoreGroup[]
  templateName?: ReactNode
  prependContent?: ReactNode
  /** Content rendered between heading/divider and scrollable area (for web components like ViewsBar) */
  afterHeadingContent?: ReactNode
  customHeight?: string
  showInfoBanner?: boolean
  /** Hide the PERSONALIZED DESIGN heading and divider (caller renders them externally). */
  hiddenTitle?: boolean
  /** Controlled accordion mode: only this groupId is expanded */
  expandedGroupId?: string
  /** Called when user clicks an accordion header */
  onGroupClick?: (groupId: string) => void
  /** Called when user interacts with option sets inside a group (for auto-switching mockup views) */
  onGroupInteract?: (groupId: string) => void
}

export const InspectorCard = (props: IInspectorCardProps) => {
  const {
    previewMode,
    layerStoreGroups,
    templateName,
    prependContent,
    afterHeadingContent,
    customHeight,
    showInfoBanner = false,
    hiddenTitle,
    expandedGroupId,
    onGroupClick,
    onGroupInteract,
  } = props

  // Lazy-load wizard web component registration (SSR-safe, same pattern as registerOptionSetElements)
  useEffect(() => {
    import('extensions/tailorkit-src/src/assets/components/wizard')
  }, [])

  // Read wizard config from template store — if enabled, wrap preview with <tailorkit-wizard>
  const wizardConfig = useStore(TemplateEditorStore, state => state.wizardConfig)

  // Remap elementIndex to match the preview DOM order (preview renders extractedLayerStores,
  // but wizard config indices were assigned from ALL layers via getAllLayerStore)
  const remappedWizardConfig = useMemo(() => {
    if (!wizardConfig?.enabled || !wizardConfig.steps?.some(s => s.items.length > 0)) return null

    // Collect items from the layers actually rendered in preview
    const previewLayers = layerStoreGroups.flatMap(g => g.layerStores.map(s => s.getState() as CollectorLayer))
    const previewItems = collectCustomizationItems(previewLayers)
    const itemIdToIndex = new Map(previewItems.map((item, i) => [item.id, i]))

    const steps = wizardConfig.steps
      .map(step => {
        const items = step.items
          .map(item => {
            const direct = itemIdToIndex.get(item.itemId)
            const idx = direct ?? resolveLegacyItemIndex(item.itemId, previewItems)
            if (idx === undefined) return null
            // Pass the CURRENT itemId so wizard's ID-based DOM matching finds the
            // element. When falling back from a legacy id, swap to the resolved
            // item's id so admin preview's data-item-id matches.
            const resolvedItemId = direct !== undefined ? item.itemId : previewItems[idx].id
            return { elementIndex: idx, itemId: resolvedItemId }
          })
          .filter((item): item is { elementIndex: number; itemId: string } => item !== null)
        return items.length > 0 ? { id: step.id, label: step.label, items } : null
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    return steps.length > 0 ? { enabled: true, steps } : null
  }, [wizardConfig, layerStoreGroups])

  const wizardReady = remappedWizardConfig !== null
  const wizardConfigJson = useMemo(
    () => (wizardReady ? JSON.stringify(remappedWizardConfig) : ''),
    [wizardReady, remappedWizardConfig]
  )

  const personalizedContent = (
    <PersonalizedWithGlobalStyling
      previewMode={previewMode}
      layerStoreGroups={layerStoreGroups}
      customHeight={customHeight}
      showInfoBanner={showInfoBanner}
      hiddenTitle={hiddenTitle}
      prependContent={prependContent}
      afterHeadingContent={afterHeadingContent}
      expandedGroupId={expandedGroupId}
      onGroupClick={onGroupClick}
      onGroupInteract={onGroupInteract}
    />
  )

  return (
    <div style={{ background: 'var(--p-color-bg-surface)', height: '100%' }}>
      <div
        style={{
          padding: 'var(--p-space-200)',
          paddingInlineStart: 'var(--p-space-200)',
          height: '100%',
        }}
      >
        {templateName}
        {wizardReady ? (
          // @ts-expect-error — tailorkit-wizard is a custom element, not a React component
          // key forces full remount when config or layer count changes
          <tailorkit-wizard
            key={`${wizardConfigJson}::${layerStoreGroups.length}`}
            data-wizard-config={wizardConfigJson}
          >
            {personalizedContent}
          </tailorkit-wizard>
        ) : (
          personalizedContent
        )}
      </div>
    </div>
  )
}
