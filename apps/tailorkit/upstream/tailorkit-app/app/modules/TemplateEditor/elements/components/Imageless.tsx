import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { ELayerType, EOptionSet, IMAGELESS_OPTION_TYPE } from '~/types/psd'
import type { IMAGELESS_OPTION_SET, LayerType } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import TemplateElement from '.'
import SortableItemList from '~/modules/SortableItemList'
import ImageSelector from '~/modules/modals/ImageSelector'
import { t } from 'i18next'
import { uuid } from '~/utils/uuid'
import { OptionSetErrors } from '~/constants/errors'
import { AccordionList, type AccordionProps } from '~/components/Accordion'
import { SkeletonIcon, ImageAddIcon } from '@shopify/polaris-icons'
import { validateOptionSet } from '../hooks/useValidateOptionSetData'
import { BlockStack, Box, Text, Thumbnail } from '@shopify/polaris'
import { getShopifyThumbnail } from '~/utils/loadImage'
import OptionSetPricingField from '~/components/OptionSetPricingField'
import OptionSetPricingHeader from '~/components/OptionSetPricingHeader'
import { ImagelessPricingWrapper } from '~/components/ImagelessPricingHandler'
import { getDefaultStorefrontLabel } from '../fns'
import OptionSetDisplayType from './common/OptionSetDisplayType'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { isAdditionalPricingEnabled } from '~/utils/optionSet-pricing'

/**
 * Functional bridge to fire feature tracking from this class component.
 * Class components can't use hooks directly, so we inject this functional
 * component to access useFeatureTracking.
 */
function ImagelessFeatureTracker() {
  const tracking = useFeatureTracking('imageless_option_set')
  const hasTrackedRef = useRef(false)
  useEffect(() => {
    if (!hasTrackedRef.current) {
      tracking.trackStarted()
      hasTrackedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default class ImagelessElement extends TemplateElement<void, void> {
  type: LayerType = ELayerType.IMAGELESS
  icon = SkeletonIcon

  optionSetType: string = EOptionSet.IMAGELESS_OPTION

  protected renderCanvas(): ReactNode {
    // Don't need to render imageless elements on canvas
    return null
  }

  private getImagelessItems() {
    return [
      {
        open: true,
        label: t('imageless'),
        id: 'imageless-inspector-controls',
        content: (
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd" tone="subdued">
              {t('imageless-elements-stay-hidden-but-control-layer-visibility-and-settings-like-sizes-or-gift-cards')}
            </Text>
            {this.renderOptionSetInspector()}
          </BlockStack>
        ),
      },
    ] as AccordionProps[]
  }

  private getAdvancedItems() {
    return [
      {
        open: false,
        id: 'advanced-settings',
        label: t('advanced'),
        content: <BlockStack gap={'400'}>{this.renderConditionInspector()}</BlockStack>,
      },
    ] as AccordionProps[]
  }

  protected renderCustomizeInspector(): ReactNode {
    const accordionItems = [...this.getImagelessItems(), ...this.getAdvancedItems()]

    return (
      <BlockStack>
        <ImagelessFeatureTracker />
        <AccordionList
          exclusiveOpen={true}
          groupId="imageless-inspector"
          defaultOpenId="imageless-inspector-controls"
          items={accordionItems}
        />
      </BlockStack>
    )
  }

  protected handleTogglePricingEnabled = (enabled: boolean) => {
    const { layerStore } = this.props
    const optionSet = this.getEditingOptionSet()

    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: {
          ...optionSet,
          additionalPricingEnabled: enabled,
        },
      },
    })

    this.setState({ optionSet: layerStore.getState().optionSet })
  }

  protected renderOptionSetInspector(): ReactNode {
    const { layerStore } = this.props

    const { _id, imageSelectorModalActive, settings: { storefrontLabel = t('enter-message') } = {} } = this.state

    const optionSet = this.getEditingOptionSet()
    const defaultStorefrontLabel = getDefaultStorefrontLabel({ t, type: optionSet?.type })
    const { labelOnStoreFront = storefrontLabel || defaultStorefrontLabel } = optionSet || {}

    const options = this.getOptionsForConditionalLogic()
    const isCheckbox = (optionSet?.data as IMAGELESS_OPTION_SET['data'])?.displayStyle === 'imageless_checkbox'
    const pricingEnabled = isAdditionalPricingEnabled(optionSet)

    return (
      <Fragment>
        <BlockStack gap="400">
          {this.renderStorefrontLabelInputField(EOptionSet.IMAGELESS_OPTION)}
          <OptionSetDisplayType layerStore={layerStore} optionSetEditing={optionSet} />
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              {t('option-list')}
            </Text>
            <Box background="bg" borderRadius="200" padding={'200'}>
              <ImagelessPricingWrapper
                layerStore={layerStore}
                optionSet={optionSet}
                onStateUpdate={newState => this.setState(newState)}
              >
                {({ onChangeImagelessPricingById }) => (
                  <SortableItemList
                    items={options}
                    onAddItem={this.addOption}
                    canAddNewItems={!isCheckbox}
                    getItemDefaultLabel={(item: any) =>
                      this.getItemDefaultLabel(item, this.getOptionsForConditionalLogic().length)
                    }
                    disabled={!labelOnStoreFront}
                    canDeleteItems={options.length > 1}
                    onDeleteItem={this.deleteOption}
                    onItemChange={this.updateOption}
                    addNewItemLabel={t('add-option')}
                    onListChange={this.updateOptionList}
                    itemHtmlClass={`image-option-name-edit${!labelOnStoreFront ? ' image-option-name-disabled' : ''}`}
                    customHeader={
                      <OptionSetPricingHeader
                        optionSet={optionSet}
                        onToggleEnabled={this.handleTogglePricingEnabled}
                        disabled={!labelOnStoreFront}
                      />
                    }
                    customThumb={(item: any) =>
                      item.name ? (
                        <div
                          style={{
                            overflow: 'hidden',
                            borderStyle: 'solid',
                            borderColor: 'var(--p-color-border)',
                            borderWidth: 'var(--p-border-width-025)',
                            borderRadius: 'var(--p-border-radius-150)',
                          }}
                          onClick={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            this.setState({ imageSelectorModalActive: true, targetOptionId: item._id })
                          }}
                        >
                          {item.thumbnail ? (
                            <Thumbnail
                              source={getShopifyThumbnail(item.thumbnail)}
                              alt="option thumbnail"
                              size="extraSmall"
                            />
                          ) : (
                            <Thumbnail source={ImageAddIcon} alt="option thumbnail" size="extraSmall" />
                          )}
                        </div>
                      ) : null
                    }
                    onEditing={() => {
                      layerStore.dispatch({
                        type: 'UPDATE_OPTION_SELECTING',
                        payload: {
                          optionSet: {
                            ...optionSet,
                            type: EOptionSet.IMAGELESS_OPTION,
                          },
                          _id,
                        },
                      })
                    }}
                    customExtraActions={(item: any) =>
                      pricingEnabled ? (
                        <OptionSetPricingField
                          item={item}
                          onPricingChange={onChangeImagelessPricingById}
                          disabled={!labelOnStoreFront}
                        />
                      ) : null
                    }
                  />
                )}
              </ImagelessPricingWrapper>
            </Box>
          </BlockStack>
        </BlockStack>
        <ImageSelector
          allowMultiple={false}
          active={imageSelectorModalActive}
          onSelectImage={this.setOptionThumbnail}
          onClose={() => this.setState({ imageSelectorModalActive: false })}
        />
      </Fragment>
    )
  }

  protected renderStylingToolBar(): ReactNode {
    // Imageless elements don't have styling
    return null
  }

  protected getItemDefaultLabel(item: any, index: number): string {
    return item.name || t('option-index', { index })
  }

  protected addOption = (skipTrace?: boolean) => {
    const { layerStore } = this.props
    const optionSet = this.getEditingOptionSet()
    const newItem = {
      _id: uuid(),
      name: this.getItemDefaultLabel({}, this.getOptionsForConditionalLogic().length + 1),
      value: '',
      selecting: false,
    }

    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: {
          ...optionSet,
          data: {
            values: [...this.getOptionsForConditionalLogic(), newItem],
          },
        },
      },
      skipTrace,
    })

    this.setState({ optionSet: layerStore.getState().optionSet })

    return newItem
  }

  protected deleteOption = (_id: string) => {
    const { layerStore } = this.props
    const optionSet = this.getEditingOptionSet()

    layerStore.dispatch({
      type: 'DELETE_OPTION_ITEM',
      payload: {
        optionSet,
        _id,
        context: this.context,
      },
    })

    this.setState({ optionSet: layerStore.getState().optionSet })
  }

  protected updateOption = (_id: string, data: any) => {
    const { name } = data
    const { layerStore } = this.props
    const optionSet = this.getEditingOptionSet()

    layerStore.dispatch({
      type: 'UPDATE_OPTION_ITEM_TITLE',
      payload: {
        optionSet,
        _id,
        name,
      },
    })

    this.setState({ optionSet: layerStore.getState().optionSet })
  }

  protected setOptionThumbnail = (images: IImageQuery[] | null) => {
    const { layerStore } = this.props
    const { targetOptionId: _id } = this.state

    const optionSet = this.getEditingOptionSet()
    const thumbnail = images?.[0].image.originalSrc || ''

    layerStore.dispatch({
      type: 'UPDATE_IMAGELESS_OPTION_THUMB',
      payload: {
        optionSet,
        _id,
        thumbnail,
      },
    })

    this.setState({ optionSet: layerStore.getState().optionSet })
  }

  protected updateOptionList = (options: any[], skipTrace?: boolean) => {
    const { layerStore } = this.props
    const optionSet = this.getEditingOptionSet()

    this.props.layerStore.dispatch({
      type: 'UPDATE_OPTIONS_SORTABLE',
      payload: {
        optionSet,
        data: options,
      },
      skipTrace,
    })

    this.setState({ optionSet: layerStore.getState().optionSet }, () => {
      // Validate option list
      let dataError = null
      let labelError = null

      const layerId = this.state._id
      const keyDataError = `optionSet_text.data`

      const optionSet = this.getEditingOptionSet()
      const { validationErrors, setValidationErrors } = this.context

      const { hasLabel, labelOnStoreFront, emptyNameItemExists, hasValidTextOptions, keyLabelStoreFrontError }
        = validateOptionSet({ layerId, optionSet, keyDataError }, { validationErrors })

      if (!hasValidTextOptions || emptyNameItemExists) {
        dataError = emptyNameItemExists ? null : OptionSetErrors.MISSING_OPTION_ADDED
      } else if (hasValidTextOptions && hasLabel) {
        labelError = labelOnStoreFront ? null : OptionSetErrors.MISSING_STORE_FRONT_LABEL
      }

      setValidationErrors(layerId, keyDataError, dataError)
      setValidationErrors(layerId, keyLabelStoreFrontError, labelError)
    })
  }

  protected getOptionsForConditionalLogic(): any[] {
    return this.getEditingOptionSet()?.data?.[IMAGELESS_OPTION_TYPE] || []
  }
}
