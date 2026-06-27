import { Box, InlineStack, Button } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { optionSetDataKeys, type OptionSet, EOptionSet } from '~/types/psd'
import type { TLayerStore } from '~/stores/modules/layer'
import type { ReactNode } from 'react'
import { Fragment, useCallback, useContext, useState } from 'react'
import { SubInspectorStore } from '~/stores/canvas/subInspector'
import { OPTION_SET_SELECTOR } from '~/modules/TemplateEditor/components/Inspector/constants'
import { DeleteOptionSetConfirmationModal } from '~/modules/modals/OptionSet/DeleteOptionSetConfirmation'
import { UnsyncOptionSetModal } from '~/modules/modals'
import { showGenericErrorToast } from '~/utils/toastEvents'
import {
  countOptionSetsUsed,
  getDefaultStorefrontLabel,
  revertLayerImageToOriginal,
  syncOptionSetForLayerUsing,
} from '../../../fns'
import type { IOptionSetConfigurationCommonProps } from '~/modules/TemplateEditor/elements/components/common/OptionSetConfiguration'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { getErrorMessageByKey, getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { validateOptionSet } from '~/modules/TemplateEditor/hooks/useSaveTemplate'

interface IOptionSetConfigurationFooterProps extends IOptionSetConfigurationCommonProps {
  newOptionSetPressed: boolean
  editMode: boolean
  optionSetEditing: OptionSet
  layerStore: TLayerStore
  helpText?: ReactNode
}

export default function OptionSetConfigurationFooter(props: IOptionSetConfigurationFooterProps) {
  const {
    newOptionSetPressed,
    editMode,
    optionSetEditing,
    layerStore,
    setButtonsStatus,
    clearOptionSetValidationErrors,
    helpText,
  } = props
  const { t } = useTranslation()

  const context = useContext(TemplateEditorContext)
  const [fetchingLayerCounting, setFetchingLayerCounting] = useState(false)
  const [layerCounting, setLayerCounting] = useState(0)

  // Handle deleting option set
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [syncModalActive, setSyncModalActive] = useState<string | null>(null)

  const toggleUnsyncModal = useCallback(() => {
    setSyncModalActive(syncModalActive ? null : optionSetEditing.type)
  }, [optionSetEditing.type, syncModalActive])

  const revertBaseImage = useCallback(() => {
    if (optionSetEditing.type !== EOptionSet.IMAGE_OPTION) return
    revertLayerImageToOriginal(layerStore)
  }, [layerStore, optionSetEditing.type])

  const onCancelNewOptionSet = useCallback(() => {
    // Revert base image if needed
    revertBaseImage()

    // Clear the validation errors
    clearOptionSetValidationErrors(optionSetEditing)

    const defaultStorefrontLabel = getDefaultStorefrontLabel({ t, type: optionSetEditing.type })
    // Clear the option set data
    const newOptionSet = { ...optionSetEditing, data: null, label: '', labelOnStoreFront: defaultStorefrontLabel }
    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: newOptionSet,
      },
    })

    // Reset add button status
    setButtonsStatus(
      {
        editMode: false,
        newOptionSetPressed: false,
        existOptionSetPressed: false,
      },
      optionSetEditing.type
    )
  }, [layerStore, optionSetEditing, clearOptionSetValidationErrors, setButtonsStatus, t, revertBaseImage])

  const handleEditOptionSet = useCallback(async () => {
    try {
      setFetchingLayerCounting(true)

      const response = await countOptionSetsUsed(optionSetEditing._id)

      if (!response.success) {
        console.error('Failed to fetch layer counting: ', response.message)

        throw new Error(response.message)
      }

      const { layerCounting } = response.optionSet

      if (!editMode && layerCounting > 0) {
        setSyncModalActive(optionSetEditing.type)
      } else {
        setButtonsStatus(
          {
            editMode: !editMode,
          },
          optionSetEditing.type
        )
      }
      setLayerCounting(layerCounting)
      setFetchingLayerCounting(false)
    } catch (e) {
      console.error('Failed to fetch layer counting: ', e)
      showGenericErrorToast()
    }
  }, [editMode, optionSetEditing._id, optionSetEditing.type, setButtonsStatus])

  const handleDoneOptionSet = useCallback(() => {
    // Sync option for layer using this one
    syncOptionSetForLayerUsing(optionSetEditing)

    setButtonsStatus(
      {
        editMode: false,
      },
      optionSetEditing.type
    )

    const optionSetData = optionSetEditing.data
    const optionSetType = optionSetEditing.type

    try {
      // Clear all selecting files
      if (optionSetData) {
        const dataKey = optionSetDataKeys[optionSetType] as keyof typeof optionSetData
        if (dataKey in optionSetData) {
          const items = optionSetData[dataKey] as Array<{ selecting: boolean }>
          const updatedData = {
            ...optionSetData,
            [dataKey]: items.map(item => ({ ...item, selecting: false })),
          }

          layerStore.dispatch({
            type: 'UPDATE_OPTION_SET',
            payload: {
              optionSet: { ...optionSetEditing, data: updatedData } as OptionSet,
            },
            skipTrace: true,
          })
        }
      }
    } catch (error) {
      console.error('Failed to clear selecting files: ', error)
    }
  }, [optionSetEditing, layerStore, setButtonsStatus])

  const handleConfirmDelete = useCallback(
    (confirmed?: boolean) => {
      if (confirmed !== true) {
        setConfirmDelete(true)
      } else {
        // Revert base image if needed
        revertBaseImage()

        clearOptionSetValidationErrors(optionSetEditing)

        layerStore.dispatch({
          type: 'DELETE_OPTION_SET',
          payload: { optionSet: optionSetEditing },
        })
        setConfirmDelete(false)
      }
    },
    [layerStore, optionSetEditing, clearOptionSetValidationErrors, revertBaseImage]
  )

  const handleReplace = useCallback(() => {
    SubInspectorStore.dispatch({
      type: 'OPEN_SUB_INSPECTOR_BY_KEY',
      payload: { key: OPTION_SET_SELECTOR, data: { optionType: optionSetEditing.type } },
    })
  }, [optionSetEditing.type])

  const renderFooter = useCallback(() => {
    if (newOptionSetPressed) {
      return (
        <Box paddingBlockStart={'100'}>
          <InlineStack align="end">
            <Button onClick={onCancelNewOptionSet}>{t('cancel')}</Button>
          </InlineStack>
        </Box>
      )
    }

    if (editMode) {
      // Validate option set
      const layerId = layerStore.getState()._id
      const keyOptionSetDataError = getKeyError(optionSetEditing, OptionSetErrorKeys.OPTION_SET_DATA)
      const keyOptionSetLabelError = getKeyError(optionSetEditing, OptionSetErrorKeys.OPTION_SET_LABEL)
      const optionSetDataErrorMsg = getErrorMessageByKey({ keyOptionSetError: keyOptionSetDataError, layerId }, context)
      const optionSetLabelErrorMsg = getErrorMessageByKey(
        { keyOptionSetError: keyOptionSetLabelError, layerId },
        context
      )
      const isHaveError = optionSetDataErrorMsg || optionSetLabelErrorMsg
      const isValid = validateOptionSet(optionSetEditing)

      const disabledDoneButton = !isValid || isHaveError

      return (
        <InlineStack align="space-between">
          <Button size="slim" onClick={handleReplace}>
            {t('replace')}
          </Button>
          <Button size="slim" onClick={handleDoneOptionSet} disabled={disabledDoneButton}>
            {t('done')}
          </Button>
        </InlineStack>
      )
    }

    return (
      <InlineStack align="space-between">
        <Button size="slim" onClick={handleConfirmDelete}>
          {t('delete')}
        </Button>
        <Button size="slim" onClick={handleEditOptionSet} loading={fetchingLayerCounting}>
          {t('edit')}
        </Button>
      </InlineStack>
    )
  }, [
    newOptionSetPressed,
    editMode,
    fetchingLayerCounting,
    optionSetEditing,
    layerStore,
    context,
    t,
    handleConfirmDelete,
    handleEditOptionSet,
    onCancelNewOptionSet,
    handleReplace,
    handleDoneOptionSet,
  ])

  return (
    <Fragment>
      {renderFooter()}

      {helpText && <Box>{helpText}</Box>}

      <DeleteOptionSetConfirmationModal
        confirmDelete={confirmDelete}
        optionSet={optionSetEditing}
        setConfirmDelete={setConfirmDelete}
        handleDelete={handleConfirmDelete}
      />

      <UnsyncOptionSetModal
        active={syncModalActive === optionSetEditing.type}
        optionSetEditing={optionSetEditing}
        layerStore={layerStore}
        layerCounting={layerCounting}
        onClose={toggleUnsyncModal}
        setEditMode={editMode => setButtonsStatus({ editMode }, optionSetEditing.type)}
      />
    </Fragment>
  )
}
