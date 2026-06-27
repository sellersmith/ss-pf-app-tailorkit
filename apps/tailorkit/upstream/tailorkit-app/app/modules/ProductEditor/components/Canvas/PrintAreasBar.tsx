import { useCallback, useMemo, useState } from 'react'
import { useStore } from '~/libs/external-store'
import { DEFAULT_PRINT_AREA, IntegrationStore } from '~/stores/modules/integration/integration'
import { FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'
import type { PrintArea, VariantIntegration } from '~/types/integration'
import { useEditorParams } from '../../hooks'
import useCreateTemplateForPrintArea from './components/PrintAreasBar/hooks/useCreateTemplateForPrintArea'
import { useTranslation } from 'react-i18next'
import { useCanvasSwitching } from '~/stores/modules/canvas-switching'
import { generateDefaultTemplateName } from './components/PrintAreasBar/utils/generateDefaultTemplateName'
import { getSelectedViewId } from '../../utils/views'
import useDevices from '~/utils/hooks/useDevice'
import type { TemporarySelectedTemplate } from './components/PrintAreasBar/hooks/usePrintAreaActions'
import { usePrintAreaActions } from './components/PrintAreasBar/hooks/usePrintAreaActions'
import { PrintAreasBarMobile } from './components/PrintAreasBar/PrintAreasBarMobile'
import { PrintAreasBarDesktop } from './components/PrintAreasBar/PrintAreasBarDesktop'
import CreateNewTemplateModal from './components/PrintAreasBar/CreateNewTemplateModal'
import SelectExistingTemplateModal from './components/PrintAreasBar/SelectExistingTemplateModal'
import DropZonePSDForPrintAreaComponent from './components/PrintAreasBar/DropZonePSDForPrintAreaComponent'
import type { Template } from '~/types/psd'
import { EDITOR_TABS } from '../../constants'

interface IPrintAreasBarProps {
  mockupId: string
  productTitle?: string
  variantTitle?: string
}

export default function PrintAreasBar(props: IPrintAreasBarProps) {
  const { mockupId, productTitle, variantTitle } = props
  const { printAreaId: currentPrintAreaId, updateParams, tab } = useEditorParams()
  const switchingToPrintAreaId = useCanvasSwitching()
  const [editingPrintArea, setEditingPrintArea] = useState<PrintArea | null>(null)
  const [deletingPrintAreaId, setDeletingPrintAreaId] = useState<string | null>(null)

  const { createTemplateForPrintArea } = useCreateTemplateForPrintArea()
  const { t } = useTranslation()
  const { isMobileView } = useDevices()

  // Subscribe to variants to trigger re-render on template changes
  const variants = useStore(IntegrationStore, state => state.variants)

  const { printAreas, isPODProduct, activeVariant, allPrintAreas } = useMemo(() => {
    if (!variants?.length) {
      return { printAreas: [], isPODProduct: false, activeVariant: null, allPrintAreas: [] }
    }

    const activeVariant = variants.find(v => v.mockup._id === mockupId) || variants[0]
    const printAreas = (activeVariant?.printAreas || []).map(pa => ({ ...pa, id: pa._id }))
    const vendor = activeVariant?.product?.vendor || ''
    const isPODProduct = FULFILLMENT_PROVIDERS.includes(vendor)
    // Get all print areas from all variants for checking template usage
    const allPrintAreas = variants.flatMap(v => v.printAreas || [])

    return { printAreas, isPODProduct, activeVariant, allPrintAreas }
  }, [variants, mockupId])

  // Use selectedViewId from store instead of URL
  const viewId = getSelectedViewId(activeVariant)

  // Default values for mobile template creation
  const defaultTemplateTitle = useMemo(
    () => generateDefaultTemplateName(productTitle, variantTitle, activeVariant?.printAreas || []),
    [productTitle, variantTitle, activeVariant?.printAreas]
  )

  // CRITICAL: For POD products, use first print area dimensions (from metafields)
  // For normal products, use featured image dimensions
  const firstPrintArea = printAreas[0]
  const defaultPrintAreaWidth
    = isPODProduct && firstPrintArea?.width
      ? firstPrintArea.width
      : activeVariant?.product?.featuredImage?.width || DEFAULT_PRINT_AREA.width
  const defaultPrintAreaHeight
    = isPODProduct && firstPrintArea?.height
      ? firstPrintArea.height
      : activeVariant?.product?.featuredImage?.height || DEFAULT_PRINT_AREA.height

  const defaultPrintArea = useMemo(
    () => ({ ...DEFAULT_PRINT_AREA, width: defaultPrintAreaWidth, height: defaultPrintAreaHeight }),
    [defaultPrintAreaWidth, defaultPrintAreaHeight]
  )

  // All business logic handlers
  const {
    psdUploading,
    temporarySelectedTemplate,
    handleSelectPrintArea,
    handleSortPrintAreas,
    handleConfirmDelete,
    handleSaveEditTemplate,
    onCreatePrintAreaWithNewTemplate,
    onSelectExistingTemplate,
    handleSelectTemporaryTemplate,
    onReplaceTemplateWithExistingTemplateInPrintArea,
    onReplaceTemplateWithPSDForPrintArea,
  } = usePrintAreaActions({
    mockupId,
    currentPrintAreaId,
    switchingToPrintAreaId,
    printAreas,
    activeVariant,
    productTitle,
    variantTitle,
    viewId,
    updateParams,
    createTemplateForPrintArea,
    t,
  })

  const handleEditPrintArea = useCallback(
    (printAreaId: string) => {
      const printArea = printAreas.find(pa => pa._id === printAreaId)
      if (printArea) {
        setEditingPrintArea(printArea)
      }
    },
    [printAreas]
  )
  const handleRemovePrintArea = useCallback((printAreaId: string) => {
    setDeletingPrintAreaId(printAreaId)
  }, [])

  const handleCancelDelete = useCallback(() => {
    setDeletingPrintAreaId(null)
  }, [])

  const handleCloseEditModal = useCallback(() => {
    setEditingPrintArea(null)
  }, [])

  const onSaveEdit = useCallback(
    async (
      printAreaId: string,
      data: { name: string; width: number; height: number },
      temporarySelectedTemplate?: TemporarySelectedTemplate
    ): Promise<void> => {
      const selectedTemplate = temporarySelectedTemplate?.template
      const source = temporarySelectedTemplate?.source
      const applyTemplateDimensionToPrintArea = temporarySelectedTemplate?.applyTemplateDimensionToPrintArea ?? true

      const _template = {
        ...selectedTemplate,
        name: data.name,
        dimension: {
          ...(selectedTemplate as Template)?.dimension,
          width: data.width,
          height: data.height,
        },
      } as Template

      if (selectedTemplate && source) {
        if (source === 'existing') {
          onReplaceTemplateWithExistingTemplateInPrintArea(
            printAreaId,
            _template,
            isPODProduct && applyTemplateDimensionToPrintArea
          )
        } else if (source === 'psd') {
          onReplaceTemplateWithPSDForPrintArea(
            printAreaId,
            selectedTemplate as File,
            {
              width: data.width,
              height: data.height,
            },
            isPODProduct && applyTemplateDimensionToPrintArea
          )
        }
      } else {
        handleSaveEditTemplate(printAreaId, data, !isPODProduct && applyTemplateDimensionToPrintArea)
      }
    },
    [
      handleSaveEditTemplate,
      isPODProduct,
      onReplaceTemplateWithExistingTemplateInPrintArea,
      onReplaceTemplateWithPSDForPrintArea,
    ]
  )

  const onConfirmDelete = useCallback(() => {
    handleConfirmDelete(deletingPrintAreaId!, () => setDeletingPrintAreaId(null))
  }, [deletingPrintAreaId, handleConfirmDelete])

  // Don't render if no active variant
  if (!activeVariant || tab !== EDITOR_TABS.DESIGN) return null

  // Render mobile or desktop version
  if (isMobileView) {
    return (
      <PrintAreasBarMobile
        printAreas={printAreas}
        currentPrintAreaId={currentPrintAreaId}
        productTitle={productTitle}
        variantTitle={variantTitle}
        isPODProduct={isPODProduct}
        allPrintAreas={allPrintAreas}
        activeVariant={activeVariant}
        defaultTemplateTitle={defaultTemplateTitle}
        defaultPrintAreaWidth={defaultPrintAreaWidth!}
        defaultPrintAreaHeight={defaultPrintAreaHeight!}
        defaultPrintArea={defaultPrintArea}
        editingPrintArea={editingPrintArea}
        deletingPrintAreaId={deletingPrintAreaId}
        temporarySelectedTemplate={temporarySelectedTemplate}
        onSelectPrintArea={handleSelectPrintArea}
        onCreateTemplate={onCreatePrintAreaWithNewTemplate}
        onSelectTemplate={onSelectExistingTemplate}
        onSaveEdit={onSaveEdit}
        handleSelectTemporaryTemplate={handleSelectTemporaryTemplate}
        onCloseEditModal={handleCloseEditModal}
        onConfirmDelete={onConfirmDelete}
        onCancelDelete={handleCancelDelete}
        t={t}
      />
    )
  }

  return (
    <>
      <PrintAreasBarDesktop
        printAreas={printAreas}
        currentPrintAreaId={currentPrintAreaId}
        switchingToPrintAreaId={switchingToPrintAreaId}
        productTitle={productTitle}
        variantTitle={variantTitle}
        isPODProduct={isPODProduct}
        allPrintAreas={allPrintAreas}
        activeVariant={activeVariant}
        editingPrintArea={editingPrintArea}
        deletingPrintAreaId={deletingPrintAreaId}
        temporarySelectedTemplate={temporarySelectedTemplate}
        onSelectPrintArea={handleSelectPrintArea}
        onSortPrintAreas={handleSortPrintAreas}
        onEditPrintArea={handleEditPrintArea}
        onRemovePrintArea={handleRemovePrintArea}
        onSaveEdit={onSaveEdit}
        handleSelectTemporaryTemplate={handleSelectTemporaryTemplate}
        onCloseEditModal={handleCloseEditModal}
        onConfirmDelete={onConfirmDelete}
        onCancelDelete={handleCancelDelete}
        t={t}
      />

      {/* Template Creation Modals */}
      <CreateNewTemplateModal
        key={`${defaultTemplateTitle}-${activeVariant?.printAreas?.length || 0}`}
        defaultTemplateTitle={defaultTemplateTitle}
        defaultPrintAreaWidth={defaultPrintAreaWidth}
        defaultPrintAreaHeight={defaultPrintAreaHeight}
        onCreateTemplate={onCreatePrintAreaWithNewTemplate}
      />

      {/* Select Existing Template Modal */}
      <SelectExistingTemplateModal
        printArea={defaultPrintArea}
        productVariant={activeVariant as VariantIntegration}
        onSelectTemplate={async (template: Template, applyTemplateDimensionToPrintArea: boolean) => {
          if (isPODProduct) {
            handleSelectTemporaryTemplate(template, 'existing', applyTemplateDimensionToPrintArea)
          } else {
            await onSelectExistingTemplate(template, applyTemplateDimensionToPrintArea)
          }
        }}
      />

      {/* PSD Upload Component */}
      <DropZonePSDForPrintAreaComponent
        isPODProduct={isPODProduct}
        handleSelectTemporaryTemplate={(
          template: Template | File | null,
          source: 'existing' | 'psd' | '',
          applyTemplateDimensionToPrintArea: boolean = true
        ) => {
          handleSelectTemporaryTemplate(template, source, applyTemplateDimensionToPrintArea)
        }}
        isUploading={psdUploading}
      />
    </>
  )
}
