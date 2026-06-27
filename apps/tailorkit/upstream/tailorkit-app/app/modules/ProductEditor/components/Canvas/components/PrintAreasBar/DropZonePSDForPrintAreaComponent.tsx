import { useCallback } from 'react'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { ONE_MINUTE_IN_MILLISECONDS } from '~/constants'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { DropZoneWithCustomPSDFileDialog } from '~/modules/TemplateEditor/components/DropZone'
import { useUploadPSDForPrintArea } from './hooks/useUploadPSDForPrintArea'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { ProgressProcessPSD } from '~/modules/TemplateEditor/components/Editor/ProgressProcessPSD'
import { Modal } from '@shopify/polaris'

interface IDropZonePSDForPrintAreaComponentProps {
  isPODProduct?: boolean
  isUploading?: boolean
  togglePopoverActive?: (state?: boolean) => void
  handleSelectTemporaryTemplate?: (template: File | null, source: 'existing' | 'psd' | '') => void
}

/**
 * DropZone component specifically for uploading PSD files in Product Editor
 * Creates a new template and print area from the uploaded PSD
 */
export default function DropZonePSDForPrintAreaComponent(props: IDropZonePSDForPrintAreaComponentProps) {
  const { togglePopoverActive, handleSelectTemporaryTemplate, isPODProduct = false, isUploading = false } = props
  const { state, openModal, closeModal } = useModal()
  const { updateParams } = useEditorParams()

  const openFileDialog = state?.[MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE]?.active

  const { uploadPSDAndCreateTemplate } = useUploadPSDForPrintArea()

  const { trackEvent } = useEventsTracking()

  const toggleOpenFileDialog = useCallback(() => {
    if (openFileDialog) {
      closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE)
    } else {
      openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE)
    }
  }, [closeModal, openModal, openFileDialog])

  const onDropPSDFile = useCallback(
    async (files: File[], acceptedFiles: File[], rejectedFiles: File[]) => {
      togglePopoverActive?.(false)

      // Validate files
      if (rejectedFiles.length > 0) {
        showGenericErrorToast()
        return
      }

      if (acceptedFiles.length === 0) {
        showGenericErrorToast()
        return
      }

      if (acceptedFiles.length > 1) {
        showGenericErrorToast()
        return
      }

      // Track time needed to process PSD files
      const startTime = Date.now()

      const file = acceptedFiles[0]

      if (isPODProduct) {
        typeof handleSelectTemporaryTemplate === 'function' && handleSelectTemporaryTemplate(file, 'psd')
        return
      }

      const result = await uploadPSDAndCreateTemplate(file)

      if (result?.success) {
        // Close the file dialog
        closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE)

        // Update params to navigate to the new print area and template
        if (result.printAreaId && result.templateId) {
          updateParams({
            printAreaId: result.printAreaId,
            templateId: result.templateId,
          })
        }

        // Send event to MixPanel
        trackEvent(EVENTS_TRACKING.UPLOAD_PSD_FILES, {
          [EVENTS_PARAMETERS_NAME.NUM_FILES]: 1,
          [EVENTS_PARAMETERS_NAME.PROCESSING_MINUTES]: ((Date.now() - startTime) / ONE_MINUTE_IN_MILLISECONDS).toFixed(
            2
          ),
          context: 'product_editor',
        })
      }
    },
    [
      togglePopoverActive,
      isPODProduct,
      uploadPSDAndCreateTemplate,
      handleSelectTemporaryTemplate,
      closeModal,
      trackEvent,
      updateParams,
    ]
  )

  return (
    <>
      <DropZoneWithCustomPSDFileDialog
        extracting={isUploading}
        openFileDialog={openFileDialog}
        onFileDialogClose={toggleOpenFileDialog}
        handleDropZoneDrop={onDropPSDFile}
      />

      {/* Show progress UI when uploading - reuse existing component */}
      {isUploading && (
        <Modal open={true} title="Processing PSD File" titleHidden onClose={() => {}}>
          <Modal.Section>
            <ProgressProcessPSD />
          </Modal.Section>
        </Modal>
      )}
    </>
  )
}
