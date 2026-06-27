import { BlockStack, InlineStack, Modal, RadioButton } from '@shopify/polaris'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { Fragment, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type MaskShape } from '~/bootstrap/constants/mask-option-sets'
import Switch from '~/components/common/Switch'
import OptionSetPricingField from '~/components/OptionSetPricingField'
import OptionSetPricingHeader from '~/components/OptionSetPricingHeader'
import { EMPTY_ARRAY } from '~/constants'
import { MAX_OPTION_SET_ITEM_NAME_SIZE } from '~/constants/canvas'
import { OptionSetErrors } from '~/constants/errors'
import { useStore } from '~/libs/external-store'
import SortableItemList from '~/modules/SortableItemList'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { revertLayerImageToOriginal } from '~/modules/TemplateEditor/elements/fns'
import { getErrorMessageByKey, getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { type TLayerStore } from '~/stores/modules/layer'
import {
  EOptionSet,
  optionSetDataKeys,
  type IMAGE_OPTION_SET,
  type ImageOptionSet,
  type OptionSet,
  type MASK_OPTION_SET,
} from '~/types/psd'
import { createOptionPricing } from '~/utils/exchange-rates/client'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { isAdditionalPricingEnabled } from '~/utils/optionSet-pricing'
import {
  buildImagePayload,
  buildSettingsWithOverlay,
  computeIndividualModeClipGroup,
  decodeIndividualTransform,
  hasCustomTransform,
  type BaseTransform,
  type ClipGroup,
} from './helpers'
import { AddMoreImageItem } from './ImageItem'
import ImageOptionThumbnail from './ImageOptionThumbnail'
import { useEditingMode } from './useEditingMode'

type MaskOptionSet = MaskShape & { selecting: boolean }

type ITempImageOptionSet = (ImageOptionSet | MaskOptionSet) & {
  id: string
}

export interface IImageItemsProps {
  layerStore: TLayerStore
  optionSet: IMAGE_OPTION_SET | MASK_OPTION_SET
  editMode: boolean
  existOptionSetPressed: boolean
  allowEditImagePricing?: boolean
  toggleImageSelectModal: () => void
}

export default function ImageItems(props: IImageItemsProps) {
  const {
    layerStore,
    optionSet,
    editMode,
    existOptionSetPressed,
    allowEditImagePricing = true,
    toggleImageSelectModal,
  } = props

  const { t } = useTranslation()
  const context = useContext(TemplateEditorContext)
  const { setValidationErrors } = context
  const layerId = useStore(layerStore, state => state._id)

  const optionSetType = optionSet?.type
  const optionSetDataKey = optionSetDataKeys[optionSetType as keyof typeof optionSetDataKeys]
  const isMaskOption = optionSetType === EOptionSet.MASK_OPTION

  const files: ImageOptionSet[] = useMemo(
    () => ((optionSet?.data as any)?.[optionSetDataKey] as ImageOptionSet[] | undefined) || EMPTY_ARRAY,
    [optionSet?.data, optionSetDataKey]
  )
  const memoFiles = useMemo(() => files.map(file => ({ ...file, id: file._id })), [files])
  const disabled = !editMode && existOptionSetPressed

  // Per-option-set editing mode: default to 'sync' if not set
  const isEditingIndividually = optionSet?.type === EOptionSet.IMAGE_OPTION && optionSet?.editingMode === 'individual'

  const onUpdateTransformerSelection = useCallback(() => {
    requestAnimationFrame(() => {
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
    })
  }, [])

  /* Exclusive select (clears other selections, selects only one) */
  const selectOnly = useCallback(
    (_id: string) => {
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SELECTING',
        payload: { optionSet, _id },
        skipTrace: true,
      })

      if (optionSet.type === EOptionSet.MASK_OPTION) {
        onUpdateTransformerSelection()
      }
    },
    [layerStore, onUpdateTransformerSelection, optionSet]
  )

  /* Apply stored transform & src to current layer */
  const applyOptionTransform = useCallback(
    (_id: string, selecting: boolean = false) => {
      // Handle mask options (early return)
      if (isMaskOption) {
        layerStore.dispatch({
          type: 'UPDATE_OPTION_SELECTING',
          payload: { optionSet, _id },
          skipTrace: true,
        })
        onUpdateTransformerSelection()
        return
      }

      if (selecting) selectOnly(_id)

      // Get fresh data from store
      const currentLayerState = layerStore.getState()
      const freshOptionSet = currentLayerState.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION) as
        | IMAGE_OPTION_SET
        | undefined
      const freshFiles = freshOptionSet?.data?.files || []
      const selectedFile = freshFiles.find(f => f._id === _id) || files.find(f => f._id === _id)
      if (!selectedFile) return

      const imageOptionSet = optionSet as IMAGE_OPTION_SET
      const currentEditingMode = freshOptionSet?.editingMode || imageOptionSet.editingMode || 'sync'
      const originalBaseState = freshOptionSet?.originalBaseState || imageOptionSet.originalBaseState
      const originalClipGroup = freshOptionSet?.originalClipGroup || imageOptionSet.originalClipGroup

      // 1. Compute transform for individual mode
      const layerBaseTransform: BaseTransform = {
        width: currentLayerState.width ?? 0,
        height: currentLayerState.height ?? 0,
        left: currentLayerState.left ?? 0,
        top: currentLayerState.top ?? 0,
        rotate: currentLayerState.rotate ?? 0,
      }

      let computedTransform: BaseTransform = layerBaseTransform
      if (currentEditingMode === 'individual') {
        computedTransform = decodeIndividualTransform(selectedFile, originalBaseState, layerBaseTransform)
      }

      // 2. Compute clipGroup using typed dimensions
      const currentImage = currentLayerState.image
      const containerWidth = computedTransform.width
      const containerHeight = computedTransform.height
      const containerRotate = computedTransform.rotate

      let clipGroupToApply: ClipGroup | undefined
      if (currentEditingMode === 'individual') {
        clipGroupToApply = computeIndividualModeClipGroup(
          selectedFile,
          originalClipGroup,
          originalBaseState,
          containerWidth,
          containerHeight,
          containerRotate
        )
      } else {
        // Sync mode: use originalClipGroup or current
        const currentClipGroup = currentImage && typeof currentImage === 'object' ? currentImage.clipGroup : undefined
        clipGroupToApply = originalClipGroup ?? currentClipGroup
      }

      // 3. Build image payload
      const imagePayload = buildImagePayload(currentImage, selectedFile.src, clipGroupToApply)

      // 4. Handle overlay
      const currentSettings = currentLayerState.settings || {}
      const settingsUpdate = buildSettingsWithOverlay(currentSettings, selectedFile.overlay)

      // 5. Build final update state
      const updateState = {
        ...(currentEditingMode === 'individual' ? computedTransform : {}),
        ...(imagePayload ? { image: imagePayload } : {}),
        ...(settingsUpdate ? { settings: settingsUpdate } : {}),
      }

      // 6. Dispatch if we have changes
      if (Object.keys(updateState).length) {
        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: updateState },
          skipTrace: true,
        })
        onUpdateTransformerSelection()
      }
    },
    [isMaskOption, files, onUpdateTransformerSelection, layerStore, optionSet, selectOnly]
  )

  /* Toggle selecting state for an item */
  const toggleSelecting = useCallback(
    (_id: string) => {
      // For image options: use applyOptionTransform which handles both selection and clipGroup
      if (optionSet.type === EOptionSet.IMAGE_OPTION) {
        applyOptionTransform(_id, true)
        return
      }

      // For other option types (mask options), use direct dispatch
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SELECTING',
        payload: { optionSet, _id },
        skipTrace: true,
      })

      onUpdateTransformerSelection()
    },
    [layerStore, optionSet, onUpdateTransformerSelection, applyOptionTransform]
  )

  /* Sync dimensions/coordinates of all selected items whenever layer transforms change */
  const width = useStore(layerStore, state => state.width)
  const height = useStore(layerStore, state => state.height)
  const left = useStore(layerStore, state => state.left)
  const top = useStore(layerStore, state => state.top)
  const rotate = useStore(layerStore, state => state.rotate)

  const layerTransform = useMemo(() => ({ width, height, left, top, rotate }), [width, height, left, top, rotate])

  useEffect(() => {
    // Skip in individual mode - useSyncImageOptionTransform.ts handles this properly
    // with percentage encoding and proper selection change handling.
    // This effect is only for sync mode where all options share the same transform.
    if (isEditingIndividually) return

    const selectedItems = files.filter(f => f.selecting)
    if (!selectedItems.length) return

    const { width, height, left, top, rotate } = layerTransform

    const needUpdate = selectedItems.some(item => {
      const { width: itemWidth, height: itemHeight, left: itemLeft, top: itemTop, rotate: itemRotate } = item
      return (
        width !== itemWidth || height !== itemHeight || left !== itemLeft || top !== itemTop || rotate !== itemRotate
      )
    })

    if (!needUpdate) return

    const updatedFiles = files.map(f => (f.selecting ? { ...f, width, height, left, top, rotate } : f))

    const imageOptionSetData = (optionSet as IMAGE_OPTION_SET).data
    const updatedOptionSet: OptionSet = {
      ...optionSet,
      data: {
        ...imageOptionSetData,
        files: updatedFiles,
      },
    } as IMAGE_OPTION_SET
    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: { optionSet: updatedOptionSet },
      skipTrace: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    layerTransform.width,
    layerTransform.height,
    layerTransform.left,
    layerTransform.top,
    layerTransform.rotate,
    layerTransform,
    layerStore,
    optionSetDataKey,
  ])

  const onChangeSortablelist = useCallback(
    (items: ITempImageOptionSet[]) => {
      layerStore.dispatch({
        type: 'UPDATE_OPTIONS_SORTABLE',
        payload: {
          optionSet,
          data: items,
        },
      })
    },
    [layerStore, optionSet]
  )

  const onChangeImageNameById = useCallback(
    (_id: string, data: any) => {
      const { name } = data

      layerStore.dispatch({
        type: 'UPDATE_OPTION_ITEM_TITLE',
        payload: {
          optionSet,
          _id,
          name,
        },
      })
    },
    [layerStore, optionSet]
  )

  const onDeleteImageItemById = useCallback(
    (_id: string) => {
      const deletedFile = files.find(f => f._id === _id)
      const remainingFiles = files.filter(f => f._id !== _id)

      if (deletedFile) {
        if (isMaskOption) {
          const currentMaskSrc = layerStore.getState().mask?.src
          if (currentMaskSrc === deletedFile.src && remainingFiles.length) {
            // Switch to first remaining mask
            layerStore.dispatch({
              type: 'UPDATE_LAYER',
              payload: { state: { mask: remainingFiles[0] as any } },
              skipTrace: true,
            })
          }
        } else {
          const imageState = layerStore.getState().image
          const currentImageSrc = typeof imageState === 'object' ? imageState.src || imageState.dataSrc : undefined
          if (currentImageSrc === deletedFile.src && remainingFiles.length) {
            applyOptionTransform(remainingFiles[0]._id)
          } else if (remainingFiles.length === 0) {
            revertLayerImageToOriginal(layerStore)
          }
        }
      }

      layerStore.dispatch({
        type: 'DELETE_OPTION_ITEM',
        payload: {
          optionSet,
          _id,
          context,
        },
      })
    },
    [context, layerStore, optionSet, files, isMaskOption, applyOptionTransform]
  )

  const handleTogglePricingEnabled = useCallback(
    (enabled: boolean) => {
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: {
            ...optionSet,
            additionalPricingEnabled: enabled,
          },
        },
      })
    },
    [layerStore, optionSet]
  )

  const pricingEnabled = isAdditionalPricingEnabled(optionSet)

  const onChangeImagePricingById = useCallback(
    async (_id: string, value: string) => {
      const numericValue = +value

      try {
        const newPricing = await createOptionPricing(numericValue)
        const files: (ImageOptionSet | MaskOptionSet)[] = (optionSet?.data as any)?.[optionSetDataKey] || []

        // Update the specific file's pricing
        const updatedFiles = files.map(file => (file._id === _id ? { ...file, additionalPricing: newPricing } : file))

        layerStore.dispatch({
          type: 'UPDATE_OPTION_SET',
          payload: {
            optionSet: {
              ...optionSet,
              data: {
                ...(optionSet.data as any),
                [optionSetDataKey]: updatedFiles as any,
              },
            },
          },
        })
      } catch (error) {
        console.error('Error updating option pricing:', error)
      }
    },
    [optionSet, optionSetDataKey, layerStore]
  )

  // Editing mode management (sync vs individual)
  const { confirmResetOpen, toggleEditingMode, revertTransformsAndSwitch, cancelRevert } = useEditingMode({
    layerStore,
    optionSet: optionSet as IMAGE_OPTION_SET,
    files,
    optionSetDataKey,
    isMaskOption,
    onUpdateTransformerSelection,
  })

  // Handle deleting option set
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = (confirmed?: boolean) => {
    if (confirmed !== true) {
      setConfirmDelete(true)
    } else {
      layerStore.dispatch({
        type: 'DELETE_OPTION_SET',
        payload: { optionSet },
      })

      setConfirmDelete(false)
    }
  }

  const getItemDefaultLabel = useCallback(
    (item: any, index: number): string => {
      return item.name || t('option-index', { index })
    },
    [t]
  )

  return (
    <Fragment>
      <SortableItemList
        actionsAlwaysVisible
        className="image-option-list"
        items={memoFiles}
        disabled={!optionSet?.label}
        canEditItems={editMode}
        canDeleteItems={memoFiles.length > 1}
        canAddNewItems={false}
        getItemDefaultLabel={(item: any) => getItemDefaultLabel(item, memoFiles.length)}
        onListChange={onChangeSortablelist}
        onItemChange={onChangeImageNameById}
        onDeleteItem={onDeleteImageItemById}
        onEditing={(_id: string) => applyOptionTransform(_id, true)}
        maxLabelLength={MAX_OPTION_SET_ITEM_NAME_SIZE}
        renderImage={(item: any) => (
          <InlineStack gap="100" blockAlign="center" wrap={false}>
            {editMode && (
              <span
                onClick={e => {
                  e.stopPropagation()
                }}
              >
                {isMaskOption ? (
                  <RadioButton
                    label=""
                    checked={item.selecting}
                    onChange={() => toggleSelecting(item._id)}
                    disabled={!optionSet?.label}
                    name={`mask-select-${optionSet._id}`}
                    id={`mask-${item._id}`}
                    value={item._id}
                  />
                ) : (
                  <RadioButton
                    label=""
                    checked={item.selecting}
                    onChange={() => toggleSelecting(item._id)}
                    disabled={!optionSet?.label}
                    name={`image-select-${optionSet._id}`}
                    id={`image-${item._id}`}
                    value={item._id}
                  />
                )}
              </span>
            )}
            <ImageOptionThumbnail
              id={item._id}
              src={getShopifyThumbnail(item.src)}
              name={item.name}
              overlay={item.overlay}
              compositedThumbnailSrc={item.compositedThumbnailSrc}
              hasCustomTransform={hasCustomTransform(item)}
            />
          </InlineStack>
        )}
        itemHtmlClass={`image-option-name-${editMode ? 'edit' : 'view'}${disabled ? ' image-option-name-disabled' : ''}`}
        customHeader={
          editMode && (
            <BlockStack gap="200">
              <AddMoreImageItem toggleImageSelectModal={toggleImageSelectModal} />
              {allowEditImagePricing && (
                <OptionSetPricingHeader
                  optionSet={optionSet}
                  onToggleEnabled={handleTogglePricingEnabled}
                  disabled={!optionSet?.label}
                />
              )}
              {!isMaskOption && (
                <InlineStack gap="200" align="end">
                  <Switch
                    key={!isEditingIndividually ? 'editing-individually' : 'editing-synchronously'}
                    id={`editing-mode-${optionSet._id}`}
                    checked={!isEditingIndividually}
                    onInput={toggleEditingMode}
                    label={t('edit-all-options-at-once')}
                    accessibilityLabel={!isEditingIndividually ? t('editing-individually') : t('editing-synchronously')}
                  />
                </InlineStack>
              )}
            </BlockStack>
          )
        }
        getItemError={(item: any) => {
          const errorItemKey = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, item._id)
          return getErrorMessageByKey({ keyOptionSetError: errorItemKey, layerId }, context)
        }}
        validateItem={(item: any) => {
          const { _id, name } = item
          const errorItemKey = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, _id)

          if (name.length > 0) {
            setValidationErrors(layerId, errorItemKey, null)
          } else {
            setValidationErrors(layerId, errorItemKey, OptionSetErrors.TEXT_VALUE_IS_REQUIRED)
          }
        }}
        customExtraActions={(item: any) => (
          <InlineStack gap="100" blockAlign="center" wrap={false}>
            {allowEditImagePricing && pricingEnabled && (
              <OptionSetPricingField
                item={item}
                onPricingChange={onChangeImagePricingById}
                disabled={!optionSet?.label}
              />
            )}
          </InlineStack>
        )}
      />
      {confirmDelete && (
        <Modal
          open={confirmDelete}
          title={t('delete-option-set')}
          onClose={() => setConfirmDelete(false)}
          primaryAction={{
            destructive: true,
            content: t('delete'),
            onAction: () => handleDelete(true),
          }}
          secondaryActions={[
            {
              content: t('cancel'),
              onAction: () => setConfirmDelete(false),
            },
          ]}
        >
          <Modal.Section>
            {t('are-you-sure-you-want-to-delete-the-option-set-name', { name: optionSet.label })}
          </Modal.Section>
        </Modal>
      )}
      {confirmResetOpen && (
        <Modal
          open={confirmResetOpen}
          title={t('restore-to-defaults')}
          onClose={cancelRevert}
          primaryAction={{
            content: t('restore'),
            onAction: revertTransformsAndSwitch,
          }}
          secondaryActions={[
            {
              content: t('cancel'),
              onAction: cancelRevert,
            },
          ]}
        >
          <Modal.Section>{t('editing-sync-confirm-message')}</Modal.Section>
        </Modal>
      )}
    </Fragment>
  )
}
