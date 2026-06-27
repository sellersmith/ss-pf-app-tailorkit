/* eslint-disable max-len */
import { Banner, BlockStack, Modal, Text, TextField, useBreakpoints } from '@shopify/polaris'
import isEmpty from 'lodash/isEmpty'
import { Fragment, useCallback, useContext, useEffect, useState, useMemo, memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { ModalWithoutBackdropAction } from '~/components/common/Modal/ModalWithoutBackdropAction'
import ProgressBarComponent from '~/components/common/ProgressBarState'
import { MAX_TEMPLATE_NAME_SIZE } from '~/constants/canvas'
import { MODAL_ID } from '~/constants/modal'
import { TOAST } from '~/constants/toasts'
import { useStore } from '~/libs/external-store'
import { useSaveTemplate } from '~/modules/TemplateEditor/hooks/useSaveTemplate'
import { ProgressStore } from '~/stores/canvas/progress'
import { modalStore } from '~/stores/modal'
import { type TLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStore } from '~/stores/modules/template'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TemplateEditorContext } from '../context'
import type Konva from 'konva'
import TemplateDesignTypeSelector from './TemplateDesignTypeSelector'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { useGatherUserFeedbackForm } from '~/modules/Feedback/hooks/useGatherUserFeedbackForm'
import withFeedback from '~/bootstrap/hoc/withFeedback'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import ConfettiEffect from '~/components/confetti'
import { BFS_COMPLIANCE } from '~/constants/bfs-compliance'
import ModalNavigateToIntegration from '~/modules/TourGuides/TemplateEditorQuickTour/ModalNavigateToIntegration'
import { useModal } from '~/utils/hooks/useModal'
import { CONFETTI_QUICK_TOUR_KEY } from '~/modules/TourGuides/TemplateEditorQuickTour/constants'
import { sleep } from '~/utils/sleep'
import { exportCanvasAsImage, exportCanvasWithPreviewImage } from '../utilities/canvas'
//import { useLiveChat } from '~/utils/hooks/useLiveChat'
//import { useRootLoaderData } from '~/root'
//import { startIntegrationEditorQuickTour } from '~/modules/TourGuides/TemplateEditorQuickTour/fns'
//import useInitIntegration from '~/routes/integrations.modal.$id/hooks/useInitIntegration'
//import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '../constants'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import TemplateSaveThumbnailCheckbox from './TemplateSaveThumbnailCheckbox'

const modalId = MODAL_ID.SAVE_TEMPLATE_MODAL

const clickedLayerStoreBackup: TLayerStore | null = null
const checkedLayerStoresBackup: TLayerStore[] = []

function SaveTemplateModalContent(props: { stageRef: React.RefObject<Konva.Stage> }) {
  const { stageRef } = props
  const { t } = useTranslation()
  const stage = stageRef?.current

  const { onSaveTemplate, loading, setLoading, saved, setSaved } = useSaveTemplate()
  const [trickyLoading, setTrickyLoading] = useState<string | undefined>()
  const [saveThumbnailWithPreview, setSaveThumbnailWithPreview] = useState(false)

  const { handleAfterSaveTemplate } = useGatherUserFeedbackForm({
    feedbackType: FEEDBACK_TYPE.TEMPLATE_EDITOR_FUNCTIONALITY,
  })
  const active = useStore(modalStore, (state: { [key: string]: { active: boolean } }) => state?.[modalId]?.active)
  const name = useStore(TemplateEditorStore, state => state.name)
  const previewProductImage = useStore(TemplateEditorStore, state => state.previewProductImage)

  const { mdUp } = useBreakpoints()
  const { state } = useModal()
  const isConfettiQuickTourActive = state[CONFETTI_QUICK_TOUR_KEY]?.active

  // Check if preview product image is visible
  const isPreviewImageVisible = useMemo(() => {
    return !!(previewProductImage && previewProductImage.visible !== false)
  }, [previewProductImage])

  const setActive = (state: boolean) => {
    modalStore.dispatch({
      type: state ? 'OPEN_MODAL' : 'CLOSE_MODAL',
      payload: {
        key: modalId,
      },
    })
  }

  const handleChange = useCallback(() => setActive(!active), [active])

  const index = useStore(ProgressStore, state => state.index)
  const total = useStore(ProgressStore, state => state.total)

  const progress = total > 0 ? (index / total) * 100 : 0
  const [tempName, _setTempName] = useState(name)

  const setTempName = useCallback((value: string) => {
    // Validate title length
    if (value.length > MAX_TEMPLATE_NAME_SIZE) {
      value = value.substring(0, 60)
    }

    _setTempName(value)
  }, [])

  useEffect(() => {
    setTempName(name)
  }, [name, setTempName])

  useEffect(() => {
    if (!active) return

    // Clear all selection
    LayerStoreSelection.dispatch({
      type: 'RESET_STATE',
    })
  }, [active])

  const { validationErrors } = useContext(TemplateEditorContext)

  const handleSaveTemplate = useCallback(async () => {
    try {
      if (!stage) {
        showGenericErrorToast()

        return
      }

      // Pre-Refresh the idToken
      shopify.idToken()

      setTrickyLoading('processing')
      await sleep(50)

      const templateEditorState = TemplateEditorStore.getState()
      const dimension = templateEditorState.dimension

      if (!dimension) {
        showGenericErrorToast()
        return
      }

      const _width = dimension.width || 0
      const _height = dimension.height || 0

      // Convert the width and height to pixels
      const width = lengthUnitToPixels(_width, dimension.measurementUnit, dimension.resolution)
      const height = lengthUnitToPixels(_height, dimension.measurementUnit, dimension.resolution)

      const base64Image = await exportCanvasAsImage(stage, width, height)

      if (typeof base64Image !== 'string') {
        throw new Error(CommonError)
      }

      // Generate thumbnail with preview product image if checkbox is checked
      let base64Thumbnail: string | undefined
      if (saveThumbnailWithPreview && isPreviewImageVisible) {
        base64Thumbnail = await exportCanvasWithPreviewImage(stage, width, height)

        if (typeof base64Thumbnail !== 'string') {
          console.error('Failed to generate thumbnail')
          base64Thumbnail = undefined
        }
      }

      setTrickyLoading(undefined)
      setLoading(true)

      // Save template preview image or further processing
      const { saved, template, showConfetti } = await onSaveTemplate(base64Image, base64Thumbnail)

      if (saved) {
        // Close save template modal
        setActive(false)

        // Save temporary template to window object
        window.savedTemplate = template
        window.savedTemplateUseAiFeature = localStorage.getItem('TLK_USE_AI_FEATURE_AT') ? 1 : 0

        // Handle after save template
        await handleAfterSaveTemplate(showConfetti)

        // Clean up previous AI feature flag
        localStorage.removeItem('TLK_USE_AI_FEATURE_AT')

        // Trigger the saved template if needed
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVED_TEMPLATE, {
          template,
        })
      }

      // Restore layer selection
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: clickedLayerStoreBackup,
          checkedLayerStores: checkedLayerStoresBackup,
        },
      })
    } catch (error) {
      console.error(error)
      showGenericErrorToast()
    } finally {
      setLoading(false)
    }
  }, [stage, setLoading, onSaveTemplate, handleAfterSaveTemplate, saveThumbnailWithPreview, isPreviewImageVisible])

  useEffect(() => {
    Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVE_TEMPLATE, handleSaveTemplate)

    return () => {
      Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVE_TEMPLATE, handleSaveTemplate)
    }
  }, [handleSaveTemplate])

  return (
    <Fragment>
      <ModalWithoutBackdropAction
        open={active}
        title={t('save-template')}
        onClose={() => {
          handleChange()

          if (saved) {
            setSaved(false)
          }
        }}
        primaryAction={{
          loading: !trickyLoading && loading,
          content: t(trickyLoading ?? 'save'),
          disabled:
            (total !== 0 && progress < 100)
            || !tempName?.trim().length
            || !isEmpty(validationErrors)
            || !!trickyLoading,
          onAction: async () => {
            showToast(t(TOAST.TEMPLATE_EDITOR.SAVING_TEMPLATE))

            await handleSaveTemplate()

            // Trigger an event to the main app
            showToast(t(TOAST.TEMPLATE_EDITOR.TEMPLATE_SAVED))
          },
        }}
      >
        <Modal.Section>
          <BlockStack gap={'300'}>
            {!isEmpty(validationErrors) && (
              <Banner tone="critical">
                {t('please-fill-in-all-required-input-fields-before-saving-the-template')}
              </Banner>
            )}

            <TemplateName t={t} value={tempName} setValue={setTempName} />

            <TemplateDesignTypeSelector />

            <TemplateSaveThumbnailCheckbox
              saveThumbnailWithPreview={saveThumbnailWithPreview}
              setSaveThumbnailWithPreview={setSaveThumbnailWithPreview}
              isPreviewImageVisible={isPreviewImageVisible}
            />

            <ImagesUploading t={t} />
          </BlockStack>
        </Modal.Section>
      </ModalWithoutBackdropAction>
      {!BFS_COMPLIANCE.HIDE_PUBLISH_POPOVER_AND_CONFETTI && isConfettiQuickTourActive && (
        <ConfettiEffect particleCount={300} duration={mdUp ? 4000 : 3000} spread={25} />
      )}
      <ModalNavigateToIntegration />
    </Fragment>
  )
}

function TemplateName(props: WithTranslationProps & { value: string; setValue: any }) {
  const { t, value, setValue } = props

  function onChangeTemplateName(value: string) {
    TemplateEditorStore.dispatch({
      type: 'SET_NAME',
      payload: {
        name: value,
      },
    })
  }

  return (
    <TextField
      label={t('template-name')}
      value={value}
      onChange={(val: string) => setValue(val)}
      autoComplete="off"
      maxLength={MAX_TEMPLATE_NAME_SIZE}
      onBlur={() => {
        if (value.trim().length) {
          onChangeTemplateName(value)
        }
      }}
      {...(!value?.trim().length
        ? {
            error: t('name-can-not-empty'),
          }
        : {})}
      showCharacterCount
    />
  )
}

function ImagesUploading(props: WithTranslationProps) {
  const { t } = props
  const index = useStore(ProgressStore, state => state.index)
  const total = useStore(ProgressStore, state => state.total)

  const progress = total > 0 ? (index / total) * 100 : 0

  return (
    <Fragment>
      {total > 0 && progress < 100 && (
        <BlockStack gap={'100'}>
          <Text as="p" variant="bodyMd">
            {t('saving-layers-image-is-in-progress')}
          </Text>

          <ProgressBarComponent progress={progress} tone="success" size="medium" />
        </BlockStack>
      )}
    </Fragment>
  )
}

function SaveTemplateModal(props: { stageRef: React.RefObject<Konva.Stage> }) {
  const EnhancedComponent = useMemo(
    () => withFeedback(SaveTemplateModalContent, FEEDBACK_TYPE.TEMPLATE_EDITOR_FUNCTIONALITY),
    []
  )

  return <EnhancedComponent {...props} />
}

export default memo(SaveTemplateModal)
