/* eslint-disable max-lines */
import { BlockStack, Box, Button } from '@shopify/polaris'
import { LayoutColumn1Icon, PlusIcon } from '@shopify/polaris-icons'
import { t } from 'i18next'
import { Fragment, type ReactNode } from 'react'
import { AccordionList } from '~/components/Accordion'
import { LAYER_DUPLICATED_GAP, MAX_LAYOUT_NUMBER_SIZE } from '~/constants/canvas'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore, deleteLayerStores, getLayerStoreById } from '~/stores/modules/layer'
import { getCheckedLayerStores, LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStoreActions } from '~/stores/modules/template'
import type { LayerType, Layout, MultiLayoutOptionSet, OptionSet } from '~/types/psd'
import { ELayerType, EOptionSet } from '~/types/psd'
import { generateNumberThumbnail } from '~/utils/generateNumberThumbnail'
import { uuid } from '~/utils/uuid'
import TemplateElement from '..'
import { RenderElementCanvasComponent } from '../../render.client'
import OptionSetDisplayType from '../common/OptionSetDisplayType'
import LabelOnStoreFront from './LabelOnStoreFront'
import LayoutManager from './LayoutManager'
import LayoutNumber from './LayoutNumber'
import ImageSelector from '~/modules/modals/ImageSelector'
import { type IImageQuery } from '~/types/shopify-files'
import SelectLayerCardDrawer from './LayoutManager/LayersSelectionDrawer'
import { type LayerDocument } from '~/models/Layer.server'
import cloneDeep from 'lodash/cloneDeep'
import { evaluateLayerPositionAfterDeletingAllLayout, getDefaultStorefrontLabel } from '../../fns'

export default class MultiLayoutElement extends TemplateElement<void, void> {
  type: LayerType = ELayerType.MULTI_LAYOUT
  icon = LayoutColumn1Icon

  // Error keys
  storefrontLabelKeyError = 'settings.storefrontLabel'
  layoutNumberKeyError = 'settings.layoutNumber'
  creatingLayoutKeyError = 'multiLayout.creatingLayout'

  protected renderStylingToolBar(): ReactNode {
    return null
  }

  protected getExtractedLayerStore(): TLayerStore[] {
    const extractedLayerStores = TemplateEditorStoreActions.getExtractedLayerStores()

    return extractedLayerStores
  }

  protected getMultiLayoutElementId() {
    return this.state._id
  }

  protected getOriginalLayersSelected() {
    const multiLayoutOptionSetData = this.getMultiLayoutOptionSetData()

    return multiLayoutOptionSetData.originalLayersSelected
  }

  protected getLayoutSelected() {
    const multiLayoutOptionSetData = this.getMultiLayoutOptionSetData()

    const layoutSelected = multiLayoutOptionSetData.layouts.find(
      layout => layout._id === multiLayoutOptionSetData.layoutSelected
    )

    return layoutSelected
  }

  protected getLayouts() {
    const multiLayoutOptionSetData = this.getMultiLayoutOptionSetData()

    const layouts = multiLayoutOptionSetData.layouts

    return layouts
  }

  protected getMultiLayoutOptionSetData() {
    const multiLayoutOptionSet = this.getMultiLayoutOptionSet()!

    // @ts-ignore
    return multiLayoutOptionSet.data.multi_layout
  }

  protected getAllLayersSourceByLayouts(layouts: Layout[]) {
    return layouts
      .map(layout =>
        layout.layerIds
          .filter(layerId => Boolean(getLayerStoreById(layerId)))
          .map(layerId => getLayerStoreById(layerId).getState())
      )
      .flat()
  }

  protected getLayoutNumber() {
    const multiLayoutOptionSetData = this.getMultiLayoutOptionSetData()

    return multiLayoutOptionSetData.layoutNumber
  }

  protected getLayoutIdSelected() {
    const multiLayoutOptionSetData = this.getMultiLayoutOptionSetData()

    return multiLayoutOptionSetData.layoutSelected
  }

  protected getMultiLayoutOptionSet() {
    const { optionSet } = this.state

    const multiLayoutOptionSet = (optionSet as OptionSet[]).find(ot => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)

    return multiLayoutOptionSet
  }

  protected setExtractedLayerStore(stores: TLayerStore[]) {
    TemplateEditorStoreActions.setExtractedLayerStores(stores)
  }

  protected setLayoutNumber(layoutNumber: MultiLayoutOptionSet['layoutNumber']) {
    this.setSpecificOptionSetData({
      layoutNumber,
    })
  }

  protected setOriginalLayersSelected(_originalLayersSelected: string[]) {
    this.setSpecificOptionSetData({
      originalLayersSelected: _originalLayersSelected,
    })
  }

  protected setLayouts(layouts: MultiLayoutOptionSet['layouts']) {
    this.setSpecificOptionSetData({
      layouts,
    })
  }

  protected setLayoutSelected(id: MultiLayoutOptionSet['layoutSelected']) {
    this.setSpecificOptionSetData(
      {
        layoutSelected: id,
      },
      true
    )
  }

  protected setLayoutsAndLayoutSelected(
    layouts: MultiLayoutOptionSet['layouts'],
    layoutSelected: MultiLayoutOptionSet['layoutSelected'],
    skipTrace = false
  ) {
    this.setSpecificOptionSetData(
      {
        layouts,
        layoutSelected,
      },
      skipTrace
    )
  }

  protected setSpecificOptionSet(
    updatedSpecificOptionSet: Extract<OptionSet, { type: EOptionSet.MULTI_LAYOUT_OPTION }>,
    skipTrace = false
  ) {
    const { optionSet } = this.state
    const { layerStore } = this.props

    const _optionSet = optionSet.map((ot: any) => {
      if (ot.type === updatedSpecificOptionSet.type) {
        return updatedSpecificOptionSet
      }

      return ot
    })

    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: { state: { optionSet: _optionSet } },
      skipTrace,
    })
  }

  protected setSpecificOptionSetData(_multiLayoutOptionSetData: Partial<MultiLayoutOptionSet>, skipTrace = false) {
    const multiLayoutOptionSet = this.getMultiLayoutOptionSet()!
    const multiLayoutOptionSetData = this.getMultiLayoutOptionSetData()

    this.setSpecificOptionSet(
      {
        ...multiLayoutOptionSet,
        data: { multi_layout: { ...multiLayoutOptionSetData, ..._multiLayoutOptionSetData } },
      },
      skipTrace
    )
  }

  protected deleteLayersByIds(layerIds: string[]) {
    const extractedLayerStores = this.getExtractedLayerStore()
    const filteredStores = extractedLayerStores.filter(layerStore => !layerIds.includes(layerStore.getState()._id))

    // Delete all layers in extracted layer stores
    this.setExtractedLayerStore(filteredStores)

    // Delete layer stores also
    deleteLayerStores(layerIds)
  }

  protected renderLayers(layerIds?: string[]) {
    const { previewMode } = this.props

    return [...(layerIds || [])].reverse().map(layerId => {
      const layerStore = getLayerStoreById(layerId)

      if (!layerStore) return null

      const { _id, type } = layerStore.getState()

      return <RenderElementCanvasComponent key={_id} layerStore={layerStore} type={type} previewMode={previewMode} />
    })
  }

  // Render phrase
  protected renderCanvas(): ReactNode {
    const { visible } = this.state

    if (!visible) return null

    const layoutSelected = this.getLayoutSelected()
    const layouts = this.getLayouts()

    if (!layoutSelected || !layouts.length) {
      const originalLayersSelected = this.getOriginalLayersSelected()

      // Render original layers if having no layouts
      return this.renderLayers(originalLayersSelected)
    }

    const layerIds = layoutSelected.layerIds

    // Render layers of layout selected
    return this.renderLayers(layerIds)
  }

  // protected renderStylingInspector(): ReactNode {
  //   const clickedLayerStore = LayerStoreSelection.getState()?.clickedLayerStore
  //   const clickedLayerType = clickedLayerStore?.getState()?.type as ELayerType

  //   if (clickedLayerType && [ELayerType.IMAGELESS].includes(clickedLayerType)) {
  //     return null
  //   }

  //   return (
  //     <RenderElementInspectorComponent
  //       {...this.props}
  //       showTabHeaders={false}
  //       layerStore={clickedLayerStore}
  //       defaultSelectedTab={2}

  //     />
  //   )
  // }

  protected renderCustomizeInspector(): ReactNode {
    return (
      <Box>
        {this.renderCreateClipart()}

        <AccordionList
          exclusiveOpen={true}
          groupId="multilayout-inspector"
          defaultOpenId="option-set-inspector-controls"
          items={[
            {
              open: true,
              label: t('multi-layout'),
              id: 'option-set-inspector-controls',
              content: (
                <BlockStack gap={'400'}>
                  {this.renderLabelOnStorefront()}

                  <OptionSetDisplayType
                    layerStore={this.props.layerStore}
                    optionSetEditing={this.getMultiLayoutOptionSet()!}
                  />

                  {this.renderNumberOfLayout()}

                  {this.renderLayoutManager()}
                </BlockStack>
              ),
            },
          ]}
        />
      </Box>
    )
  }

  protected renderLabelOnStorefront() {
    const { validationErrors, setValidationErrors } = this.context
    const { layerStore } = this.props
    const { _id, settings } = this.state
    const defaultLabelOnStoreFront = getDefaultStorefrontLabel({ t, type: EOptionSet.MULTI_LAYOUT_OPTION })
    const { storefrontLabel = defaultLabelOnStoreFront } = settings || {}

    // Storefront label error
    const labelKeyError = this.storefrontLabelKeyError
    const labelError = validationErrors?.[`${_id}-${labelKeyError}`]
    const storefrontLabelMsg = t('storefront-label-is-required')

    const onValidate = (value: string) => {
      const invalidValue = !value || (typeof value === 'string' && !value.trim())
      setValidationErrors(_id, labelKeyError, invalidValue ? storefrontLabelMsg : null)
    }

    const onChangeStorefrontLabel = (storefrontLabel: string) => {
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { settings: { ...settings, storefrontLabel } } },
      })
      onValidate(storefrontLabel)
      setTimeout(this.forceRefreshEditorCanvas, 100)
    }

    const onBlurHandler = (e: React.FocusEvent) => {
      const realValue = ((e?.target as HTMLInputElement).value || '').trim() || defaultLabelOnStoreFront
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { settings: { ...settings, storefrontLabel: realValue } } },
      })
      onValidate(realValue)

      setTimeout(this.forceRefreshEditorCanvas, 100)
    }

    return (
      <LabelOnStoreFront
        value={storefrontLabel}
        onChange={onChangeStorefrontLabel}
        onBlur={onBlurHandler}
        error={labelError}
        onValidate={onValidate}
      />
    )
  }

  protected renderNumberOfLayout() {
    const { validationErrors, setValidationErrors } = this.context
    const { _id } = this.state
    const layouts = this.getLayouts()
    const layoutNumber = (layouts.length || this.getLayoutNumber()).toString()

    // Layout number error
    const layoutNumberKeyError = this.layoutNumberKeyError
    const layoutNumberError = validationErrors?.[`${_id}-${layoutNumberKeyError}`]

    const disabled = !!layouts.length

    const onValidate = (value: string) => {
      let errorMessage = null

      if (Number(value) <= 0) {
        errorMessage = t('the-number-of-layout-must-be-greater-than-0')
      } else if (Number(value) > MAX_LAYOUT_NUMBER_SIZE) {
        errorMessage = t('the-number-of-layout-must-be-less-than-count', { count: MAX_LAYOUT_NUMBER_SIZE })
      }

      setValidationErrors(_id, layoutNumberKeyError, errorMessage)
    }

    const onBlurHandler = (e: React.FocusEvent) => {
      const value = ((e?.target as HTMLInputElement).value || '').trim() || '1'
      const _value = Number(value) <= 0 ? 1 : Number(value)
      onValidate(_value.toString())
    }

    const onChangeLayoutNumber = (value: string) => {
      let _value = value
      if (!_value || Number(_value) <= 0) {
        _value = _value + 1
      }
      this.setLayoutNumber(Number(_value))
      onValidate(_value.toString())

      setTimeout(this.forceRefreshEditorCanvas, 100)
    }

    return (
      <LayoutNumber
        value={layoutNumber}
        disabled={disabled}
        onChange={onChangeLayoutNumber}
        onBlur={onBlurHandler}
        error={layoutNumberError}
        onValidate={onValidate}
      />
    )
  }

  protected renderAddMoreLayout() {
    const onClickHandler = () => {}

    return (
      <Button variant="plain" icon={PlusIcon} onClick={onClickHandler}>
        {t('add-layout')}
      </Button>
    )
  }

  protected refineConditionalLogicForClonedLayers(
    layers: TLayerStore[],
    layerMapping: { [key: string]: any },
    currentBatchMapping?: { [key: string]: any }
  ) {
    // Refine cloned layers to keep conditional logic from the origin layers
    // Use currentBatchMapping if provided (for clone batches), otherwise use layerMapping (for initial layers)
    const mappingToUse = currentBatchMapping || layerMapping

    for (let i = 0; i < layers.length; i++) {
      // Update controlled layers defined in conditions
      const conditionalLogic = cloneDeep(layers[i].getState().conditionalLogic)
      const { controls: { action = 'show', conditions } = {}, isControlledBy = [] } = conditionalLogic || {}

      if (conditions?.length) {
        conditions.forEach((condition, index) => {
          const { thenShowOrHideLayers } = condition

          if (thenShowOrHideLayers?.length) {
            conditions[index].thenShowOrHideLayers = thenShowOrHideLayers.map(layerId =>
              mappingToUse[layerId] ? mappingToUse[layerId] : layerId
            )
          }
        })

        layers[i].dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: { conditionalLogic: { controls: { action, conditions }, isControlledBy } } },
        })
      }
    }

    return layers
  }

  protected renderLayoutManager() {
    const {
      imageSelectorModalActive,
      selectedLayerIds = [],
      activeSubInspector = false,
      layerIdSelected = '',
      _id: layerId,
    } = this.state

    const layoutNumber = this.getLayoutNumber()
    const layoutSelected = this.getLayoutIdSelected()

    const layouts = this.getLayouts()

    if (!layoutNumber || layoutNumber < 0 || layoutNumber > MAX_LAYOUT_NUMBER_SIZE) return <Fragment />

    const onDuplicateLayer = (opts: { _id: string; gap?: number; isStatic?: boolean; nth?: number }) => {
      const { _id, gap = 0, isStatic, nth } = opts
      const newId = uuid()

      const originLayer = getLayerStoreById(_id)
      const originLayerState = originLayer.getState()
      const { left, top, label, legacyName, settings, optionSet, shapeSettings } = originLayerState

      // Refine storefront option set label for cloned layers
      const storefrontOptionSetLabels: any = {}

      if (optionSet?.length) {
        optionSet?.forEach(
          os => (storefrontOptionSetLabels[os.type] = `${os.labelOnStoreFront || settings?.storefrontLabel} #${nth}`)
        )
      }

      // For text-customers layers, also add to storefrontOptionSetLabels to match option sets behavior
      const isTextCustomer = originLayerState.type === 'text' && settings?.textCreatedBy === 'customers'
      if (isTextCustomer && nth && settings?.storefrontLabel) {
        storefrontOptionSetLabels['text_customer'] = `${settings.storefrontLabel} #${nth}`
      }

      const updatedSettings = { ...settings, storefrontOptionSetLabels }

      // @ts-ignore
      const clonedLayer = createLayerStore({
        ...originLayerState,
        // Set visible to true to show the layer in layout
        visible: true,
        _id: newId,
        left: (left || 0) + gap,
        top: (top || 0) + gap,
        ...(isStatic !== undefined ? { isStatic } : {}),
        ...(nth
          ? {
              label: `${label || legacyName} #${nth}`,
              settings: updatedSettings,
              shapeSettings: { ...shapeSettings, label: `${shapeSettings?.label} #${nth}` },
            }
          : {}),
        clonedBy: originLayerState.clonedBy || _id,
      })

      const clonedLayerId = clonedLayer.getState()._id

      // Verify the cloned layer exists in the global Map
      const verifiedStore = getLayerStoreById(clonedLayerId)

      return verifiedStore
    }

    const createLayouts = (layerIds: string[], layoutNumber = 1) => {
      const layouts = []
      const layerMapping: { [key: string]: any } = {}

      for (let index = 0; index < layoutNumber; index++) {
        // Do-not move this init layers line out of layout block because each layers is independent of each layout
        const clonedLayers: TLayerStore[] = []

        const initialLayers = layerIds.map(id => {
          const layer = onDuplicateLayer({ _id: id, nth: index ? 1 : 0 })
          const newLayerId = layer.getState()._id

          // Verify the cloned layer exists in the global Map
          const verifiedLayer = getLayerStoreById(newLayerId)
          layerMapping[id] = newLayerId

          clonedLayers.push(verifiedLayer)

          return verifiedLayer
        })

        // Refine cloned layers to keep conditional logic from the origin layers
        this.refineConditionalLogicForClonedLayers(clonedLayers, layerMapping)

        // Duplicate the initial layers based on the current index
        for (let j = 0; j < index; j++) {
          const clonedLayers: TLayerStore[] = []
          // Create a mapping for this clone batch: original layer ID -> cloned layer ID in this batch
          const currentBatchMapping: { [key: string]: any } = {}

          for (const layerId of layerIds) {
            // Transform the clone layer a GAP to make layers visible and split.
            const clonedLayer = onDuplicateLayer({ _id: layerId, gap: LAYER_DUPLICATED_GAP * (j + 1), nth: 2 + j })
            const clonedLayerId = clonedLayer.getState()._id

            // Verify the cloned layer exists
            const verifiedLayer = getLayerStoreById(clonedLayerId)

            // Map original layer ID to cloned layer ID in this batch
            currentBatchMapping[layerId] = clonedLayerId

            clonedLayers.push(verifiedLayer)
          }

          // Refine cloned layers to keep conditional logic from the origin layers
          // Use currentBatchMapping so each cloned layer references layers from its own batch
          this.refineConditionalLogicForClonedLayers(clonedLayers, layerMapping, currentBatchMapping)

          initialLayers.push(...clonedLayers)
        }

        // Validate that all original layers were successfully duplicated
        const layoutLayerIds = initialLayers.map(layerStore => layerStore.getState()._id)
        layouts.push({
          _id: uuid(),
          name: `${index + 1}`,
          layerIds: layoutLayerIds,
          thumbnail: generateNumberThumbnail(index + 1),
        })
      }

      // Delete all layers in extracted layer stores
      this.deleteLayersByIds(layerIds)

      return layouts
    }

    // Function to count the occurrences of each 'clonedBy' value across all layers in the current layouts
    const groupCounterAllLayers = () => {
      // Retrieve the current layouts
      const currentLayouts = this.getLayouts()
      // Get all layers from the source based on the current layouts
      const allLayersOfFilteredLayouts = this.getAllLayersSourceByLayouts(currentLayouts)

      // Use reduce to group and count layers by their 'clonedBy' property
      const groupClonedBy = allLayersOfFilteredLayouts.reduce(
        (groupClonedBy: { [key: string]: number }, layer: LayerDocument) => {
          const clonedBy = layer.clonedBy
          if (clonedBy) {
            if (!groupClonedBy[clonedBy]) {
              groupClonedBy[clonedBy] = 0
            }
            groupClonedBy[clonedBy]++
          }

          return groupClonedBy
        },
        {}
      )

      // Return the grouped count of 'clonedBy' values
      return groupClonedBy
    }

    // Function to retrieve layers that can be reverted from a specific layout
    const checkAndRevertFromLayout = (layerIds: string[]) => {
      // Get the grouped count of 'clonedBy' values for all layers
      const groupClonedBy = groupCounterAllLayers()
      const layersBaseStore: TLayerStore[] = []

      // Iterate through the layers in the layout, starting from the last layer
      layerIds.forEach(layerId => {
        const layerStore = getLayerStoreById(layerId)

        if (!layerStore) {
          return
        }

        const layerState = layerStore.getState()
        const clonedBy = layerState.clonedBy

        // If the layer was cloned, check if it's the only one left with the same 'clonedBy'
        if (clonedBy) {
          if (groupClonedBy[clonedBy] === 1) {
            // If it's the last one, add it to the layers that can be reverted
            layersBaseStore.push(layerStore)
          }

          // Decrement the counter for that 'clonedBy' value
          groupClonedBy[clonedBy]--
        }
      })

      if (layersBaseStore.length) {
        const currentExtractedLayerStore = this.getExtractedLayerStore()

        const _extractedLayerStores = evaluateLayerPositionAfterDeletingAllLayout(
          currentExtractedLayerStore,
          layersBaseStore
        )

        // Re-evaluate extracted layer stores
        this.setExtractedLayerStore(_extractedLayerStores)
      }
    }

    // Re-evaluate the thumbnail of layouts
    const onRevaluateThumbnailNumbers = (_layout: Layout[]) => {
      const _layouts: Layout[] = _layout.map((_layout, index) => {
        const thumbnail = _layout.thumbnail

        return {
          ..._layout,
          thumbnail: thumbnail.includes('<svg') ? generateNumberThumbnail(index + 1) : thumbnail,
        }
      })

      return _layouts
    }

    const autoClickOnFirstLayerOfLayoutSelected = (layouts: Layout[], layoutId: string) => {
      const layout = layouts.find(layout => layout._id === layoutId)

      // If there is no layout, clear the selection
      if (!layout) {
        return LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: {
            clickedLayerStore: null,
            checkedLayerStores: [],
          },
        })
      }

      const firstLayerId = layout.layerIds[0]
      const firstLayerStore = getLayerStoreById(firstLayerId)

      if (!firstLayerStore) return

      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: firstLayerStore,
          checkedLayerStores: [],
        },
      })
    }

    const onDeleteLayout = (layoutId: string, layersToDelete: string[]) => {
      const currentLayouts = this.getLayouts()

      // Find the layout by id
      const layout = currentLayouts.find(layout => layout._id === layoutId)

      if (!layout) return

      // If all layers in the layout are being deleted, remove the layout
      if (layersToDelete.length === layout.layerIds.length) {
        // Exclude the layout deleted out of list
        const filteredLayouts = currentLayouts.filter(_layout => _layout !== layout)
        const lastFilteredLayoutId = filteredLayouts[filteredLayouts.length - 1]?._id

        // Set layers of final layout back to outline if there is no layout in the list.
        checkAndRevertFromLayout(layersToDelete)

        // Mutate the layouts and layouts selected
        const layoutsAfterRevaluatingThumbnailNumbers = onRevaluateThumbnailNumbers(filteredLayouts)

        this.setLayoutsAndLayoutSelected(layoutsAfterRevaluatingThumbnailNumbers, lastFilteredLayoutId)

        autoClickOnFirstLayerOfLayoutSelected(layoutsAfterRevaluatingThumbnailNumbers, lastFilteredLayoutId)
      } else {
        // Only remove the specified layers from the layout
        const updatedLayouts = currentLayouts.map(_layout => {
          if (_layout._id === layoutId) {
            return {
              ..._layout,
              layerIds: _layout.layerIds.filter(id => !layersToDelete.includes(id)),
            }
          }
          return _layout
        })

        // Set layers back to outline
        checkAndRevertFromLayout(layersToDelete)

        // Update layouts without re-evaluating numbers since we're not deleting a layout
        this.setLayoutsAndLayoutSelected(updatedLayouts, layoutId)

        autoClickOnFirstLayerOfLayoutSelected(updatedLayouts, layoutId)
      }
    }

    const onCreateLayouts = (layerIds: string[]) => {
      const { setValidationErrors } = this.context
      const layouts = createLayouts(layerIds, layoutNumber)

      // Select first layout by default
      const firstLayout = layouts[0]._id

      // Mutate the layouts and layouts selected
      this.setLayoutsAndLayoutSelected(layouts, firstLayout)

      setValidationErrors(this.state._id, this.creatingLayoutKeyError, null)

      // Clear original layers selected
      // TODO: Investigate why needing to setting timeout
      setTimeout(() => {
        this.setOriginalLayersSelected([])
      }, 16)
    }

    const onCancel = () => {
      const { layerStore } = this.props
      const { _id, settings } = this.state
      const { setValidationErrors } = this.context

      // Reset storefront label
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...settings,
              storefrontLabel: getDefaultStorefrontLabel({ t, type: EOptionSet.MULTI_LAYOUT_OPTION }),
            },
          },
        },
      })

      // Reset layout number
      this.setLayoutNumber(0)

      // Creating layout error
      const creatingLayoutKeyError = this.creatingLayoutKeyError
      const layoutNumberKeyError = this.layoutNumberKeyError

      setValidationErrors(_id, creatingLayoutKeyError, null)
      setValidationErrors(_id, layoutNumberKeyError, t('the-number-of-layout-must-be-greater-than-0'))

      setTimeout(this.forceRefreshEditorCanvas, 16)
    }

    const onChangeLayoutSelected = (layoutId: string) => {
      const layoutSelected = this.getLayoutSelected()
      const layerIds = layoutSelected?.layerIds || []

      const excludedCheckedLayerStores = getCheckedLayerStores().filter(
        checkedLayerStore => !layerIds.includes(checkedLayerStore.getState()._id)
      )
      // Exclude layer ids selected on canvas out of checked layer store
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          checkedLayerStores: excludedCheckedLayerStores,
        },
      })

      this.setLayoutSelected(layoutId)
    }

    const onChangeLayersOrderOfLayout = (layoutId: string, layerIds: Layout['layerIds']) => {
      const multiLayoutOptionSetData = this.getMultiLayoutOptionSetData()

      const _layouts = multiLayoutOptionSetData.layouts.map(layout => {
        if (layout._id === layoutId) {
          return {
            ...layout,
            layerIds,
          }
        }

        return layout
      })

      // Re-order the layout
      this.setLayouts(_layouts)
    }

    const onClickLayer = (layerId: string) => {
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: getLayerStoreById(layerId),
        },
      })
    }

    const onChangeNameLayerSelected = (layerId: string, value: string) => {
      const layerStore = getLayerStoreById(layerId)
      layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: { label: value } } })
    }

    const onAddMoreLayout = () => {
      const layouts = this.getLayouts()

      // Get layers of first layout
      const firstLayout = layouts[0]
      const layerIds = firstLayout.layerIds

      const layerMapping: { [key: string]: any } = {}
      const layers = layerIds.map(_id => getLayerStoreById(_id))

      // Do-not move this init layers line out of layout block because each layers is independent of each layout
      const clonedLayers: TLayerStore[] = []

      const initialLayers = layerIds.map(id => {
        const layer = onDuplicateLayer({ _id: id, nth: 1 })
        layerMapping[id] = layer.getState()._id

        clonedLayers.push(layer)

        return layer
      })

      // Refine cloned layers to keep conditional logic from the origin layers
      this.refineConditionalLogicForClonedLayers(clonedLayers, layerMapping)

      // Duplicate the initial layers based on the current index
      for (let j = 0; j < layouts.length; j++) {
        const clonedLayers: TLayerStore[] = []

        layerIds.forEach(layerId => {
          // Transform the clone layer a GAP to make layers visible and split.
          const clonedLayer = onDuplicateLayer({ _id: layerId, gap: LAYER_DUPLICATED_GAP * (j + 1), nth: 2 + j })
          layerMapping[layerId] = clonedLayer.getState()._id

          clonedLayers.push(clonedLayer)
        })

        // Refine cloned layers to keep conditional logic from the origin layers
        this.refineConditionalLogicForClonedLayers(clonedLayers, layerMapping)

        initialLayers.push(...clonedLayers)
      }

      // Get all the indices of static layers
      const staticIndices = layers
        .map((layer, index) => (layer.getState().isStatic ? index : -1))
        .filter(index => index !== -1)

      // Filter out all static layers except the group one
      const filteredLayers = initialLayers.filter((layer, index) => {
        const layerState = layer.getState()
        const { isStatic } = layerState

        return !isStatic || staticIndices.includes(index)
      })

      layouts.push({
        _id: uuid(),
        name: `${layouts.length + 1}`,
        layerIds: filteredLayers.map(filterLayer => filterLayer.getState()._id),
        thumbnail: generateNumberThumbnail(layouts.length + 1),
      })

      // Mutate the layouts
      this.setLayouts(layouts)
    }

    const onAddStaticLayers = (_layerIds: string[]) => {
      const layouts = this.getLayouts()

      // Loop through layouts to insert static layers into each layout
      const _layouts = layouts.map(layout => {
        const layerIds = layout.layerIds

        // Do-not move this loop outside of layout block, because each duplicated layer of each layout block is independent.
        const duplicatedLayers = _layerIds.map(
          layerId => onDuplicateLayer({ _id: layerId, isStatic: true }).getState()._id
        )

        return {
          ...layout,
          layerIds: [...duplicatedLayers, ...layerIds],
        }
      })

      // Mutate the layouts
      this.setLayouts(_layouts)

      // Delete all layers in extracted layer stores
      this.deleteLayersByIds(_layerIds)
    }

    const getLayoutsAfterUpdated = (data: any) => {
      const multiLayoutOptionSetData = this.getMultiLayoutOptionSetData()

      const _layouts = multiLayoutOptionSetData.layouts.map(layout => {
        if (layout._id === layoutSelected) {
          return {
            ...layout,
            ...data,
          }
        }

        return layout
      })

      return _layouts
    }

    const onChangeNameLayoutSelected = (name: string) => {
      const _layouts = getLayoutsAfterUpdated({ name })

      // Re-order the layout
      this.setLayoutsAndLayoutSelected(_layouts, layoutSelected)
    }

    const toggleSelectThumbnailModal = () => {
      this.setState({ imageSelectorModalActive: !imageSelectorModalActive })
    }

    const onSelectLayoutThumbnail = (image: IImageQuery[] | null) => {
      if (image && image.length > 0) {
        const src = image[0].image.originalSrc
        const _layouts = getLayoutsAfterUpdated({ thumbnail: src })

        // Re-order the layout
        setTimeout(() => this.setLayoutsAndLayoutSelected(_layouts, layoutSelected), 100)
      }
    }

    const toggleActiveSubInspector = () => {
      this.setState({ activeSubInspector: !activeSubInspector })
    }

    const onChangeLayer = (layerId: string) => {
      this.setState({ layerIdSelected: layerId })

      setTimeout(() => toggleActiveSubInspector(), 20)
    }

    const onDeleteLayer = (layerId: string) => {
      const layoutSelectedData = this.getLayoutSelected()
      const layerIds = layoutSelectedData?.layerIds?.filter(id => layerId !== id) || []

      const _layouts = getLayoutsAfterUpdated({ layerIds })

      // Find the layout by id
      const currentLayouts = this.getLayouts()
      const layout = currentLayouts.find(layout => layout._id === layoutSelected)

      if (layout) {
        // Set layers of final layout back to outline if there is no layout in the list.
        checkAndRevertFromLayout([layerId])

        this.setLayoutsAndLayoutSelected(_layouts, layoutSelected)

        // Clean up LayerStoreSelection by removing the deleted layer
        const checkedLayerStores = getCheckedLayerStores()
        const clickedLayerStore = LayerStoreSelection.getState().clickedLayerStore
        const clickedLayerId = clickedLayerStore?.getState()?._id

        // Filter out the deleted layer from checkedLayerStores
        const updatedCheckedLayerStores = checkedLayerStores.filter((ls: TLayerStore) => ls.getState()._id !== layerId)

        // Clear clickedLayerStore if it's the deleted layer
        const shouldClearClickedLayer = clickedLayerId === layerId

        LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: {
            checkedLayerStores: updatedCheckedLayerStores,
            ...(shouldClearClickedLayer ? { clickedLayerStore: null } : {}),
          },
        })
      }
    }

    const onSelectLayersHandler = (selectedLayerIds: string[]) => {
      if (selectedLayerIds.length > 0) {
        const layoutSelectedData = this.getLayoutSelected()
        const layerIds = layoutSelectedData?.layerIds || []

        // Clone this layer with new id
        const clonedLayer = onDuplicateLayer({ _id: selectedLayerIds[0] })

        // Replace this layer with the clone layer
        const newLayerIds = layerIds.map(layerId =>
          layerId === layerIdSelected ? clonedLayer.getState()._id : layerId
        )
        const _layouts = getLayoutsAfterUpdated({ layerIds: newLayerIds })

        setTimeout(() => {
          // Set layers of final layout back to outline if there is no layout in the list.
          checkAndRevertFromLayout([layerIdSelected])
          this.deleteLayersByIds(selectedLayerIds)

          this.setLayoutsAndLayoutSelected(_layouts, layoutSelected)
          this.setState({ selectedLayerIds: [] })

          toggleActiveSubInspector()
        }, 20)
      }
    }

    const checkExistedLayerHasNoOptionSet = (layerIds: string[]) => {
      return layerIds.every(id => {
        const state = getLayerStoreById(id).getState()
        const { optionSet } = state

        // if (type === 'text') {
        //   const { shapeSettings } = state

        //   if (shapeSettings?.enableForCustomers) {
        //     // Return false to mark as this layer has option set is setting text shape
        //     return false
        //   }
        // }

        return optionSet?.every(ot => !ot.data)
      })
    }

    const onNavigateToOutlineToCreateOptionSet = (selectedLayers: string[], callback: () => void) => {
      callback()

      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: getLayerStoreById(selectedLayers[0]),
          checkedLayerStores: selectedLayers.map(id => getLayerStoreById(id)),
        },
      })
    }

    const onChangeOriginalLayersSelected = (_originalLayersSelected: string[]) => {
      this.setOriginalLayersSelected(_originalLayersSelected)
    }

    const onAddLayersForCreatingLayout = (_originalLayersSelected: MultiLayoutOptionSet['originalLayersSelected']) => {
      const originalLayersSelected = this.getOriginalLayersSelected()

      const mergedLayers = Array.from(new Set([..._originalLayersSelected, ...originalLayersSelected]))

      // Set original layer ids
      this.setOriginalLayersSelected(mergedLayers)

      const extractedLayerStores = this.getExtractedLayerStore()

      const filteredStores = extractedLayerStores.filter(
        layerStore => !_originalLayersSelected.includes(layerStore.getState()._id)
      )

      // Delete layers from extracted layer store (do not delete in layerStores instance)
      this.setExtractedLayerStore(filteredStores)
    }

    const onDeleteOriginalLayersSelected = (layerId: string) => {
      const currentExtractedLayerStore = this.getExtractedLayerStore()

      const _extractedLayerStores = evaluateLayerPositionAfterDeletingAllLayout(currentExtractedLayerStore, [
        getLayerStoreById(layerId),
      ])

      // Re-evaluate extracted layer stores
      this.setExtractedLayerStore(_extractedLayerStores)
    }

    return (
      <Fragment>
        <LayoutManager
          layerId={layerId}
          multiLayoutElementId={this.getMultiLayoutElementId()}
          originalLayersSelected={this.getOriginalLayersSelected()}
          layouts={layouts}
          layoutSelected={layoutSelected}
          creatingLayout={this.state.creatingLayout}
          toggleSelectThumbnailModal={toggleSelectThumbnailModal}
          onCreate={onCreateLayouts}
          onCancel={onCancel}
          onAddLayersForCreatingLayout={onAddLayersForCreatingLayout}
          onDeleteLayout={onDeleteLayout}
          onChangeLayoutSelected={onChangeLayoutSelected}
          onChangeLayersOrderOfLayout={onChangeLayersOrderOfLayout}
          onClickLayer={onClickLayer}
          onChangeNameLayerSelected={onChangeNameLayerSelected}
          onAddStaticLayers={onAddStaticLayers}
          onAddMoreLayout={onAddMoreLayout}
          onChangeNameLayoutSelected={onChangeNameLayoutSelected}
          onChangeOriginalLayersSelected={onChangeOriginalLayersSelected}
          onDeleteOriginalLayersSelected={onDeleteOriginalLayersSelected}
          onChangeLayer={onChangeLayer}
          onDeleteLayer={onDeleteLayer}
          checkExistedLayerHasNoOptionSet={checkExistedLayerHasNoOptionSet}
          onNavigateToOutlineToCreateOptionSet={onNavigateToOutlineToCreateOptionSet}
        />

        <ImageSelector
          active={imageSelectorModalActive}
          onSelectImage={onSelectLayoutThumbnail}
          allowMultiple={false}
          onClose={toggleSelectThumbnailModal}
        />

        <SelectLayerCardDrawer
          selectedLayers={selectedLayerIds}
          setSelectedLayers={(_selectedLayerIds: any) =>
            this.setState({
              selectedLayerIds:
                typeof _selectedLayerIds === 'function' ? _selectedLayerIds(selectedLayerIds) : _selectedLayerIds,
            })
          }
          activeDrawer={activeSubInspector}
          toggleDrawer={toggleActiveSubInspector}
          onDone={onSelectLayersHandler}
          allowMultiple={false}
        />
      </Fragment>
    )
  }

  protected renderConditionInspector(): ReactNode {
    // Multi-layout element should not be used to create conditional logic
    return null
  }
}
