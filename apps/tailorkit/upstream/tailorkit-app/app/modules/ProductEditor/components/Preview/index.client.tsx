import { SkeletonPage } from '@shopify/polaris'
import type { ReactNode } from 'react'
import { startTransition, useCallback, useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react'
import { TemplatesService } from '~/api/services/templates'
import { EMPTY_ARRAY } from '~/constants'
// Removed templateProcessingCache (always recompute for freshest data)
import { getLayerIntegrationStoresByMockupId, IntegrationStore } from '~/stores/modules/integration/integration'
import { ELayerType, EOptionSet, IMAGELESS_OPTION_TYPE, type Template } from '~/types/psd'
import { processBatch } from '~/utils/batchProcessor'
import { showGenericErrorToast } from '~/utils/toastEvents'
import type { WithVariantsProps } from '../../withMockup'
import withMockup from '../../withMockup'
import { TemplateLayerStoresProvider } from './contexts/TemplateLayerStoresContext'
import IntegrationInspectorCard from './IntegrationInspectorCard'
import { useStore } from '~/libs/external-store'

interface ITemplateLayerStoresProviderWrapperProps extends WithVariantsProps {
  children: ReactNode
  loadingComponent?: ReactNode
}

export interface PrintAreaTemplate {
  printAreaId: string
  printAreaName: string
  template: Template | undefined
}

// Provider wrapper that handles template processing and provides context
export const TemplateLayerStoresProviderWrapper = (props: ITemplateLayerStoresProviderWrapperProps) => {
  const { mockupId, children } = props

  // Always read freshest variants from IntegrationStore for this mockup
  const allVariants = useStore(IntegrationStore, state => state.variants)
  const variants = useMemo(
    () =>
      allVariants.filter(v => {
        const id = typeof (v as any).mockup === 'string' ? (v as any).mockup : (v as any).mockup?._id
        return id === mockupId
      }),
    [allVariants, mockupId]
  )

  const [printAreaTemplates, setPrintAreaTemplates] = useState<PrintAreaTemplate[]>([])
  const isProcessingRef = useRef(false)

  // No cache key – always recompute; number of templates is small

  const processMultiLayoutLayer = useCallback((layer: Template['layers'][number], printAreaId: string) => {
    try {
      const multiLayoutOptionSet = layer.optionSet?.find(optionSet => optionSet.type === EOptionSet.MULTI_LAYOUT_OPTION)

      if (!multiLayoutOptionSet) {
        return layer
      }

      const multiLayoutOptionSetData = multiLayoutOptionSet.data as any
      const layouts = multiLayoutOptionSetData.multi_layout?.layouts || []
      const newLayouts = layouts.map((layout: any) => ({
        ...layout,
        layerIds: layout.layerIds.map((id: string) => `${printAreaId}_${id}`),
      }))

      return {
        ...layer,
        optionSet: layer.optionSet?.map(optionSet => ({
          ...optionSet,
          data: { ...optionSet.data, multi_layout: { ...multiLayoutOptionSetData, layouts: newLayouts } },
        })),
      }
    } catch (e) {
      console.error('Error processing multi layout layer:', e)
      return layer
    }
  }, [])

  const processImagelessLayer = useCallback((layer: Template['layers'][number], printAreaId: string) => {
    try {
      const imagelessOptionSet = layer.optionSet?.find(optionSet => optionSet.type === EOptionSet.IMAGELESS_OPTION)

      if (!imagelessOptionSet) {
        return layer
      }

      const imagelessOptionSetData = imagelessOptionSet.data as any
      const imagelessOptionSetDataValue = imagelessOptionSetData[IMAGELESS_OPTION_TYPE] || []

      return {
        ...layer,
        optionSet: layer.optionSet?.map(optionSet => ({
          ...optionSet,
          data: {
            ...optionSet.data,
            [IMAGELESS_OPTION_TYPE]: imagelessOptionSetDataValue.map((item: any) => ({
              ...item,
            })),
          },
        })),
      }
    } catch (e) {
      console.error('Error processing imageless layer:', e)
      return layer
    }
  }, [])

  const processConditionalLogic = useCallback((layer: Template['layers'][number], printAreaId: string) => {
    try {
      const isControlledBy = (layer.conditionalLogic?.isControlledBy || []).map(id => `${printAreaId}_${id}`)
      const controls: any = layer.conditionalLogic?.controls || {}
      const conditions = (controls.conditions || []).map((condition: any) => ({
        ...condition,
        thenShowOrHideLayers: (condition.thenShowOrHideLayers || []).map((id: string) => `${printAreaId}_${id}`),
      }))

      return {
        ...(layer.conditionalLogic || {}),
        isControlledBy,
        controls: {
          ...controls,
          conditions,
        },
      }
    } catch (e) {
      console.error('Error processing conditional logic:', e)
      return layer?.conditionalLogic
    }
  }, [])

  const processTemplate = useCallback(
    (template: Template, printAreaId: string) => {
      return {
        ...template,
        layers: (template.layers || EMPTY_ARRAY)
          .filter(layer => layer.visible)
          .map(layer => {
            const _layer = {
              ...layer,
              _id: `${printAreaId}_${layer._id}`,
              parent: layer.parent ? `${printAreaId}_${layer.parent}` : '',
              children: layer.children ? layer.children.map(child => `${printAreaId}_${child}`) : [],
              conditionalLogic: processConditionalLogic(layer, printAreaId),
            }

            const isMultiLayoutLayer = layer.type === ELayerType.MULTI_LAYOUT

            if (isMultiLayoutLayer) {
              return processMultiLayoutLayer(_layer, printAreaId)
            }

            const isImagelessLayer = layer.type === ELayerType.IMAGELESS
            if (isImagelessLayer) {
              return processImagelessLayer(_layer, printAreaId)
            }

            return _layer
          }),
      }
    },
    [processConditionalLogic, processImagelessLayer, processMultiLayoutLayer]
  )

  const fetchTemplates = useCallback(async () => {
    const printAreas = variants[0]?.printAreas || []
    if (!printAreas.length) {
      return []
    }

    try {
      const inMemoryTemplates: Template[] = []
      const dbTemplateIds: string[] = []

      // Separate in-memory templates (from unified editor) vs DB template IDs
      printAreas.forEach(printArea => {
        const template = printArea.template
        if (!template) return

        if (typeof template === 'object') {
          // In-memory template (full object from unified editor)
          inMemoryTemplates.push(template)
        } else if (typeof template === 'string') {
          // Template ID that needs to be fetched from DB
          dbTemplateIds.push(template)
        }
      })

      // Fetch only missing templates from database
      let dbTemplates: Template[] = []
      if (dbTemplateIds.length > 0) {
        const res = await TemplatesService.getByIds(dbTemplateIds)
        if (!res?.length) {
          throw new Error('Failed to fetch templates from database')
        }
        dbTemplates = res
      }

      // Merge both sources: in-memory (unsaved) + database (saved)
      const allTemplates = [...inMemoryTemplates, ...dbTemplates]

      return allTemplates
    } catch (e) {
      showGenericErrorToast()
      return []
    }
  }, [variants])

  const processTemplatesData = useCallback(async () => {
    // Prevent concurrent processing
    if (isProcessingRef.current) return

    try {
      isProcessingRef.current = true
      const templates = await fetchTemplates()

      if (!variants[0]?.printAreas || !templates.length) {
        startTransition(() => {
          setPrintAreaTemplates([])
        })
        return
      }

      const printAreas = (variants?.[0]?.printAreas ?? EMPTY_ARRAY).filter(printArea => printArea.template)
      const templateMap = new Map(templates.map((template: any) => [template._id, template]))

      const layerIntegrationsStores = getLayerIntegrationStoresByMockupId(mockupId)
      const layerIntegrationsVisible = layerIntegrationsStores
        .map(store => store.getState())
        .filter(state => state.visible)

      const layerIntegrationsVisibleMap = new Map(layerIntegrationsVisible.map(li => [li.printAreaId, li]))

      // Filter visible print areas upfront to avoid unnecessary processing
      const visiblePrintAreas = printAreas.filter(printArea => layerIntegrationsVisibleMap.has(printArea._id))

      // Prepare items for batch processing
      interface ProcessingItem {
        printArea: (typeof printAreas)[0]
        templateId: string
        baseTemplate: Template
      }

      const itemsToProcess: ProcessingItem[] = visiblePrintAreas
        .map(printArea => {
          const templateId = typeof printArea.template === 'string' ? printArea.template : printArea.template?._id
          const baseTemplate = templateMap.get(templateId) as Template

          if (!baseTemplate) return null

          return {
            printArea,
            templateId,
            baseTemplate,
          }
        })
        .filter(Boolean) as ProcessingItem[]

      const processedResults = await processBatch(
        itemsToProcess,
        (item: ProcessingItem) => {
          const { printArea, baseTemplate } = item

          // Always process fresh (no cache)
          const processedTemplate = processTemplate(baseTemplate, printArea._id) as Template

          return {
            printAreaId: printArea._id,
            printAreaName: printArea.name,
            template: processedTemplate,
          }
        },
        {
          batchSize: 5, // Process 5 templates at a time
          useIdleCallback: true, // Use idle time to avoid blocking UI
        }
      )

      // Update state in a transition to mark as non-urgent
      startTransition(() => {
        setPrintAreaTemplates(processedResults as PrintAreaTemplate[])
        isProcessingRef.current = false
      })
    } catch (error) {
      console.error('Error processing templates:', error)
      startTransition(() => {
        setPrintAreaTemplates([])
        isProcessingRef.current = false
      })
      showGenericErrorToast()
    }
  }, [fetchTemplates, variants, processTemplate, mockupId])

  useEffect(() => {
    processTemplatesData()
  }, [processTemplatesData])

  // Initialize web components once
  useLayoutEffect(() => {
    import('extensions/tailorkit-src/src/shared/components/registerOptionSetElements').catch(e => {
      console.error('Error importing registerOptionSetElements:', e)
    })
  }, [])

  // Disable loading component for unified editor
  // if (isInitializingWebComponent || isLoading) {
  //   return loadingComponent ?? <SkeletonPage fullWidth primaryAction />
  // }

  return <TemplateLayerStoresProvider printAreaTemplates={printAreaTemplates}>{children}</TemplateLayerStoresProvider>
}

// Preview wrapper that provides live template layer stores
interface IPreviewIntegrationProps extends WithVariantsProps {}

const PreviewIntegration = (props: IPreviewIntegrationProps) => {
  const { mockupId, variants } = props

  return (
    <TemplateLayerStoresProviderWrapper mockupId={mockupId} variants={variants} loadingComponent={<SkeletonPage />}>
      <IntegrationInspectorCard previewMode={true} />
    </TemplateLayerStoresProviderWrapper>
  )
}

export default withMockup(PreviewIntegration)
