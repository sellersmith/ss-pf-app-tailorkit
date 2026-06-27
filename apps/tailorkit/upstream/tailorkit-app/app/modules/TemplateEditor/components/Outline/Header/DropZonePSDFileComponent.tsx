import { useCallback } from 'react'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { ONE_MINUTE_IN_MILLISECONDS } from '~/constants'
import { MODAL_ID } from '~/constants/modal'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useExtractPSD } from '~/utils/extractPSD'
import { useModal } from '~/utils/hooks/useModal'
import { DropZoneWithCustomPSDFileDialog } from '../../DropZone'

interface IDropZoneWithCustomPSDFileDialogComponentProps {
  togglePopoverActive?: (state?: boolean) => void
}

export default function DropZoneWithCustomPSDFileDialogComponent(
  props: IDropZoneWithCustomPSDFileDialogComponentProps
) {
  const { togglePopoverActive } = props
  const { state, openModal, closeModal } = useModal()

  const openFileDialog = state?.[MODAL_ID.PSD_FILE_SELECTOR_MODAL]?.active

  const { processLayersForRenderingAfterUploadingPSDFile } = useExtractPSD()

  const extracting = useStore(TemplateEditorStore, state => state.extracting)

  const { trackEvent } = useEventsTracking()

  const toggleOpenFileDialog = useCallback(() => {
    if (openFileDialog) {
      closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    }
  }, [closeModal, openModal, openFileDialog])

  const onDropPSDFile = useCallback(
    async (files: File[], acceptedFiles: File[], rejectedFiles: File[]) => {
      togglePopoverActive?.(false)

      // Track time needed to process PSD files
      const startTime = Date.now()

      await processLayersForRenderingAfterUploadingPSDFile(files, acceptedFiles, rejectedFiles)

      // Send event to MixPanel
      trackEvent(EVENTS_TRACKING.UPLOAD_PSD_FILES, {
        [EVENTS_PARAMETERS_NAME.NUM_FILES]: acceptedFiles.length,
        [EVENTS_PARAMETERS_NAME.PROCESSING_MINUTES]: ((Date.now() - startTime) / ONE_MINUTE_IN_MILLISECONDS).toFixed(2),
      })
    },
    [processLayersForRenderingAfterUploadingPSDFile, togglePopoverActive, trackEvent]
  )

  return (
    <DropZoneWithCustomPSDFileDialog
      extracting={extracting}
      openFileDialog={openFileDialog}
      onFileDialogClose={toggleOpenFileDialog}
      handleDropZoneDrop={onDropPSDFile}
    />
  )
}
