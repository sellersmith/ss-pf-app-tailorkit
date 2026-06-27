import { BlockStack, Checkbox, Icon, InlineStack, Tooltip } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import type { TLayerStore } from '~/stores/modules/layer'
import AdvancedOptions from './AdvancedOptions'
import { BuyersActionPopover } from './BuyersActionPopover'
import { SelectField, getSelectionDisplayText } from './SelectField'
import { useImageUploaderOptions } from './useImageUploaderOptions'
import Switch from '~/components/common/Switch'
import { AiCreditExhaustedBanner } from '~/components/common/AiCreditExhaustedBanner'

interface ImageUploaderOptionProps {
  layerStore: TLayerStore
  previewMode: boolean
  /**
   * Whether the current image is a vector (SVG) image.
   * When true, the "Allow buyers to edit images" option is hidden
   * since vectors don't support the same edit operations as raster images.
   */
  isVectorImage?: boolean
}

/**
 * ImageUploaderOption component handles image uploader configuration settings
 * Uses layer settings as the primary source with fallback to defaults
 *
 * Supports both raster and vector (SVG) image layers:
 * - Raster: All options available including edit image actions
 * - Vector: Edit image options are excluded (not applicable to SVG)
 */
export default function ImageUploaderOption(props: ImageUploaderOptionProps) {
  const { layerStore, previewMode, isVectorImage = false } = props
  const { t } = useTranslation()
  const { hasCredits } = useAiCreditsStatus()

  const {
    // State
    required,
    allowCustomerUploadImage,
    allowCustomerGenerateImageWithAI,
    allowCustomerToEditImage,
    allowCustomerToUseReferenceImage,
    allowCustomerToUseQuickPrompts,
    enabledQuickPrompts,
    autoRemoveSolidWhiteBackground,
    buyersActionPopoverActive,

    // Context flags
    isVectorImage: isVector,

    // Computed
    allowedCustomerToEditImage,
    allowCustomersToEditImagesChecked,

    // Handlers
    handleRequiredChange,
    handleAllowUploadChange,
    handleAllowGenerateWithAIChange,
    handleAllowCustomerToUseReferenceImageChange,
    handleAllowCustomerToUseQuickPromptsChange,
    handleAutoRemoveSolidBackgroundChange,
    handleAllowEditChange,
    handleOpenQuickPromptInspector,
    toggleBuyersActionPopover,
    closeBuyersActionPopover,
    handleBuyersActionChange,
  } = useImageUploaderOptions({ layerStore, previewMode, isVectorImage })

  return (
    <BlockStack gap="400">
      {/* Allow buyers to upload image */}
      <div>
        <InlineStack gap="200" blockAlign="center">
          <Checkbox
            label={t('allow-buyers-to-upload-image')}
            checked={allowCustomerUploadImage}
            onChange={handleAllowUploadChange}
          />
          <Tooltip content={t('allow-buyers-to-upload-image-description')}>
            <Icon source={InfoIcon} tone="subdued" />
          </Tooltip>
        </InlineStack>
      </div>

      {/* Enable AI image and effects */}
      <div>
        {hasCredits ? (
          <Checkbox
            label={t('allow-buyers-to-generate-image-with-ai')}
            checked={allowCustomerGenerateImageWithAI}
            onChange={handleAllowGenerateWithAIChange}
          />
        ) : (
          <Tooltip persistOnClick content={<AiCreditExhaustedBanner uiMode="tooltip" />}>
            <Checkbox
              label={t('allow-buyers-to-generate-image-with-ai')}
              checked={allowCustomerGenerateImageWithAI}
              disabled
            />
          </Tooltip>
        )}

        <div style={{ marginLeft: '28px', marginTop: '4px' }}>
          {allowCustomerGenerateImageWithAI && (
            <div style={{ marginTop: '12px' }}>
              <BlockStack gap="300">
                {/* AI Effects Select */}
                <SelectField
                  label={t('ai-effects')}
                  value={getSelectionDisplayText(enabledQuickPrompts, 'effects', t)}
                  placeholder={t('select-effects')}
                  onClick={handleOpenQuickPromptInspector}
                  infoTooltip={t('ai-effects-tooltip')}
                />

                <AdvancedOptions
                  allowCustomerToUseQuickPrompts={allowCustomerToUseQuickPrompts}
                  allowCustomerToUseReferenceImage={allowCustomerToUseReferenceImage}
                  handleAllowCustomerToUseReferenceImageChange={handleAllowCustomerToUseReferenceImageChange}
                  handleAllowCustomerToUseQuickPromptsChange={handleAllowCustomerToUseQuickPromptsChange}
                  autoRemoveSolidWhiteBackground={autoRemoveSolidWhiteBackground}
                  handleAutoRemoveSolidBackgroundChange={handleAutoRemoveSolidBackgroundChange}
                />
              </BlockStack>
            </div>
          )}
        </div>
      </div>

      {/* Allow buyers to edit images - only for raster images, not applicable to vector (SVG) images */}
      {!isVector && (
        <div>
          <Checkbox
            label={t('allow-buyers-to-edit-images')}
            checked={allowCustomersToEditImagesChecked as boolean | 'indeterminate'}
            disabled={!allowCustomerUploadImage && !allowCustomerGenerateImageWithAI}
            onChange={handleAllowEditChange}
          />

          <div style={{ marginLeft: '28px', marginTop: '4px' }}>
            {allowedCustomerToEditImage && (
              <div style={{ marginTop: '12px' }}>
                <BlockStack gap="300">
                  <BuyersActionPopover
                    active={buyersActionPopoverActive}
                    allowCustomerToEditImage={allowCustomerToEditImage}
                    onToggle={toggleBuyersActionPopover}
                    onClose={closeBuyersActionPopover}
                    onChange={handleBuyersActionChange}
                  />
                </BlockStack>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Required field - visible when upload OR AI generation is enabled */}
      {(allowCustomerUploadImage || allowCustomerGenerateImageWithAI) && (
        <Switch label={t('required-field')} checked={required} onChange={handleRequiredChange} />
      )}
    </BlockStack>
  )
}
