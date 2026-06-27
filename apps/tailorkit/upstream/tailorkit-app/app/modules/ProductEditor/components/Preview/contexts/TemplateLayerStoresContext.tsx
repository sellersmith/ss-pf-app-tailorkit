import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore } from '~/stores/modules/layer'
import { checkLayerInsideMultiLayout } from '~/modules/TemplateEditor/elements/fns'
import type { LayerDocument } from '~/models/Layer.server'
import type { Template } from '~/types/psd'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useStore } from '~/libs/external-store'

interface ITemplateLayerStoresContext {
  templateLayerStoresMap: Map<string, TLayerStore[]>
  getTemplateLayerStores: (templateId: string, printAreaId: string) => TLayerStore[]
}

export const TemplateLayerStoresContext = createContext<ITemplateLayerStoresContext | null>(null)

// Represents a template together with the print-area it belongs to. The
// print area name will be used as a prefix to generate unique layer IDs so
// that the same template reused across multiple print areas does not clash.
interface PrintAreaTemplate {
  printAreaId: string
  printAreaName: string
  template: Template | undefined
}

interface ITemplateLayerStoresProviderProps {
  children: ReactNode
  /**
   * A list of templates together with the print-area they are rendered in.
   * The provider uses the printAreaName to create unique layer IDs so that
   * selection in the inspector matches what is rendered on the canvas.
   */
  printAreaTemplates: PrintAreaTemplate[]
}

/**
 * Provider for managing template layer stores for live rendering
 * Creates and caches layer stores for each template to enable instant option updates
 */
export function TemplateLayerStoresProvider(props: ITemplateLayerStoresProviderProps) {
  const { children, printAreaTemplates } = props

  // Get live layer stores from TemplateEditorStore (for currently active template)
  const activeTemplateId = useStore(TemplateEditorStore, state => state._id)
  const activeLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)

  const templateLayerStoresMap = useMemo(() => {
    // key: `${printAreaId}_${templateId}`
    // value: array of layer stores
    const map = new Map<string, TLayerStore[]>()

    printAreaTemplates.forEach(({ printAreaId, template }) => {
      if (!template) {
        return
      }

      if (!template.layers?.length) {
        if (!map.has(`${printAreaId}_${template._id}`)) map.set(`${printAreaId}_${template._id}`, [])
        return
      }

      // CRITICAL: If this is the active template in TemplateEditorStore, use its LIVE layer stores
      // This ensures real-time updates when editing in Design tab are reflected in Preview tab
      if (template._id === activeTemplateId && activeLayerStores.length > 0) {
        // Filter out layers inside multi-layout
        const filteredStores = activeLayerStores.filter(layerStore => {
          const layerState = layerStore.getState() as LayerDocument
          const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(layerState as any, template.layers as any[])
          return !isLayerInsideMultiLayout
        })

        map.set(`${printAreaId}_${template._id}`, filteredStores)
        return
      }

      // For other templates (not currently being edited), create new stores from serialized data
      const layerStores = template.layers.map(layer => createLayerStore(layer))

      // Filter out layers inside multi-layout (handled separately)
      const filteredStores = layerStores.filter(layerStore => {
        const layerState = layerStore.getState() as LayerDocument
        const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(layerState as any, template.layers as any[])

        return !isLayerInsideMultiLayout
      })

      // Merge with any existing stores for this template (may appear in
      // multiple print areas).
      const existing = map.get(`${printAreaId}_${template._id}`) || []
      map.set(`${printAreaId}_${template._id}`, [...existing, ...filteredStores])
    })

    return map
  }, [printAreaTemplates, activeTemplateId, activeLayerStores])

  const getTemplateLayerStores = useMemo(() => {
    return (templateId: string, printAreaId: string): TLayerStore[] => {
      return templateLayerStoresMap.get(`${printAreaId}_${templateId}`) || []
    }
  }, [templateLayerStoresMap])

  const contextValue = useMemo(
    () => ({
      templateLayerStoresMap,
      getTemplateLayerStores,
    }),
    [templateLayerStoresMap, getTemplateLayerStores]
  )

  return <TemplateLayerStoresContext.Provider value={contextValue}>{children}</TemplateLayerStoresContext.Provider>
}

/**
 * Hook to access template layer stores context
 */
export function useTemplateLayerStores() {
  const context = useContext(TemplateLayerStoresContext)

  if (!context) {
    throw new Error('useTemplateLayerStores must be used within TemplateLayerStoresProvider')
  }

  return context
}
