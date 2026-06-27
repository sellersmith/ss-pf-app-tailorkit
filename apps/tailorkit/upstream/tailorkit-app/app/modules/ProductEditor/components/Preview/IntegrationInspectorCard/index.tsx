import { useMemo, useCallback } from 'react'
import { InspectorCard } from '~/modules/TemplateEditor/components/Preview/components/Inspector'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useStore } from '~/libs/external-store'
import type { Layer } from '~/types/psd'
import { useTemplateLayerStores } from '../contexts/TemplateLayerStoresContext'
import ViewsBar from '../../HeaderBar/ViewsBar.client'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { getTemplateTitle } from '~/modules/ProductEditor/components/Canvas/components/PrintAreasBar/utils/generateDefaultTemplateName'
import { getViewLayerIntegrationStoreByIds } from '~/stores/modules/integration/viewLayerIntegration'

interface IInspectorCardProps {
  previewMode?: boolean
  /** When false, suppresses hidden-elements and sales-tools banners. Defaults to true. */
  showInfoBanner?: boolean
  /** Render ViewsBar between heading/divider and scrollable options (for Mockup tab desktop). */
  showViewsBar?: boolean
}

const IntegrationInspectorCard = (props: IInspectorCardProps) => {
  const { previewMode, showInfoBanner = true, showViewsBar } = props
  const { mockupId } = useEditorParams()

  // Read LIVE variants from IntegrationStore (same source as provider!)
  const allVariants = useStore(IntegrationStore, state => state.variants)
  const variants = useMemo(
    () =>
      allVariants.filter(v => {
        const id = typeof (v as any).mockup === 'string' ? (v as any).mockup : (v as any).mockup?._id
        return id === mockupId
      }),
    [allVariants, mockupId]
  )

  const { getTemplateLayerStores } = useTemplateLayerStores()

  const printAreaLayerStores = useMemo(() => {
    if (!variants?.length) return []

    const firstVariant = variants[0]
    const printAreas = firstVariant?.printAreas || []
    const productTitle = firstVariant?.product?.title
    const variantTitle = firstVariant?.title
    const mockup = firstVariant?.mockup as any
    const layerIntegrations = mockup?.layers || []
    const views = mockup?.views || []

    // Get current viewId from mockup state (may be undefined if not using views)
    const viewId: string | undefined = mockup?.selectedViewId || mockup?.views?.[0]?._id

    // Count total unique print areas visible across ALL views
    // This matches customizer.ts behavior: querySelectorAll counts all summaries on DOM
    const uniqueVisiblePrintAreaIds = new Set<string>()

    if (views.length > 0) {
      // Check visibility in each view
      views.forEach((view: any) => {
        const viewOverrides = view?.overrides || {}

        printAreas.forEach(printArea => {
          if (!printArea.template) return

          // Find template layer integration for this print area
          const templateLayerIntegration = layerIntegrations.find((li: any) => {
            const liState = li.getState()
            return liState.printAreaId === printArea._id && liState.type === 'template'
          })

          if (!templateLayerIntegration) return

          // Check base visibility
          const liState = templateLayerIntegration.getState()
          let isVisible = liState.visible !== false

          // Check view override
          if (viewOverrides[liState._id] && 'visible' in viewOverrides[liState._id]) {
            isVisible = viewOverrides[liState._id].visible !== false
          }

          // Add to set if visible in this view
          if (isVisible) {
            uniqueVisiblePrintAreaIds.add(printArea._id)
          }
        })
      })
    } else {
      // No views: check base visibility only
      printAreas.forEach(printArea => {
        if (!printArea.template) return

        const templateLayerIntegration = layerIntegrations.find((li: any) => {
          const liState = li.getState()
          return liState.printAreaId === printArea._id && liState.type === 'template'
        })

        if (!templateLayerIntegration) return

        const liState = templateLayerIntegration.getState()
        if (liState.visible !== false) {
          uniqueVisiblePrintAreaIds.add(printArea._id)
        }
      })
    }

    // Build visible areas for current view
    const visibleAreas = printAreas
      .filter(printArea => printArea.template)
      .map(printArea => {
        const templateId = typeof printArea.template === 'string' ? printArea.template : printArea.template?._id
        if (!templateId) return null

        // Find the template layer integration for this print area
        // This is the layer integration that contains the template and controls option visibility
        const templateLayerIntegration = layerIntegrations.find((li: any) => {
          const liState = li.getState()
          return liState.printAreaId === printArea._id && liState.type === 'template'
        })

        if (!templateLayerIntegration) {
          return null
        }

        // Check visibility of the template layer integration
        const liState = templateLayerIntegration.getState()

        if (showViewsBar && views.length > 1) {
          // Mockup preview panel with multiple views: show print areas visible in ANY view
          // (matches storefront behavior where all option sets are always visible).
          // Auto-switch view on interaction is handled by onGroupInteract.
          if (!uniqueVisiblePrintAreaIds.has(printArea._id)) {
            return null
          }
        } else {
          // Default: check visibility in current view only
          let isTemplateVisible = liState.visible !== false
          if (viewId) {
            const viewLayerStore = getViewLayerIntegrationStoreByIds(mockup._id, viewId, liState._id)
            isTemplateVisible = viewLayerStore.getState().visible !== false
          }
          if (!isTemplateVisible) {
            return null
          }
        }

        // Get layer stores from context (template layers for rendering options)
        const layerStores = getTemplateLayerStores(templateId, printArea._id)

        // Filter by template layer visibility (for option set display)
        const filteredStores = layerStores.filter(layerStore => {
          const layerState = layerStore.getState() as Layer
          return layerState.visible
        })

        // Use template name directly if exists (source of truth), otherwise use getTemplateTitle for display
        // This ensures edited template names (without prefix) are displayed correctly
        const template = typeof printArea.template === 'object' ? printArea.template : null
        const templateName = template?.name || ''
        const displayName
          = templateName || getTemplateTitle(printArea, productTitle, variantTitle) || printArea.name || 'Unnamed Area'

        return {
          groupId: printArea._id,
          groupName: displayName,
          layerStores: filteredStores,
          allLayerStores: layerStores,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    // Hide accordion title only when total unique print areas across ALL views = 1
    // customizer.ts: hides summary when summaries.length === 1 (counts all summaries on DOM)
    const shouldHideGroupName = uniqueVisiblePrintAreaIds.size === 1

    return visibleAreas.map(area => ({
      ...area,
      groupName: shouldHideGroupName ? undefined : area.groupName,
    }))
  }, [variants, getTemplateLayerStores, showViewsBar])

  // Map printAreaId → viewIds where that print area is visible.
  // Used by onGroupInteract to auto-switch view when user interacts with option sets from another view.
  // Uses getViewLayerIntegrationStoreByIds (per-view layer stores) for accurate visibility —
  // view.overrides may not reflect actual state since overrides live in separate stores.
  const printAreaViewMap = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!variants?.length) return map

    const firstVariant = variants[0]
    const mockup = firstVariant?.mockup as any
    const views = mockup?.views || []
    const printAreas = firstVariant?.printAreas || []
    const layerIntegrations = mockup?.layers || []

    if (views.length <= 1) return map

    views.forEach((view: any) => {
      printAreas.forEach((printArea: any) => {
        if (!printArea.template) return

        const templateLayerIntegration = layerIntegrations.find((li: any) => {
          const liState = li.getState()
          return liState.printAreaId === printArea._id && liState.type === 'template'
        })
        if (!templateLayerIntegration) return

        const liState = templateLayerIntegration.getState()

        // Check visibility using per-view layer integration store (same source as canvas rendering)
        const viewLayerStore = getViewLayerIntegrationStoreByIds(mockup._id, view._id, liState._id)
        const isVisible = viewLayerStore.getState().visible !== false

        if (isVisible) {
          const existing = map.get(printArea._id) || []
          existing.push(view._id)
          map.set(printArea._id, existing)
        }
      })
    })

    return map
  }, [variants])

  // Auto-switch view when user interacts with option sets for a print area visible in a different view
  const handleGroupInteract = useCallback(
    (groupId: string) => {
      if (!variants?.length) return
      const mockup = variants[0]?.mockup as any
      const currentViewId = mockup?.selectedViewId || mockup?.views?.[0]?._id
      if (!currentViewId || !mockup?._id) return

      const viewsForPrintArea = printAreaViewMap.get(groupId)
      if (!viewsForPrintArea || viewsForPrintArea.length === 0) return

      // If current view already shows this print area, no switch needed
      if (viewsForPrintArea.includes(currentViewId)) return

      // Switch to the first view that shows this print area
      const targetViewId = viewsForPrintArea[0]
      IntegrationStore.dispatch({
        type: 'SET_SELECTED_VIEW',
        payload: { mockupId: mockup._id, viewId: targetViewId },
        skipTrace: true,
      })
    },
    [variants, printAreaViewMap]
  )

  // Key for ViewsBar: forces remount when views count or storefront label changes.
  // The Preact web component needs a fresh connectedCallback to pick up new data.
  const viewsBarKey = useMemo(() => {
    if (!variants?.length) return 'no-variants'
    const mockup = variants[0]?.mockup as any
    const viewCount = Array.isArray(mockup?.views) ? mockup.views.length : 0
    const label = mockup?.storefrontLabel || ''
    const viewIds = Array.isArray(mockup?.views) ? mockup.views.map((v: any) => v._id).join(',') : ''
    return `vb-${viewCount}-${label}-${viewIds}`
  }, [variants])

  return (
    <InspectorCard
      previewMode={previewMode}
      layerStoreGroups={printAreaLayerStores}
      showInfoBanner={showInfoBanner}
      onGroupInteract={showViewsBar ? handleGroupInteract : undefined}
      afterHeadingContent={
        showViewsBar ? (
          <div key={viewsBarKey} style={{ padding: 'var(--p-space-200)', paddingBottom: 0 }}>
            <ViewsBar />
          </div>
        ) : undefined
      }
      prependContent={
        !showViewsBar ? (
          <div key={viewsBarKey} style={{ padding: 'var(--p-space-200)', paddingBottom: 0 }}>
            <ViewsBar />
          </div>
        ) : undefined
      }
    />
  )
}

export default IntegrationInspectorCard
