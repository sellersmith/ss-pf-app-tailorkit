import { BlockStack, Modal, TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { useCallback, useState } from 'react'
import { MAX_TEMPLATE_NAME_SIZE } from '~/constants/canvas'

interface CreateNewTemplateModalProps {
  defaultTemplateTitle?: string
  defaultPrintAreaWidth?: number
  defaultPrintAreaHeight?: number
  onCreateTemplate: (templateTitle: string, printAreaWidth: number, printAreaHeight: number) => Promise<void>
  onBeforeClose?: () => void
}

export default function CreateNewTemplateModal(props: CreateNewTemplateModalProps) {
  const {
    defaultTemplateTitle = '',
    defaultPrintAreaWidth = 0,
    defaultPrintAreaHeight = 0,
    onBeforeClose,
    onCreateTemplate,
  } = props
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const active = state[MODAL_ID.CREATE_NEW_TEMPLATE_MODAL]?.active

  const [templateTitle, setTemplateTitle] = useState(defaultTemplateTitle)
  const [printAreaWidth, setPrintAreaWidth] = useState(defaultPrintAreaWidth)
  const [printAreaHeight, setPrintAreaHeight] = useState(defaultPrintAreaHeight)

  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

  const handleCloseModal = useCallback(() => {
    onBeforeClose?.()
    closeModal(MODAL_ID.CREATE_NEW_TEMPLATE_MODAL)
  }, [closeModal, onBeforeClose])

  const handleCreateTemplate = useCallback(async () => {
    try {
      setIsCreatingTemplate(true)

      requestAnimationFrame(async () => {
        // Create template
        await onCreateTemplate(templateTitle, printAreaWidth, printAreaHeight)

        handleCloseModal()
      })
    } catch (error) {
      console.error('[CreateNewTemplateModal] Failed to create template:', error)
    } finally {
      setIsCreatingTemplate(false)
    }
  }, [templateTitle, printAreaWidth, printAreaHeight, onCreateTemplate, handleCloseModal])

  return (
    <Modal
      open={active}
      onClose={handleCloseModal}
      title={t('create-new-template')}
      primaryAction={{
        content: isCreatingTemplate ? '...' : t('create'),
        onAction: handleCreateTemplate,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: handleCloseModal,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <TextField
            label={t('template-title')}
            value={templateTitle}
            onChange={val => setTemplateTitle(val)}
            autoComplete="off"
            maxLength={MAX_TEMPLATE_NAME_SIZE}
          />

          {/* Dimensions (px) */}
          <BlockStack gap="200">
            <TextField
              label={t('width')}
              type="number"
              value={String(printAreaWidth)}
              onChange={val => setPrintAreaWidth(Number(val) || 0)}
              suffix="px"
              autoComplete="off"
            />
            <TextField
              label={t('height')}
              type="number"
              value={String(printAreaHeight)}
              onChange={val => setPrintAreaHeight(Number(val) || 0)}
              suffix="px"
              autoComplete="off"
            />
          </BlockStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
