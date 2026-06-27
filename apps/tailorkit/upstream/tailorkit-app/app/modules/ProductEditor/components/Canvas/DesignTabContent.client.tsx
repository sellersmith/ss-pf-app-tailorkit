import { useMemo } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import TemplateEditorLayout from '~/modules/TemplateEditor/components/Layout/TemplateEditorLayout'
import { useDesignTabEditor } from './hooks'
import { useEditorParams } from '../../hooks/useEditorParams'

/**
 * Design Tab Content - Embeds Template Editor within Product Editor
 *
 * This component renders the full Template Editor layout when the "Design" tab
 * is active in the unified Product Editor. It bridges the gap between the
 * Integration (Product) context and Template editing context.
 *
 * **Key Responsibilities:**
 * - Initialize Template Editor from the active print area's template
 * - Automatically set default printAreaId if not present in URL
 * - Provide full Template Editor layout (sidebar, canvas, tools)
 * - Maintain URL-driven state synchronization
 *
 * **Data Flow:**
 * 1. Read `mockupId` and `printAreaId` from external store
 * 2. Find the corresponding print area in IntegrationStore
 * 3. Initialize TemplateEditorStore with the print area's template
 * 4. Render TemplateEditorLayout which includes all editor features
 *
 * **URL Parameters:**
 * - `mockup`: The active mockup/variant ID
 * - `printAreaId`: The print area being edited (auto-set if missing)
 * - `templateId`: Optional, derived from print area
 *
 * @example
 * URL: /personalized-products/123?tab=design&mockup=abc&printAreaId=xyz
 * Renders: Full Template Editor for print area xyz's template
 */
export default function DesignTabContent() {
  const { mockupId, printAreaId, templateId } = useEditorParams()
  const variants = useStore(IntegrationStore, state => state.variants)

  // Find active variant and print area
  const { activeVariant, targetPrintArea, targetViewId, shouldSetPrintAreaFromTemplate } = useMemo(() => {
    const activeVariant = variants.find(v => v.mockup._id === mockupId) || variants[0]
    if (!activeVariant) {
      return {
        activeVariant: null,
        targetPrintArea: null,
        targetViewId: null,
        shouldSetPrintAreaFromTemplate: false,
      }
    }

    // Use selectedViewId from store instead of URL
    const selectedViewId = activeVariant.mockup?.selectedViewId
    const targetView
      = activeVariant.mockup?.views?.find(v => v._id === selectedViewId) || activeVariant.mockup?.views?.[0] || null
    if (!targetView) {
      return {
        activeVariant: null,
        targetPrintArea: null,
        targetViewId: null,
        shouldSetPrintAreaFromTemplate: false,
      }
    }

    // If printAreaId is provided, use it directly
    if (printAreaId) {
      const targetPrintArea = activeVariant.printAreas?.find(pa => pa._id === printAreaId)
      return {
        activeVariant,
        targetPrintArea,
        targetViewId: targetView._id,
        shouldSetPrintAreaFromTemplate: false,
      }
    }

    // If templateId is provided but no printAreaId, find the print area with this template
    if (templateId) {
      const printAreaWithTemplate = activeVariant.printAreas?.find(pa => (pa.template as any)?._id === templateId)
      if (printAreaWithTemplate) {
        return {
          activeVariant,
          targetPrintArea: printAreaWithTemplate,
          targetViewId: targetView._id,
          shouldSetPrintAreaFromTemplate: true,
        }
      }
    }

    // Fallback: use first print area
    const firstPrintArea = activeVariant.printAreas?.[0]
    return {
      activeVariant,
      targetPrintArea: firstPrintArea,
      targetViewId: targetView._id,
      shouldSetPrintAreaFromTemplate: !printAreaId && !!firstPrintArea,
    }
  }, [variants, mockupId, printAreaId, templateId])

  // Initialize and manage all design tab editor behavior with a single composable hook
  useDesignTabEditor({
    mockupId,
    printAreaId,
    templateId,
    targetPrintArea,
    viewId: targetViewId || '',
    shouldSetPrintAreaFromTemplate,
    shouldSetViewId: false, // No longer setting viewId in URL
    activeVariant,
  })

  if (!activeVariant) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--p-color-bg-surface)',
          borderRadius: 'var(--p-border-radius-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading editor…
      </div>
    )
  }

  return <TemplateEditorLayout />
}
