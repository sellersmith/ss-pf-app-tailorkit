/* eslint-disable max-lines */
import type { IconSource } from '@shopify/polaris'
import { getLayerStoreById, type TLayerStore } from '~/stores/modules/layer'
import type { LayerDocument } from '~/models/Layer.server'
import type { ErrorInfo, ReactNode, RefObject } from 'react'
import type { ISubInspector } from '~/stores/canvas/subInspector'
import type { NodeImage, OptionSet } from '~/types/psd'
import type { TemplateElementProps, TemplateElementState } from './types'
import isEqual from 'lodash/isEqual'
import cloneDeep from 'lodash/cloneDeep'
import { t } from 'i18next'
import { uuid } from '~/utils/uuid'
import { ELayerType, EOptionSet, optionSetDataKeys } from '~/types/psd'
import { mergeDeep } from '~/utils/mergeDeep'
import { getControllersOfLayer, isLayerOfTemplateVisible } from '../../fns'
import { TemplateEditorContext } from '../../context'
import { AccordionList } from '~/components/Accordion'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { createRef, Fragment, PureComponent } from 'react'
import { setObjectValueByKeyPath } from '~/bootstrap/fns/misc'
import { LayerVisibilityStore, TemplateEditorStore } from '~/stores/modules/template'
import { SubInspectorStore } from '~/stores/canvas/subInspector'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS, TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '../../constants'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { MAX_LABEL_ON_STOREFRONT, MAX_LAYER_NAME_SIZE } from '~/constants/canvas'
import { BlankIcon, LayoutColumn1Icon, PlusIcon, SkeletonIcon, TextIcon } from '@shopify/polaris-icons'
import {
  BlockStack,
  Box,
  Button,
  Divider,
  Icon,
  InlineGrid,
  InlineStack,
  Scrollable,
  Select,
  TextField,
  Tooltip,
} from '@shopify/polaris'
import ButtonGroup from '~/components/ButtonGroup'
import MultiselectCombobox from '~/components/MultiselectCombobox'

import WarningIcon from '../../components/WarningIcon'
import { EWarningIconPosition, EWarningIconType } from '../../components/WarningIcon/constants'
import { getKeyError, OptionSetErrorKeys } from '../../utilities/optionSet-fns'
import { TransformationInspector } from '../../components/Inspector/Transformation'
import { ImageRenderer } from './Image/renderer.client'
import TextFieldValidation from '../../common/text-field-validation'
import { getDefaultStorefrontLabel } from '../fns'
import { RenderElementInspectorComponent } from '../render.client'
import ContentEditableField from '~/components/common/ContentEditableField'
import { differencesObject } from '~/utils/differencesObject'
import StylingInspectorContainer from './common/StylingInspector'
import Switch from '~/components/common/Switch'
import { modalStoreActions } from '~/stores/modal'
import { MODAL_ID } from '~/constants/modal'
import { ConditionalLogicFlowModal } from './ConditionalLogicFlow/ConditionalLogicFlowModal.client'

// Define a variable to store logged error messages
const errorLogs: {
  [target: string]: {
    error: Error
    errorInfo?: ErrorInfo
  }
} = {}

export default class TemplateElement<P, S> extends PureComponent<P & TemplateElementProps, S & TemplateElementState> {
  // TODO: Child class should override the `type` to identify itself
  type: ELayerType = ELayerType.IMAGE

  // TODO: Child class should override the `optionSetType` to identify itself
  optionSetType = 'none'

  // TODO: Child class should override the `icon` to identify itself
  icon: IconSource = BlankIcon

  declare selected: boolean

  declare ref: RefObject<HTMLDivElement>

  declare props: P & TemplateElementProps

  declare forceUpdateTimer: any

  declare subInspectorKey: string

  declare unsubscribeLayerStore: () => void

  declare unsubscribeTemplateEditorStore: () => void

  declare unsubscribeSubInspectorStore: () => void

  static defaultProps: Partial<TemplateElementProps> = {
    renderContext: 'outline',
    inspectorContainerHeight: '100%',
  }

  state: S & TemplateElementState = {
    locked: false,
    visible: true,
    optionSet: null,
    settings: {},
  }

  // Use the template editor context
  static contextType = TemplateEditorContext
  declare context: React.ContextType<typeof TemplateEditorContext>

  static getDerivedStateFromError(error: Error): any {
    return { error }
  }

  static getDerivedStateFromProps(props: TemplateElementProps, state: TemplateElementState) {
    const newState = props.layerStore.getState()

    if (newState._id !== state._id || newState.locked !== state.locked || newState.visible !== state.visible) {
      return newState
    }

    return null
  }

  constructor(props: P & TemplateElementProps) {
    super(props)

    if (props.layerStore) {
      this.state = mergeDeep(this.state, props.layerStore.getState())
    }

    if (!this.state._id) {
      this.state._id = uuid()
    }

    this.ref = createRef()
  }

  render(): ReactNode {
    const { error } = this.state
    const { renderContext } = this.props

    if (error) {
      return renderContext === 'canvas' ? null : <ErrorBoundary error={error} />
    }

    switch (renderContext) {
      case 'outline': {
        // Render the element in the outline panel
        return this.renderOutline()
      }

      case 'canvas': {
        // Render the element in the editor canvas
        return this.renderCanvas()
      }

      case 'inspector': {
        // Render the element in the inspector panel
        return this.renderInspector()
      }

      case 'styling-toolbar': {
        // Render the element in the styling panel
        return this.renderStylingToolBar()
      }
    }

    return 'Missing context to render element'
  }

  /**
   * Render element in the outline context
   *
   * @returns {ReactNode}
   */
  protected renderOutline(): ReactNode {
    const { validationErrors, clickedLayerStore } = this.props
    const layerState = this.state
    const { _id } = layerState
    const clickedLayerState = clickedLayerStore?.getState()

    const isDifferentLayer = _id !== clickedLayerState?._id
    const showWarningIcon = isDifferentLayer && Object.keys(validationErrors).some(key => key.includes(_id))

    return (
      <InlineGrid gap={'100'} columns="24px 167px" alignItems="center">
        <Box width="24px">{this.renderThumbnail()}</Box>

        <div style={{ position: 'relative' }}>
          <WarningIcon
            tooltipContent={t('layer-has-issues-please-check')}
            iconType={EWarningIconType.TRIANGLE}
            position={EWarningIconPosition.BOTTOM_LEFT}
            display={showWarningIcon}
          />
          {this.renderLabel()}
        </div>
      </InlineGrid>
    )
  }

  protected renderThumbnail(): ReactNode {
    return <Icon source={this.icon} tone="base" />
  }

  protected renderLabel(): ReactNode {
    const { _id } = this.state

    return (
      <div className="SortableList-Input_Field" style={{ flexBasis: '0.8' }} data-id={_id} data-type={this.type}>
        <div className="groupable-group-item-label">
          <ContentEditableField
            title={this.getElementName()}
            maxLength={MAX_LAYER_NAME_SIZE}
            showTooltip={false}
            setTitle={value => {
              this.setData('label', value)
            }}
          />
        </div>
      </div>
    )
  }

  /**
   * Render element in the canvas context
   *
   * @returns {void}
   */
  protected renderCanvas(): ReactNode {
    const { type: elementType, layerStore, ...otherProps } = this.props
    const { _id, image, mask } = this.state
    const optionSet = this.getEditingOptionSet()

    const visible = isLayerOfTemplateVisible(
      this.state,
      this.context.layers.map((layer: TLayerStore) => layer.getState())
    )

    if (!layerStore) return null

    const baseImageSrc = image?.src || image?.dataSrc
    let resolvedMask = mask || layerStore.getState()?.mask

    const { type, data } = optionSet || {}
    if (type === EOptionSet.MASK_OPTION && data?.masks?.length) {
      resolvedMask = data?.masks?.[0]
    }

    return (
      <ImageRenderer
        key={_id}
        id={_id}
        image={baseImageSrc}
        mask={resolvedMask}
        visible={visible}
        layerStore={layerStore}
        {...otherProps}
      />
    )
  }

  /**
   * Render element in the inspector context
   *
   * @returns {void}
   */
  protected renderInspector(): ReactNode {
    // TODO: This method can be overridden by child class to customize itself in the inspector panel
    const { isInsideMultiLayout, multiLayoutLayerId, inspectorContainerHeight } = this.props

    // If the clicked layer is a layer (Text/Image) inside a multi-layout layer, render the inspector of the multi-layout layer
    if (isInsideMultiLayout && multiLayoutLayerId) {
      const multiLayoutLayerStore = getLayerStoreById(multiLayoutLayerId)

      return (
        <RenderElementInspectorComponent
          renderContext="inspector"
          multiLayoutLayerId={multiLayoutLayerId}
          layerStore={multiLayoutLayerStore}
        />
      )
    }

    // Render inspector controls for setting the element
    const optionSetInspectorMarkup = this.renderCustomizeInspector()

    // Render styling inspector
    const stylingInspectorMarkup = this.renderStylingInspector()

    // No tab list: render customize inspector directly with scrollable container
    return (
      <Scrollable style={{ height: inspectorContainerHeight }}>
        {optionSetInspectorMarkup}
        {stylingInspectorMarkup}
      </Scrollable>
    )
  }

  /**
   * Render inspector controls dedicated to the element type
   *
   * @returns {ReactNode}
   */
  protected renderCustomizeInspector(): ReactNode {
    // TODO: This method should be overridden by child class to customize itself in the inspector panel
    return (
      <AccordionList
        items={[
          {
            open: true,
            label: t('option-set'),
            id: 'option-set-inspector-controls',
            content: (
              <Box>
                {this.renderOptionSetInspector()}
                {this.renderAdvancedInspector()}
              </Box>
            ),
          },
        ]}
      />
    )
  }

  protected getOptionsForConditionalLogic(): any[] {
    // TODO: Child class should override this method to return options for creating conditional logic
    return []
  }

  protected addControlCondition = () => {
    this.setData('conditionalLogic.controls.conditions', [
      ...cloneDeep(this.state.conditionalLogic?.controls?.conditions),
      { ifOptionSelected: undefined, thenShowOrHideLayers: [] },
    ])

    LayerVisibilityStore.dispatch({ type: 'RESET_LAYER_VISIBILITY' })
  }

  protected updateControlAction = (action: 'show' | 'hide') => {
    this.setData('conditionalLogic.controls.action', action)
    LayerVisibilityStore.dispatch({ type: 'RESET_LAYER_VISIBILITY' })
  }

  protected updateControlOption = (optionId: string) => {
    const { editingCondition: index } = this.state

    if (index === undefined) {
      return
    }

    // Get current data
    const { conditionalLogic: { controls: { action = 'show', conditions = [] } = {} } = {} } = this.state
    let _conditions = cloneDeep(conditions)

    if (!_conditions?.[index]) {
      _conditions = [{ ifOptionSelected: optionId }]
    } else {
      _conditions[index].ifOptionSelected = optionId
    }

    this.setData('conditionalLogic.controls', { action, conditions: _conditions })

    // Update controlled layers
    this.updateControlledLayers()
  }

  protected updateControllerLayers = (thenShowOrHideLayers: string[], id?: number | string) => {
    const index = id || this.state.editingCondition

    if (index === undefined) {
      return
    }

    // Get current data
    const { conditionalLogic: { controls: { action = 'show', conditions = [] } = {} } = {} } = this.state
    const options = this.getOptionsForConditionalLogic()
    let _conditions = cloneDeep(conditions)

    // Set controlled layers
    if (!_conditions?.[index]) {
      _conditions = [{ ifOptionSelected: options?.[index]?._id || options?.[0]?._id, thenShowOrHideLayers }]
    } else {
      if (!_conditions[index].ifOptionSelected) {
        _conditions[index].ifOptionSelected = options?.[index]?._id || options?.[0]?._id
      }

      _conditions[index].thenShowOrHideLayers = thenShowOrHideLayers
    }

    this.setData('conditionalLogic.controls', { action, conditions: _conditions })

    // Update controlled layers
    this.updateControlledLayers()
  }

  protected toggleConditionalLogic = (enabled: boolean) => {
    const { conditionalLogic: { controls: { action = 'show' } = {} } = {} } = this.state
    const options = this.getOptionsForConditionalLogic()

    if (enabled) {
      const initialOptionId = options?.[0]?._id || ''
      const conditions = [{ ifOptionSelected: initialOptionId, thenShowOrHideLayers: [] }]
      this.setData('conditionalLogic.controls', { action, conditions })
    } else {
      this.setState({ editingCondition: undefined } as any)
      this.setData('conditionalLogic.controls.conditions', [])
    }

    this.updateControlledLayers()
  }

  protected updateControlledLayers() {
    setTimeout(() => {
      const rawLayers = this.context.layers.map(layer => layer.getState())

      this.context.layers.forEach(layer => {
        const { _id, conditionalLogic: { controls, isControlledBy } = {} } = layer.getState() || {}

        const _isControlledBy = getControllersOfLayer(_id, rawLayers)

        if (!isEqual(isControlledBy, _isControlledBy)) {
          layer.dispatch({
            type: 'UPDATE_LAYER',
            payload: {
              state: {
                conditionalLogic: { controls: controls!, isControlledBy: _isControlledBy },
              },
            },
          })

          LayerVisibilityStore.dispatch({ type: 'RESET_LAYER_VISIBILITY' })
        }
      })
    }, 100)
  }

  /**
   * Save flow builder results back to this layer's store.
   * Called by ConditionalLogicFlowModal when the user clicks Save.
   */
  protected handleFlowSave = (
    results: {
      controllerId: string
      action: 'show' | 'hide'
      conditions: { ifOptionSelected: string; thenShowOrHideLayers: string[] }[]
    }[]
  ) => {
    for (const result of results) {
      const targetStore = this.context.layers.find(ls => ls.getState()._id === result.controllerId)
      if (!targetStore) continue
      const currentState = targetStore.getState()
      targetStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            conditionalLogic: {
              isControlledBy: currentState.conditionalLogic?.isControlledBy ?? [],
              controls: { action: result.action, conditions: result.conditions },
            },
          },
        },
      })
    }
    this.updateControlledLayers()
    LayerVisibilityStore.dispatch({ type: 'RESET_LAYER_VISIBILITY' })
  }

  /**
   * Extract all selectable option values from a layer's optionSet array.
   * Includes any option type that has data.values (for flow builder name display).
   */
  private getLayerOptions(layer: any): { _id: string; name: string }[] {
    const optionSets = layer.optionSet || []
    const result: { _id: string; name: string }[] = []

    for (const os of optionSets) {
      if (!os?.data?.values) continue
      for (const val of os.data.values) {
        result.push({ _id: val._id, name: val.name || val.value || val.label || val._id })
      }
    }

    return result
  }

  protected renderConditionInspector(): ReactNode {
    const { isInsideMultiLayout, layerStore } = this.props

    if (isInsideMultiLayout) {
      return null
    }

    const { conditionalLogic } = this.state
    const rawConditions = conditionalLogic?.controls?.conditions ?? []
    const rawAction: 'show' | 'hide' = conditionalLogic?.controls?.action ?? 'show'
    const options = this.getOptionsForConditionalLogic()
    // Flow builder uses getLayerOptions which extracts option VALUES with names (not just option set IDs)
    const flowOptions = this.getLayerOptions(this.state)
    const enablingConditionalLogic = rawConditions.length > 0

    const allLayerStates = this.context.layers.map((ls: TLayerStore) => ls.getState())

    // All non-group layers (excluding self) available as targets
    const thisLayerId = this.state._id
    const allLayers = allLayerStates
      .filter(l => l.type !== 'group' && l._id !== thisLayerId)
      .map(l => ({ _id: l._id, label: l.label || l.legacyName || l._id, type: l.type }))

    // Build enriched controllerMap: which layers are controllers and their full logic info
    const controllerMap: Record<
      string,
      {
        conditionCount: number
        controlledLayerIds: string[]
        options: { _id: string; name: string }[]
        conditions: { ifOptionSelected: string; thenShowOrHideLayers: string[] }[]
        action: 'show' | 'hide'
      }
    > = {}
    for (const ls of allLayerStates) {
      const conds = ls.conditionalLogic?.controls?.conditions
      if (conds && conds.length > 0) {
        const controlledIds = new Set<string>()
        conds.forEach((c: { thenShowOrHideLayers?: string[] }) =>
          c.thenShowOrHideLayers?.forEach((id: string) => controlledIds.add(id))
        )
        controllerMap[ls._id] = {
          conditionCount: conds.length,
          controlledLayerIds: Array.from(controlledIds),
          options: this.getLayerOptions(ls),
          conditions: conds,
          action: ls.conditionalLogic?.controls?.action ?? 'show',
        }
      }
    }

    const renderSwitch = () => (
      <Switch
        label={t('enable-conditional-logic')}
        accessibilityLabel={t('enable-conditional-logic')}
        checked={enablingConditionalLogic}
        disabled={!options.length}
        onInput={() => {
          this.toggleConditionalLogic(!enablingConditionalLogic)
        }}
      />
    )

    const conditions = rawConditions?.length ? rawConditions : [{ ifOptionSelected: '', thenShowOrHideLayers: [] }]

    return (
      <Fragment>
        {!options.length ? (
          <Tooltip content={t('create-a-text-or-image-option-set-to-config-conditional-logic')}>
            <Box>{renderSwitch()}</Box>
          </Tooltip>
        ) : (
          renderSwitch()
        )}

        {enablingConditionalLogic ? (
          <BlockStack gap="400">
            <ButtonGroup
              value={rawAction}
              onChange={this.updateControlAction}
              items={[
                { label: t('show'), value: 'show' },
                { label: t('hide'), value: 'hide' },
              ]}
            />
            <TextField
              disabled
              autoComplete="off"
              value={this.getElementName()}
              label={t('layer-for-creating-condition')}
            />
            {conditions.map(
              (
                condition: { ifOptionSelected: string; thenShowOrHideLayers: string[]; _id?: string },
                index: number
              ) => {
                const { ifOptionSelected, thenShowOrHideLayers, _id } = condition
                const conditionKey = _id || ifOptionSelected || `condition-${index}`

                return (
                  <Fragment key={conditionKey}>
                    <div onClick={() => this.setState({ editingCondition: index })}>
                      <BlockStack gap="400">
                        <Select
                          label={t('if-option-selected')}
                          onChange={this.updateControlOption}
                          value={ifOptionSelected || options[index]?._id || options[0]._id}
                          options={options.map((option: any) => ({ label: option.name, value: option._id }))}
                        />
                        <MultiselectCombobox
                          t={t}
                          id={index}
                          maxTagWidth="120px"
                          maxLabelWidth="240px"
                          selected={thenShowOrHideLayers}
                          placeholder={t('search-layers')}
                          onChange={this.updateControllerLayers}
                          label={rawAction === 'show' ? t('then-show') : t('then-hide')}
                          items={(() => {
                            const allLayersState = this.context.layers.map((layer: TLayerStore) => layer.getState())
                            return allLayersState
                              .filter((layer: any) => layer._id !== this.state._id)
                              .filter((layer: any) => layer.type !== 'group')
                              .map((layer: any) => ({
                                label: layer.label || layer.legacyName || layer._id,
                                value: layer._id,
                                disabled: !isLayerOfTemplateVisible(layer, allLayersState),
                              }))
                          })()}
                          getImageSource={(item: { label: string; value: string }) => {
                            const layer = this.context.layers.find(
                              (layer: TLayerStore) => layer.getState()._id === item.value
                            )
                            const { type, image, settings, optionSet } = layer?.getState() || {}
                            if (type === ELayerType.TEXT) return TextIcon
                            if (type === ELayerType.IMAGELESS) return SkeletonIcon
                            if (type === ELayerType.MULTI_LAYOUT) return LayoutColumn1Icon
                            const imageOptionSet = optionSet?.find((os: any) => os.type === EOptionSet.IMAGE_OPTION)
                            const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
                            const files = imageOptionSet ? (imageOptionSet.data as any)?.[dataKey] || [] : []
                            const selectedOption = files.find((f: any) => f.selecting)
                            const optionCompositedThumbnailSrc = selectedOption?.compositedThumbnailSrc
                            const layerCompositedThumbnailSrc = (settings as any)?.compositedThumbnailSrc
                            return (
                              optionCompositedThumbnailSrc
                              || layerCompositedThumbnailSrc
                              || (image as NodeImage)?.src
                              || ''
                            )
                          }}
                        />
                      </BlockStack>
                    </div>
                  </Fragment>
                )
              }
            )}
            <InlineStack align="end">
              <Button variant="plain" icon={PlusIcon} onClick={() => this.addControlCondition()}>
                {t('add-condition')}
              </Button>
            </InlineStack>
            <Divider />
            <Button
              fullWidth
              variant="secondary"
              onClick={() => modalStoreActions.openModal(MODAL_ID.CONDITIONAL_LOGIC_FLOW_MODAL)}
            >
              {t('visualize-conditions')}
            </Button>
          </BlockStack>
        ) : null}

        <ConditionalLogicFlowModal
          layerStore={layerStore}
          allLayers={allLayers}
          options={flowOptions}
          action={rawAction}
          conditions={rawConditions}
          controllerMap={controllerMap}
          onSave={this.handleFlowSave}
        />
      </Fragment>
    )
  }

  protected renderOptionSetInspector(): ReactNode {
    // TODO: This method should be overridden by child class to customize itself in the inspector panel
    return <Fragment />
  }

  protected renderAdvancedInspector(): ReactNode {
    // Default Advanced inspector includes the Conditions UI
    return (
      <AccordionList
        items={[
          {
            open: false,
            id: 'advanced-settings',
            label: t('advanced'),
            content: <BlockStack gap={'400'}>{this.renderConditionInspector()}</BlockStack>,
          },
        ]}
      />
    )
  }

  protected renderStorefrontLabelInputField(optionSetType?: string): ReactNode {
    const { validationErrors, setValidationErrors } = this.context
    const defaultStorefrontLabel = getDefaultStorefrontLabel({
      t,
      type: (optionSetType as EOptionSet) || 'custom',
    })
    const { _id, settings: { storefrontLabel = defaultStorefrontLabel } = {} } = this.state
    const optionSet = this.getEditingOptionSet(optionSetType)
    const { labelOnStoreFront = storefrontLabel } = optionSet || {}

    // Storefront label error
    const labelKeyError = 'settings.storefrontLabel'
    const labelError = validationErrors?.[`${_id}-${labelKeyError}`]
    const storefrontLabelMsg = t('storefront-label-is-required')

    const handleChange = (value: string) => {
      const invalidValue = !value || (typeof value === 'string' && !value.trim())
      const newOptionSet = { ...optionSet, labelOnStoreFront: value }
      const newOptionSetList = this.getNewOptionSetList(newOptionSet)

      this.setData({ optionSet: newOptionSetList })
      setValidationErrors(_id, labelKeyError, invalidValue ? storefrontLabelMsg : null)

      setTimeout(this.forceRefreshEditorCanvas, 100)
    }

    return (
      <BlockStack gap={'200'}>
        <Divider borderWidth="025" borderColor="border" />
        <div id="label-storefront-option-set">
          <TextFieldValidation
            key={_id}
            maxLength={MAX_LABEL_ON_STOREFRONT}
            autoComplete="off"
            showCharacterCount
            value={labelOnStoreFront}
            requiredIndicator
            label={t('set-label-to-show-on-storefront')}
            placeholder={t('input-your-label')}
            error={labelError}
            onBlur={e => {
              const value = (e?.target as HTMLInputElement).value || defaultStorefrontLabel
              handleChange(value)
            }}
            onChange={value => {
              handleChange(value)
            }}
            onValidate={(value: string) => {
              const invalidValue = !value || (typeof value === 'string' && !value.trim())
              setValidationErrors(_id, labelKeyError, invalidValue ? storefrontLabelMsg : null)
            }}
          />
        </div>
      </BlockStack>
    )
  }

  protected renderCreateClipart(): ReactNode {
    return null
    // const layerStore = this.props.layerStore
    // return <ClipartsInspector defaultOpen={false} layerStores={[layerStore]} />
  }

  protected renderOptionSetList(_optionSetType?: string): ReactNode {
    // TODO: Child class should override this method to render appropriate option set
    return <Fragment />
  }

  /**
   * Render inspector controls related to transformable elements
   *
   * @returns {ReactNode}
   */
  protected renderStylingToolBar(): ReactNode {
    return (
      <InlineStack gap={'200'} wrap={false} blockAlign="center">
        {this.renderTransformationInspector()}
      </InlineStack>
    )
  }

  protected renderStylingInspector(): ReactNode {
    return <StylingInspectorContainer id={'styling-inspector'} element={this} />
  }

  renderTransformationInspector(): ReactNode {
    // TODO: This method can be overridden by child class to customize itself in the inspector panel
    return <TransformationInspector />
  }

  forceUpdate(callback?: (() => void) | undefined): void {
    if (this.forceUpdateTimer) {
      clearTimeout(this.forceUpdateTimer)
    }

    this.forceUpdateTimer = setTimeout(() => super.forceUpdate(callback), 100)
  }

  protected updateState = (state: LayerDocument) => {
    this.setState(mergeDeep(this.state, state))
    this.forceUpdate()
  }

  protected updateViewPort = () => this.forceUpdate()

  protected updateSubInspector = (state: ISubInspector) => {
    this.subInspectorKey = state.key

    this.forceUpdate()
  }

  public getEditingOptionSet = (optionSetTypeProp?: string) => {
    const optionSetType = optionSetTypeProp || this.optionSetType
    const optionSet = (this.state.optionSet || []).find((option: any) => option.type === optionSetType)

    return optionSet
  }

  protected getAddButtonsStatus = (optionSetTypeProp?: string) => {
    const optionSet = this.getEditingOptionSet(optionSetTypeProp)
    const { optionSetEditingState } = this.state
    const editingState = optionSetEditingState?.[optionSet.type]

    return (
      editingState || {
        newOptionSetPressed: false,
        existOptionSetPressed: false,
        editMode: false,
      }
    )
  }

  protected setAddButtonStatus = (statusUpdated: any, optionSetType?: string) => {
    const { layerStore } = this.props
    const editingOptionSet = this.getEditingOptionSet(optionSetType)
    const editingState = this.getAddButtonsStatus(optionSetType)
    const newStatus = mergeDeep(editingState, statusUpdated)

    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET_EDITING_STATE',
      payload: { optionSetType: editingOptionSet?.type, editingState: newStatus },
    })
  }

  protected clearOptionSetValidationErrors = (optionSet: OptionSet) => {
    const { setValidationErrors } = this.context
    const { _id: layerId } = this.state

    const keyLabelStoreFrontError = getKeyError(optionSet, OptionSetErrorKeys.LABEL_STORE_FRONT)
    const keyOptionSetLabelError = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_LABEL)
    const keyOptionSetDataError = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_DATA)
    const keyOptionSetDataOptionError = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_DATA_OPTION)

    // Clear errors about the option set
    ;[keyLabelStoreFrontError, keyOptionSetLabelError, keyOptionSetDataError, keyOptionSetDataOptionError].forEach(
      key => {
        this.setError(key, null)
        setValidationErrors(layerId, key, null)
      }
    )

    // Clear errors about the option set items
    const optionSetDataKey = optionSetDataKeys[optionSet.type as keyof typeof optionSetDataKeys]
    const optionSetItems = (optionSet.data as any)?.[optionSetDataKey] || []

    if (optionSetItems.length > 0) {
      optionSetItems.forEach((item: any) => {
        const keyOptionSetItemNameError = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, item._id)

        this.setError(keyOptionSetItemNameError, null)
        setValidationErrors(layerId, keyOptionSetItemNameError, null)
      })
    }
  }

  protected getNewOptionSetList = (newOptionSet: OptionSet) => {
    const { optionSet: allOptionSetsOfLayer } = this.props.layerStore.getState()

    if (allOptionSetsOfLayer && allOptionSetsOfLayer.length > 0) {
      return allOptionSetsOfLayer.map((baseOption: OptionSet) =>
        baseOption._id === newOptionSet._id ? newOptionSet : baseOption
      )
    }

    return [newOptionSet]
  }

  /**
   * Update transformer position and dimension after stretching
   */
  public updateTransformer = () => {
    setTimeout(() => {
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
    }, 100)
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Set component error
    this.setError('runtime', error, errorInfo)

    // Log the error to console
    console.error(error, errorInfo)
  }

  componentDidMount(): void {
    // Add type to legacy layer
    const { layerStore } = this.props

    if (!layerStore.getState().type) {
      layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: { type: this.type } } })
    }

    // Subscribe to layer store for state update
    this.unsubscribeLayerStore = this.props.layerStore?.subscribe(this.updateState)

    // Subscribe to template editor store for viewport update
    this.unsubscribeTemplateEditorStore = TemplateEditorStore.subscribe(this.updateViewPort)

    // Subscribe to subInspector store for state update
    this.unsubscribeSubInspectorStore = SubInspectorStore?.subscribe(this.updateSubInspector)
  }

  // args: prevProps: Readonly<any>, prevState: Readonly<any>, snapshot?: any
  componentDidUpdate(): void {
    // Clear previous component error as it is updated successfully
    this.setError(this.state._id, null)
  }

  componentWillUnmount(): void {
    // Unsubscribe from layer store
    this.unsubscribeLayerStore?.()

    // Unsubscribe from template editor store
    this.unsubscribeTemplateEditorStore?.()

    // Unsubscribe from subInspector store selection
    this.unsubscribeSubInspectorStore?.()
  }

  protected forceRefreshEditorCanvas() {
    // Force the interaction handler to re-render so elements that display
    // the storefront label on the editor canvas can work properly.
    const { scale, left, top } = TemplateEditorStore.getState().viewport

    TemplateEditorStore.dispatch({
      type: 'SET_VIEW_PORT',
      payload: {
        viewport: { scale, left, top },
      },
      skipTrace: true,
    })
  }

  private getElementName(layerStore?: TLayerStore) {
    const { _id, label, legacyName } = layerStore?.getState() || this.state

    return label || legacyName || _id
  }

  public setData(
    key: string | object,
    value?: any,
    validateCallback?: string | ((value?: any) => string | undefined)
  ): void {
    const { _id } = this.state
    const { onChange } = this.props

    // Validate input
    if (typeof key === 'string' && validateCallback) {
      this.validateData(key, value, validateCallback)
    }

    // Generate new state
    if (typeof key === 'string' && key.indexOf('.')) {
      // Generate new state from key path and value
      key = setObjectValueByKeyPath({}, key, value)
    }

    const newState = typeof key === 'string' ? { [key]: value } : mergeDeep(this.state, key)

    // Define callback function to do some post update tasks
    const callback = () => {
      this.syncDataToLayerStore()

      // Execute callback function if provided
      if (typeof onChange === 'function') {
        onChange(_id, newState)
      }

      const transmitterData = {
        id: _id,
        elementData: newState,
      }

      // Let others know that the element data of the element has been changed
      Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, transmitterData)
    }

    // Update component state
    this.setState(newState, callback)

    if (typeof key === 'object') {
      this.forceUpdate(callback)
    }
  }

  protected validateData(key: string, value: any, validateCallback?: string | ((value?: any) => string | undefined)) {
    const isValidateCallbackFn = typeof validateCallback === 'function'

    const invalid = isValidateCallbackFn
      ? validateCallback(value)
      : typeof value === 'string' && !value && !value.trim()

    if (invalid) {
      // Set validation error
      this.setError(key, new Error(isValidateCallbackFn ? (invalid as string) : validateCallback))
    } else {
      // Clear previous validation error as it is passed now
      this.setError(key, null)
    }

    return this.getError(key)
  }

  protected syncDataToLayerStore(notifyListeners: boolean = true) {
    const { layerStore } = this.props

    // Update data in the provided layer store
    if (layerStore) {
      const { error, ...elementData } = this.state
      const currentState = layerStore.getState()

      const diff = differencesObject(currentState, elementData)

      // Return if there is no difference
      if (!Object.keys(diff).length) {
        return
      }

      layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: elementData } }, notifyListeners)
    }
  }

  protected getError(dataKey: string): { error: Error | null; errorInfo?: ErrorInfo } {
    const { _id } = this.state
    const key = `${_id}-${dataKey}`

    return errorLogs[key]
  }

  protected setError(dataKey: string, error: Error | null, errorInfo?: ErrorInfo) {
    const { _id } = this.state
    const key = `${_id}-${dataKey}`
    const { onValidation } = this.props

    if (!error) {
      if (errorLogs[key]) {
        delete errorLogs[key]

        if (typeof onValidation === 'function') {
          onValidation(_id, key, null)
        }
      }
    } else {
      errorLogs[key] = { error, errorInfo }

      if (typeof onValidation === 'function') {
        onValidation(_id, key, error)
      }
    }
  }
}
