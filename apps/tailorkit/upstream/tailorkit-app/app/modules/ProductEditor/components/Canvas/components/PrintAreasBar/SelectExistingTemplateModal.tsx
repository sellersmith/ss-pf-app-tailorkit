import type { Template } from '~/types/psd'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { useCallback } from 'react'
import ModalTemplateSelection from '../../../IntegrationInspector/Integrate/ModalTemplateSelection'
import type { VariantIntegration, PrintArea } from '~/types/integration'

interface SelectExistingTemplateModalProps {
  printArea: PrintArea
  productVariant: VariantIntegration
  onBeforeClose?: () => void
  onSelectTemplate: (template: Template, applyTemplateDimensionToPrintArea: boolean) => Promise<void>
  modalId?: string
}

export default function SelectExistingTemplateModal(props: SelectExistingTemplateModalProps) {
  const {
    printArea,
    productVariant,
    onBeforeClose,
    onSelectTemplate,
    modalId = MODAL_ID.SELECT_EXISTING_TEMPLATE_MODAL,
  } = props

  const { state, openModal, closeModal } = useModal()
  const active = state[modalId]?.active

  const handleCloseModal = useCallback(() => {
    onBeforeClose?.()
    closeModal(modalId)
  }, [closeModal, onBeforeClose, modalId])

  const handleSelectTemplate = useCallback(
    async (template: PrintArea['template'] | null, applyTemplateDimensionToPrintArea: boolean) => {
      if (!template) {
        return
      }

      try {
        await onSelectTemplate(template as Template, applyTemplateDimensionToPrintArea)

        handleCloseModal()
      } catch (error) {
        console.error('[SelectExistingTemplateModal] Failed to select template:', error)
      }
    },
    [handleCloseModal, onSelectTemplate]
  )

  return (
    <ModalTemplateSelection
      active={active}
      setActive={active => {
        if (active) {
          openModal(modalId)
        } else {
          handleCloseModal()
        }
      }}
      printArea={printArea}
      productVariant={productVariant}
      templateSelected={printArea.template}
      onTemplateSelectedChange={handleSelectTemplate}
      isImportedProduct={false}
    />
  )
}
