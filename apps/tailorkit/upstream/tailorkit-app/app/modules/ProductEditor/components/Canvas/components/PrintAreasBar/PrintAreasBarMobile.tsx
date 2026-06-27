import { Box, Button, InlineStack, ActionList, Popover, Modal, BlockStack, Text, Icon } from '@shopify/polaris'
import { AlertTriangleIcon } from '@shopify/polaris-icons'
import { useState, useCallback, useMemo } from 'react'
import type { PrintArea, VariantIntegration } from '~/types/integration'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import CreateNewTemplateModal from './CreateNewTemplateModal'
import SelectExistingTemplateModal from './SelectExistingTemplateModal'
import DropZonePSDForPrintAreaComponent from './DropZonePSDForPrintAreaComponent'
import ModalEditTemplate from './ModalEditTemplate'
import type { Template } from '~/types/psd'
import type { TemporarySelectedTemplate } from './hooks/usePrintAreaActions'

interface PrintAreasBarMobileProps {
  printAreas: Array<PrintArea & { id: string }>
  currentPrintAreaId: string
  productTitle?: string
  variantTitle?: string
  isPODProduct: boolean
  allPrintAreas: Array<PrintArea>
  activeVariant: VariantIntegration
  defaultTemplateTitle: string
  defaultPrintAreaWidth: number
  defaultPrintAreaHeight: number
  defaultPrintArea: PrintArea
  editingPrintArea: PrintArea | null
  deletingPrintAreaId: string | null
  temporarySelectedTemplate: TemporarySelectedTemplate
  onSelectPrintArea: (printAreaId: string) => void
  onCreateTemplate: (title: string, width: number, height: number) => Promise<void>
  onSelectTemplate: (template: Template, applyTemplateDimensionToPrintArea: boolean) => Promise<void>
  onSaveEdit: (
    printAreaId: string,
    data: { name: string; width: number; height: number },
    temporarySelectedTemplate?: TemporarySelectedTemplate
  ) => Promise<void>
  handleSelectTemporaryTemplate: (
    template: Template | File | null,
    source: 'existing' | 'psd' | '',
    applyTemplateDimensionToPrintArea?: boolean
  ) => Promise<void>
  onCloseEditModal: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  t: (key: string) => string
}

export function PrintAreasBarMobile(props: PrintAreasBarMobileProps) {
  const {
    printAreas,
    currentPrintAreaId,
    productTitle,
    variantTitle,
    isPODProduct,
    allPrintAreas,
    activeVariant,
    defaultTemplateTitle,
    defaultPrintAreaWidth,
    defaultPrintAreaHeight,
    defaultPrintArea,
    editingPrintArea,
    deletingPrintAreaId,
    temporarySelectedTemplate,
    handleSelectTemporaryTemplate,
    onSelectPrintArea,
    onCreateTemplate,
    onSelectTemplate,
    onSaveEdit,
    onCloseEditModal,
    onConfirmDelete,
    onCancelDelete,
    t,
  } = props

  const { openModal, closeModal, state: modalState } = useModal()

  // Template selector popover
  const [templateSelectorPopoverActive, setTemplateSelectorPopoverActive] = useState(false)
  const toggleTemplateSelectorPopover = useCallback(() => {
    setTemplateSelectorPopoverActive(prev => !prev)
  }, [])

  // Add template popover
  const [addTemplatePopoverActive, setAddTemplatePopoverActive] = useState(false)
  const toggleAddTemplatePopover = useCallback(() => {
    setAddTemplatePopoverActive(prev => !prev)
  }, [])

  // File dialog state for PSD upload
  const openFileDialog = modalState?.[MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE]?.active
  const toggleOpenFileDialog = useCallback(() => {
    if (openFileDialog) {
      closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE)
    } else {
      openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE)
    }
  }, [closeModal, openModal, openFileDialog])

  // Generate current template title for mobile display
  const currentTemplateName = useMemo(() => {
    if (!printAreas.length || !currentPrintAreaId) return 'No template'
    const currentPrintArea = printAreas.find(pa => pa._id === currentPrintAreaId)
    if (!currentPrintArea) return 'No template'

    const template = (currentPrintArea as any)?.template
    const hasTemplate = template && template._id

    // Show template name directly if exists (source of truth), otherwise show print area name as fallback
    if (hasTemplate) {
      const templateName = template.name || 'Template'
      // Use template name directly - don't add prefix as it's the source of truth
      return templateName
    }

    // Fallback to print area name
    return currentPrintArea.name || 'No template'
  }, [printAreas, currentPrintAreaId])

  // Check dimension mismatch for current template
  const currentHasDimensionMismatch = useMemo(() => {
    if (!isPODProduct || !printAreas.length || !currentPrintAreaId) return false
    const currentPrintArea = printAreas.find(pa => pa._id === currentPrintAreaId)
    if (!currentPrintArea) return false

    const template = typeof currentPrintArea.template === 'object' ? currentPrintArea.template : null
    if (!template || !currentPrintArea.width || !currentPrintArea.height) return false

    return (
      template.dimension?.width !== currentPrintArea.width || template.dimension?.height !== currentPrintArea.height
    )
  }, [isPODProduct, printAreas, currentPrintAreaId])

  return (
    <Box paddingInline="300" paddingBlock="200" borderColor="border" borderBlockStartWidth="025">
      <InlineStack gap="200" blockAlign="center" align="end" wrap={false}>
        {/* Template selector button */}
        <Popover
          active={templateSelectorPopoverActive}
          activator={
            <Button
              fullWidth
              onClick={toggleTemplateSelectorPopover}
              disclosure={templateSelectorPopoverActive ? 'up' : 'down'}
            >
              {/* @ts-ignore */}
              <InlineStack gap="100" blockAlign="center" wrap={false}>
                {currentHasDimensionMismatch && <Icon source={AlertTriangleIcon} tone="warning" />}
                <Box
                  maxWidth={`calc(100vw - ${isPODProduct ? (currentHasDimensionMismatch ? '90px' : '60px') : '210px'})`}
                >
                  <Text as="span" variant="bodyMd" fontWeight="medium" truncate>
                    {currentTemplateName}
                  </Text>
                </Box>
              </InlineStack>
            </Button>
          }
          onClose={toggleTemplateSelectorPopover}
          autofocusTarget="first-node"
        >
          <ActionList
            items={printAreas.map(pa => {
              const template = (pa as any)?.template
              const hasTemplate = template && template._id
              const templateName = hasTemplate ? template.name || 'Template' : pa.name
              const fullTitle = hasTemplate
                ? `${productTitle || 'Product'}${variantTitle ? `/${variantTitle}` : ''}/${templateName}`
                : pa.name
              const isActive = pa._id === currentPrintAreaId

              // Check dimension mismatch
              const hasDimensionMismatch
                = isPODProduct
                && template
                && pa.width
                && pa.height
                && (template.dimension?.width !== pa.width || template.dimension?.height !== pa.height)

              return {
                content: fullTitle,
                active: isActive,
                truncate: true,
                prefix: hasDimensionMismatch ? <Icon source={AlertTriangleIcon} tone="warning" /> : undefined,
                helpText: hasDimensionMismatch
                  ? t('template-dimension-does-not-match-print-area-dimension-click-edit-to-review')
                  : undefined,
                onAction: () => {
                  onSelectPrintArea(pa._id)
                  setTemplateSelectorPopoverActive(false)
                },
              }
            })}
          />
        </Popover>
        {/* Add button */}
        {!isPODProduct && (
          <Popover
            active={addTemplatePopoverActive}
            activator={
              <Button
                onClick={toggleAddTemplatePopover}
                fullWidth
                disclosure={addTemplatePopoverActive ? 'up' : 'down'}
              >
                {t('add-template')}
              </Button>
            }
            onClose={toggleAddTemplatePopover}
            autofocusTarget="first-node"
          >
            <ActionList
              items={[
                {
                  content: t('create-new-template'),
                  onAction: () => {
                    openModal(MODAL_ID.CREATE_NEW_TEMPLATE_MODAL)
                    setAddTemplatePopoverActive(false)
                  },
                },
                {
                  content: t('select-existing-template'),
                  onAction: () => {
                    openModal(MODAL_ID.SELECT_EXISTING_TEMPLATE_MODAL)
                    setAddTemplatePopoverActive(false)
                  },
                },
                {
                  content: t('upload-psd-file'),
                  onAction: () => {
                    toggleOpenFileDialog()
                    setAddTemplatePopoverActive(false)
                  },
                },
              ]}
            />
          </Popover>
        )}
      </InlineStack>

      {/* Edit Template Modal */}
      {!!editingPrintArea && (
        <ModalEditTemplate
          active={!!editingPrintArea}
          onClose={onCloseEditModal}
          printArea={editingPrintArea}
          allPrintAreas={allPrintAreas}
          productTitle={productTitle}
          variantTitle={variantTitle}
          onSave={onSaveEdit}
          isPODProduct={isPODProduct}
          temporarySelectedTemplate={temporarySelectedTemplate}
          handleSelectTemporaryTemplate={handleSelectTemporaryTemplate}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingPrintAreaId}
        onClose={onCancelDelete}
        title={t('delete-template')}
        primaryAction={{
          content: t('delete'),
          destructive: true,
          onAction: onConfirmDelete,
        }}
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: onCancelDelete,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              {t('this-action-can-t-be-undone-and-this-template-won-t-appear-on-your-product')}
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Template Creation Modals */}
      <CreateNewTemplateModal
        key={`${defaultTemplateTitle}-${activeVariant?.printAreas?.length || 0}`}
        defaultTemplateTitle={defaultTemplateTitle}
        defaultPrintAreaWidth={defaultPrintAreaWidth}
        defaultPrintAreaHeight={defaultPrintAreaHeight}
        onCreateTemplate={onCreateTemplate}
      />
      <SelectExistingTemplateModal
        printArea={defaultPrintArea}
        productVariant={activeVariant}
        onSelectTemplate={async (template, applyTemplateDimensionToPrintArea) => {
          if (isPODProduct) {
            handleSelectTemporaryTemplate(template, 'existing')
          } else {
            await onSelectTemplate(template, applyTemplateDimensionToPrintArea)
          }
        }}
      />
      <DropZonePSDForPrintAreaComponent togglePopoverActive={toggleOpenFileDialog} />
    </Box>
  )
}
