import { BlockStack, Box, Divider, Icon, InlineStack, Thumbnail, Text, Tooltip } from '@shopify/polaris'
import { ImageIcon, LightbulbIcon } from '@shopify/polaris-icons'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { t } from 'i18next'
import { Fragment, type ReactNode } from 'react'
import { AccordionList } from '~/components/Accordion'
import ButtonGroup from '~/components/ButtonGroup'
import { addImageOptions } from '~/modules/TemplateEditor/components/Navigation/OptionSetDrawer/Options/ImageOption/fns'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import type { ImageSettings, LayerType } from '~/types/psd'
import { ELayerType, EOptionSet } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import { getShopifyThumbnail } from '~/utils/loadImage'
import TemplateElement from '..'
import { UploadImages } from '../../../components/Navigation/OptionSetDrawer/Options/ImageOption'
import ImageOptionListView from '../../../components/Navigation/OptionSetDrawer/Options/ImageOption/ImageOptionListView'
import type { TemplateElementProps } from '../types'
import OverflowToolbar from '~/components/OverflowToolbar'
import LayerActionButtons from '../../../components/Editor/LayerActionButtons'
import BuildOptionSetImageWithAI from './BuildOptionSetImageWithAI'
import StorefrontLabelInputField from '../common/StorefrontLabelInputField'
import ImageUploaderOption from './ImageUploaderOption'
import OptionSetConfiguration from '../common/OptionSetConfiguration'
import MaskOptionListView from '../../../components/Navigation/OptionSetDrawer/Options/ImageOption/MaskOptionListView'
import { DEFAULT_HIDE_WHEN_PRINTING, DEFAULT_INCLUDE_FILTER_PRESETS_IN_PRINT } from '~/constants/inspector/text'
import { BackgroundRemoval } from './ToolBar/BackgroundRemoval'
import { getDefaultStorefrontLabel } from '../../fns'
import Switch from '~/components/common/Switch'
import { AI_IMAGE_EDIT_LIMITS } from '~/routes/api.ai-assistant.suggestion/constants'
import { findNearestAspectRatio } from 'extensions/tailorkit-src/src/shared/libraries/template/calculateLayerRatio'
import { VectorConversion } from './ToolBar/VectorConversion'
import { VectorEdit } from './ToolBar/VectorEdit'
import { ImageRemix } from './ToolBar/ImageRemix'
import { VectorWizardModal } from './ToolBar/VectorWizardModal'
import { VectorEditorModal } from './ToolBar/VectorEditorModal'
import { isSvgImage } from '~/utils/file-types'
import { SelectOptionBanner } from './SelectOptionBanner'
import { ImageTutorialBanner } from './ImageTutorialBanner'

export default class ImageElement<P, S> extends TemplateElement<P & TemplateElementProps, S> {
  type: LayerType = ELayerType.IMAGE
  icon = ImageIcon

  protected renderCanvas(): ReactNode {
    // Generate data source for the text layer
    Object.assign(this.state, {
      image: {
        ...this.state.image,
        src: this.renderImageLayerToDataSource(),
      },
      mask: this.renderMaskImageToLayerDataSource(),
    })

    return super.renderCanvas()
  }

  protected renderImageLayerToDataSource() {
    const optionSetType = EOptionSet.IMAGE_OPTION
    const { image } = this.state

    const imageOptionSet = this.getEditingOptionSet(optionSetType)

    // Prepare image to render
    let imageSrc = image?.src || image?.dataSrc

    const { type, data } = imageOptionSet || {}

    if (type === optionSetType && data?.files?.length) {
      const selected = data?.files?.find((file: any) => file.selecting)
      imageSrc = selected?.src || selected?.dataSrc || imageSrc
    }

    return imageSrc
  }

  protected renderMaskImageToLayerDataSource() {
    const optionSetType = EOptionSet.MASK_OPTION

    const maskOptionSet = this.getEditingOptionSet(optionSetType)
    const masks = maskOptionSet?.data?.masks || []

    // Default to first mask if none selected
    let mask = masks[0]

    if (masks.length) {
      const selected = masks.find((m: any) => m.selecting)
      if (selected) {
        mask = selected
      }
    }

    return mask
  }

  protected renderThumbnail(): ReactNode {
    const { image, settings } = this.state

    const src = image?.src || image?.dataSrc

    // Check for composited thumbnail from current image option
    const imageOptionSet = this.getEditingOptionSet(EOptionSet.IMAGE_OPTION)
    const selectedOption = imageOptionSet?.data?.files?.find((f: any) => f.selecting)
    const optionCompositedThumbnailSrc = selectedOption?.compositedThumbnailSrc

    // Check for composited thumbnail from layer settings (when no option set)
    const layerCompositedThumbnailSrc = (settings as any)?.compositedThumbnailSrc

    // Priority: 1) option composited thumbnail, 2) layer composited thumbnail, 3) original image
    const thumbnailSrc = optionCompositedThumbnailSrc || layerCompositedThumbnailSrc || src

    if (thumbnailSrc) {
      return <Thumbnail source={getShopifyThumbnail(thumbnailSrc)} size="extraSmall" alt={t('element-thumbnail')} />
    }

    return super.renderThumbnail()
  }

  private getImageOptionSetItems() {
    const optionSetType = EOptionSet.IMAGE_OPTION
    const { layerStore, previewMode } = this.props
    const layerState = this.state
    const optionSetEditing = this.getEditingOptionSet(optionSetType)
    const defaultStorefrontLabel = getDefaultStorefrontLabel({ t, type: optionSetEditing.type })
    const buttonsStatus = this.getAddButtonsStatus(optionSetType)

    const isEditMode = buttonsStatus.editMode

    // Check if current image is an SVG - unified settings with isVectorImage flag
    const { image } = this.state
    const isVectorImage = isSvgImage(image?.src)

    // Get enable states from settings with defaults
    const settings = layerState.settings as ImageSettings
    const enableBuyerImage
      = settings?.enableBuyerImage
      ?? settings?.imageUploaderOptions?.allowCustomerGenerateImageWithAI
      ?? settings?.imageUploaderOptions?.allowCustomerUploadImage
      ?? false

    const enableSellerImage
      = settings?.enableSellerImage ?? settings?.imageUploaderOptions?.allowCustomerUseImageOptionSet ?? false

    /**
     * UI state for radio button selection.
     * Derived directly from backend flags (source of truth).
     *
     * Priority for backward compatibility:
     * 1. If enableBuyerImage=true && enableSellerImage=false → 'customers'
     * 2. If enableSellerImage=true && enableBuyerImage=false → 'merchant'
     * 3. If neither is set but IMAGE_OPTION has data → auto-set 'merchant' (seller's image)
     *    This handles cliparts with pre-configured option sets where flags weren't explicitly set.
     * 4. Otherwise → undefined (no selection)
     */
    const imageCreatedBy: 'merchant' | 'customers' | undefined = (() => {
      if (enableBuyerImage && !enableSellerImage) return 'customers'
      if (enableSellerImage && !enableBuyerImage) return 'merchant'

      // Auto-detect: if neither flag is set but IMAGE_OPTION was configured
      // (data is non-null, meaning it's not the default empty state),
      // default to seller's image. This handles cliparts and templates where
      // the option set was set up before the enableSellerImage/enableBuyerImage flags existed.
      const imageOptionSet = (layerState.optionSet || []).find((os: any) => os.type === EOptionSet.IMAGE_OPTION)
      if (imageOptionSet?.data !== null && imageOptionSet?.data !== undefined) {
        // Persist the flag outside render to avoid dispatch-during-render anti-pattern
        queueMicrotask(() => {
          layerStore.dispatch({
            type: 'UPDATE_LAYER',
            payload: {
              state: {
                settings: {
                  ...settings,
                  enableSellerImage: true,
                  enableBuyerImage: false,
                },
              },
            },
          })
        })
        return 'merchant'
      }

      return undefined
    })()

    const onSelectImages = (mediaFiles: IImageQuery[]) => {
      addImageOptions(mediaFiles, this.props.layerStore, optionSetEditing)

      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE)
    }

    const checkValidLabelStoreFront = () => {
      const layerSettings = layerState.settings as ImageSettings & {
        storefrontOptionSetLabels: { [key: string]: string }
      }
      const imageUploaderOptions = layerSettings?.imageUploaderOptions

      // Check layer override first, then fall back to optionSet label
      const storefrontLabel
        = layerSettings?.storefrontOptionSetLabels?.[optionSetEditing.type] || optionSetEditing?.labelOnStoreFront
      const hasStoreFrontLabel = Boolean(storefrontLabel)

      const { allowCustomerUploadImage, allowCustomerGenerateImageWithAI } = imageUploaderOptions || {}
      // Check if any imageUploaderOption is enabled
      const hasImageUploaderOptionsEnabled = allowCustomerUploadImage || allowCustomerGenerateImageWithAI

      // Check if option set has label or files
      const hasOptionSetData = optionSetEditing
        ? optionSetEditing.label || (optionSetEditing.data?.files?.length && optionSetEditing.data.files.length > 0)
        : false

      // Require storefront label if any imageUploaderOption is enabled OR option set has data
      const requiresStoreFrontLabel = hasImageUploaderOptionsEnabled || hasOptionSetData

      // If storefront label is required, check if it exists
      // If not required, validation passes
      return requiresStoreFrontLabel ? hasStoreFrontLabel : true
    }

    /**
     * Handle imageCreatedBy radio button selection.
     * Sets backend flags (enableBuyerImage/enableSellerImage) mutually exclusively.
     * User configs nested options via checkboxes inside each section.
     */
    const handleImageCreatedByChange = (value: 'merchant' | 'customers') => {
      // Update both flags in a single operation to avoid race conditions
      this.setData('settings', {
        ...layerState.settings,
        enableSellerImage: value === 'merchant',
        enableBuyerImage: value === 'customers',
      })
    }

    return [
      {
        open: true,
        id: 'personalize-image-inspector',
        label: t('personalize-image'),
        content: (
          <BlockStack gap={'400'}>
            <Divider />
            <StorefrontLabelInputField
              disabled={!isEditMode}
              layerState={layerState}
              optionSetEditing={optionSetEditing}
              defaultStorefrontLabel={optionSetEditing.labelOnStoreFront || defaultStorefrontLabel}
              onValidate={checkValidLabelStoreFront}
            />

            {/*
              UI Pattern: Radio buttons for mutually exclusive selection
              Similar to Text personalization's textCreatedBy pattern
              See: app/modules/TemplateEditor/elements/components/Text/index.tsx
            */}
            <BlockStack gap="300">
              <ButtonGroup
                value={imageCreatedBy || ''}
                label={t('image-is-created-by')}
                onChange={handleImageCreatedByChange}
                items={[
                  {
                    label: t('buyer-s-image'),
                    value: 'customers',
                    id: 'image-by-customer-btn',
                    helpText: t('buyers-image-help-text'),
                  },
                  {
                    label: t('seller-s-image'),
                    value: 'merchant',
                    id: 'image-by-merchant-btn',
                    helpText: t('sellers-image-help-text'),
                  },
                ]}
              />

              {/* Conditional sections controlled by imageCreatedBy - no animation like Text component */}
              {imageCreatedBy === 'customers' && (
                <Fragment>
                  <Text variant="bodyMd" as="span">
                    {t('allow-buyers-to-upload-their-own-image-or-generate-with-ai')}
                  </Text>
                  <ImageUploaderOption
                    layerStore={layerStore}
                    previewMode={previewMode}
                    isVectorImage={isVectorImage}
                  />
                </Fragment>
              )}

              {imageCreatedBy === 'merchant' && (
                <Fragment>
                  <Text variant="bodyMd" as="span">
                    {t('provide-preset-image-options-for-buyers-to-choose-from')}
                  </Text>
                  {/* Banner shown when trying to edit image in individual mode without selection */}
                  <SelectOptionBanner layerStore={layerStore} />
                  <OptionSetConfiguration
                    layerState={layerState}
                    optionSetEditing={optionSetEditing}
                    buttonsStatus={buttonsStatus}
                    showStorefrontLabelInputField={false}
                    renderOptionSetList={this.renderImageOptionSetList()}
                    renderBuildWithAI={
                      <BuildOptionSetImageWithAI
                        onSelectImages={onSelectImages}
                        generativeOptions={{
                          ...(layerState?.settings?.generativeOptions || {}),
                          aspectRatio:
                            (layerState?.settings?.generativeOptions as any)?.aspectRatio
                            || findNearestAspectRatio(
                              { width: this.state.width, height: this.state.height },
                              AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS as unknown as string[]
                            ).label
                            || '1:1',
                        }}
                      />
                    }
                    setButtonsStatus={this.setAddButtonStatus}
                    clearOptionSetValidationErrors={this.clearOptionSetValidationErrors}
                  />
                </Fragment>
              )}
            </BlockStack>
          </BlockStack>
        ),
      },
    ]
  }

  private getMaskOptionSetItems() {
    const optionSetType = EOptionSet.MASK_OPTION
    const layerState = this.state
    const optionSetEditing = this.getEditingOptionSet(optionSetType)
    const buttonsStatus = this.getAddButtonsStatus(optionSetType)

    return [
      {
        open: false,
        id: 'personalize-mask-inspector',
        label: t('personalize-mask'),
        content: (
          <BlockStack gap={'400'}>
            <OptionSetConfiguration
              layerState={layerState}
              optionSetEditing={optionSetEditing}
              buttonsStatus={buttonsStatus}
              renderOptionSetList={this.renderMaskOptionSetList()}
              setButtonsStatus={this.setAddButtonStatus}
              clearOptionSetValidationErrors={this.clearOptionSetValidationErrors}
              helpText={
                <InlineStack gap="200" blockAlign="start" wrap={false}>
                  <Box>
                    <Icon source={LightbulbIcon} tone="subdued" />
                  </Box>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {t('mask-option-set-help-text')}
                  </Text>
                </InlineStack>
              }
            />
          </BlockStack>
        ),
      },
    ]
  }

  private getAdvancedItems() {
    const { settings = {}, image } = this.state
    const hideWhenPrinting = (settings as any).hideWhenPrinting ?? DEFAULT_HIDE_WHEN_PRINTING
    const includeFilterPresetsInPrint
      = (settings as any).includeFilterPresetsInPrint ?? DEFAULT_INCLUDE_FILTER_PRESETS_IN_PRINT
    const isVectorImage = isSvgImage(image?.src)

    const onChangeHideWhenPrinting = () => {
      this.setData('settings.hideWhenPrinting', !hideWhenPrinting)
    }

    const onChangeIncludeFilterPresetsInPrint = () => {
      this.setData('settings.includeFilterPresetsInPrint', !includeFilterPresetsInPrint)
    }

    return [
      {
        open: false,
        id: 'advanced-settings',
        label: t('advanced'),
        content: (
          <BlockStack gap="400">
            <Tooltip content={t('hide-when-printing-description')}>
              <Box>
                <Switch
                  accessibilityLabel={t('hide-when-printing')}
                  label={t('hide-when-printing')}
                  checked={hideWhenPrinting}
                  onInput={onChangeHideWhenPrinting}
                />
              </Box>
            </Tooltip>
            {isVectorImage && (
              <Tooltip
                content={t(
                  'when-enabled-filter-presets-like-embossing-and-engraving-effects-will-be-included-in-print-images'
                )}
              >
                <Box>
                  <Switch
                    accessibilityLabel={t('include-filter-presets-in-print')}
                    label={t('include-filter-presets-in-print')}
                    checked={includeFilterPresetsInPrint}
                    onInput={onChangeIncludeFilterPresetsInPrint}
                  />
                </Box>
              </Tooltip>
            )}
            {this.renderConditionInspector()}
          </BlockStack>
        ),
      },
    ] as any
  }

  protected renderCustomizeInspector(): ReactNode {
    const { renderOptionSetInspector } = this.props
    const { image } = this.state
    const isVectorImage = isSvgImage(image?.src)

    // If renderOptionSetInspector is provided as a prop, use the old behavior (backward compatible)
    if (typeof renderOptionSetInspector === 'function') {
      return (
        <Box>
          {this.renderCreateClipart()}
          {renderOptionSetInspector()}
          {this.renderAdvancedInspector()}
        </Box>
      )
    }

    // Otherwise, use the new exclusive accordion behavior
    const accordionItems = [
      ...this.getImageOptionSetItems(),
      // Hide mask personalization for SVG images
      ...(!isVectorImage ? this.getMaskOptionSetItems() : []),
      ...this.getAdvancedItems(),
    ]

    return (
      <Box>
        {this.renderCreateClipart()}
        <ImageTutorialBanner />
        <AccordionList
          exclusiveOpen={true}
          groupId="image-inspector"
          defaultOpenId="personalize-image-inspector"
          items={accordionItems}
        />
      </Box>
    )
  }

  protected renderStylingToolBar(): ReactNode {
    const { layerStore } = this.props
    const { image } = this.state

    if (!image) return null

    return (
      <Fragment>
        <OverflowToolbar>
          <BackgroundRemoval />
          <ImageRemix imageUrl={image.src} />
          <VectorConversion imageUrl={image.src} />
          <VectorEdit imageUrl={image.src} />
          {this.renderTransformationInspector()}
          <LayerActionButtons />
        </OverflowToolbar>

        {/* Render modals outside the overflow popover subtree */}
        <VectorWizardModal
          imageUrl={image.src}
          layerStore={layerStore}
          originalImageDimensions={
            image.width && image.height ? { width: image.width, height: image.height } : undefined
          }
        />
        <VectorEditorModal imageUrl={image.src} layerStore={layerStore} />
      </Fragment>
    )
  }

  protected renderImageOptionSetList(): ReactNode {
    const optionSetType = EOptionSet.IMAGE_OPTION
    const { layerStore } = this.props
    const { editMode, existOptionSetPressed } = this.getAddButtonsStatus(optionSetType)
    const optionSet = this.getEditingOptionSet(optionSetType)

    const setOptionSetEditing = (optionSet: any) => {
      this.setState({ optionSetEditing: optionSet })
    }

    if (editMode) {
      return (
        <UploadImages
          t={t}
          imageUploadType="images"
          layerStore={layerStore}
          typeComponent="textfield"
          optionSet={optionSet}
          setOptionSetEditing={setOptionSetEditing}
          editMode={!!editMode}
          existOptionSetPressed={!!existOptionSetPressed}
          insertDataToOptionSet={true}
        />
      )
    }

    // View mode: display read-only list with pricing
    return (
      <ImageOptionListView
        optionSet={optionSet}
        editMode={!!editMode}
        existOptionSetPressed={!!existOptionSetPressed}
      />
    )
  }

  protected renderMaskOptionSetList(): ReactNode {
    const optionSetType = EOptionSet.MASK_OPTION
    const { layerStore } = this.props
    const { editMode, existOptionSetPressed } = this.getAddButtonsStatus(optionSetType)
    const optionSet = this.getEditingOptionSet(optionSetType)

    const setOptionSetEditing = (optionSet: any) => {
      this.setState({ optionSetEditing: optionSet })
    }

    if (editMode) {
      return (
        <UploadImages
          t={t}
          imageUploadType="masks"
          layerStore={layerStore}
          typeComponent="textfield"
          optionSet={optionSet}
          setOptionSetEditing={setOptionSetEditing}
          editMode={!!editMode}
          existOptionSetPressed={!!existOptionSetPressed}
          allowEditPricing={true}
          insertDataToOptionSet={false}
        />
      )
    }

    // View mode for masks
    return (
      <MaskOptionListView optionSet={optionSet} editMode={!!editMode} existOptionSetPressed={!!existOptionSetPressed} />
    )
  }

  protected getOptionsForConditionalLogic(): any[] {
    return this.getEditingOptionSet(EOptionSet.IMAGE_OPTION)?.data?.files || []
  }

  protected renderAdvancedInspector(): ReactNode {
    const { settings = {}, image } = this.state
    const hideWhenPrinting = (settings as any).hideWhenPrinting ?? DEFAULT_HIDE_WHEN_PRINTING
    const includeFilterPresetsInPrint
      = (settings as any).includeFilterPresetsInPrint ?? DEFAULT_INCLUDE_FILTER_PRESETS_IN_PRINT
    const isVectorImage = isSvgImage(image?.src)

    const onChangeHideWhenPrinting = () => {
      this.setData('settings.hideWhenPrinting', !hideWhenPrinting)
    }

    const onChangeIncludeFilterPresetsInPrint = () => {
      this.setData('settings.includeFilterPresetsInPrint', !includeFilterPresetsInPrint)
    }

    return (
      <AccordionList
        items={[
          {
            open: false,
            id: 'advanced-settings',
            label: t('advanced'),
            content: (
              <BlockStack gap="400">
                <Tooltip content={t('hide-when-printing-description')}>
                  <Box>
                    <Switch
                      accessibilityLabel={t('hide-when-printing')}
                      label={t('hide-when-printing')}
                      checked={hideWhenPrinting}
                      onInput={onChangeHideWhenPrinting}
                    />
                  </Box>
                </Tooltip>
                {isVectorImage && (
                  <Tooltip
                    content={t(
                      'when-enabled-filter-presets-like-embossing-and-engraving-effects-will-be-included-in-print-images'
                    )}
                  >
                    <Box>
                      <Switch
                        accessibilityLabel={t('include-filter-presets-in-print')}
                        label={t('include-filter-presets-in-print')}
                        checked={includeFilterPresetsInPrint}
                        onInput={onChangeIncludeFilterPresetsInPrint}
                      />
                    </Box>
                  </Tooltip>
                )}
                {this.renderConditionInspector()}
              </BlockStack>
            ),
          },
        ]}
      />
    )
  }
}
