import { BlockStack, Box, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import PromptPresets from '~/modules/PromptPresets'
import CategorizedPromptPresets from '~/modules/PromptPresets/CategorizedPromptPresets'
import type { PopoverAIImageGeneratorProps } from './types'
import { useAIImageGenerator } from './useAIImageGenerator'
import { ReferenceImageSection, DescriptionSection, GenerateButton } from './sections'
import { useCallback } from 'react'
import { PopoverRatioSelector } from '../PopoverToneSelector'
import { AiCreditExhaustedBanner } from '~/components/common/AiCreditExhaustedBanner'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'

export function PopoverAIImageGenerator(props: PopoverAIImageGeneratorProps) {
  const { t } = useTranslation()
  const {
    title,
    mainTextLabel,
    contentHeight = '100%',
    placeholderMainTextLabel,
    numberGeneratedImages = 1,
    initialImageOptions = [],
    initialReferenceImages = [],
    layout = 'section',
    aiEffectsLayout = 'carousel',
    allowCustomerToUseReferenceImage = true,
    enabledQuickPrompts,
    allowCustomerToUseQuickPrompts = true,
    forceUseAIEffects = false,
    showAIEffectsSearch = false,
    noScroll = false,
    showRatioSelector = false,
    disabledGenerate = false,
    disabledGenerateMessage,
    onGenerateButtonClick,
    // Vector mode props
    mode = 'image',
    vectorOptions,
    onSelectVector,
  } = props

  const {
    sectionRef,
    prompt,
    placeholder,
    isGenerating,
    isSelectingImagesFromLibrary,
    aspectRatio,
    referenceImages,
    imageSelectorOpen,
    errorMessage,
    existingImageOptions,
    itemsPerRow,
    selectedEffect,
    hasVariables,
    onChangeImagePrompt,
    onChangeQuickPrompt,
    onChangeAspectRatio,
    handleGenerate,
    openImageSelector,
    closeImageSelector,
    onSelectFromLibrary,
    removeReferenceImage,
    filterQuickPrompts,
  } = useAIImageGenerator({
    generativeOptions: props.generativeOptions,
    initialImageOptions,
    initialReferenceImages,
    numberGeneratedImages,
    setInitialImageOptions: props.setInitialImageOptions,
    onSelectImages: props.onSelectImages,
    onClickAddReferenceImageButton: props.onClickAddReferenceImageButton,
    enabledQuickPrompts,
    mode,
    vectorOptions,
    onSelectVector,
  })

  const { hasCredits } = useAiCreditsStatus()
  const isPopover = layout === 'popover'
  // Generate is enabled if: effect is selected OR prompt has content
  const hasContent = selectedEffect || prompt
  const isGenerateDisabled = disabledGenerate || isGenerating || !hasContent

  const handleGenerateButtonClick = useCallback(() => {
    if (disabledGenerate) return
    onGenerateButtonClick?.()
    void handleGenerate()
  }, [disabledGenerate, onGenerateButtonClick, handleGenerate])

  return (
    <div
      style={{
        width: '100%',
        minWidth: '252px',
        maxWidth: isPopover ? '50vh' : '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        ...(isPopover && {
          maxHeight: 'min(520px, calc(100vh - 24px))',
          height: '100%',
        }),
      }}
    >
      {/* Header */}
      {title && (
        <div
          style={
            isPopover ? { position: 'sticky', top: 0, zIndex: 1, background: 'var(--p-surface-bg, #fff)' } : undefined
          }
        >
          <Box padding="300" background="bg-surface-secondary" borderBlockEndWidth="050" borderColor="border">
            <Text variant="headingMd" as="h2" fontWeight="medium">
              {title}
            </Text>
          </Box>
        </div>
      )}

      {/* Content */}
      <div
        ref={sectionRef}
        style={{
          overflowX: 'hidden',
          ...(isPopover ? {} : { overflowY: 'auto', height: contentHeight }),
          ...(noScroll ? { overflow: 'hidden' } : {}),
        }}
      >
        <Box padding={isPopover ? '200' : '0'} paddingBlockStart={'200'}>
          <BlockStack gap="300">
            {!hasCredits && <AiCreditExhaustedBanner />}

            {/* Reference Images */}
            {allowCustomerToUseReferenceImage && (
              <ReferenceImageSection
                referenceImages={referenceImages}
                imageSelectorOpen={imageSelectorOpen}
                isSelectingImagesFromLibrary={isSelectingImagesFromLibrary}
                onAddImage={openImageSelector}
                onRemoveImage={removeReferenceImage}
                onSelectFromLibrary={onSelectFromLibrary}
                onCloseImageSelector={closeImageSelector}
              />
            )}

            {/* AI Effects - Quick Prompts */}
            {((enabledQuickPrompts !== undefined && enabledQuickPrompts.length > 0) || forceUseAIEffects)
              && (aiEffectsLayout === 'categorized' ? (
                <CategorizedPromptPresets
                  type="quick_prompt"
                  layout="grid"
                  itemsPerRow={itemsPerRow}
                  selected={selectedEffect?.name}
                  onSelect={onChangeQuickPrompt}
                  showSearch={showAIEffectsSearch}
                />
              ) : (
                <PromptPresets
                  viewAll={true}
                  layout={aiEffectsLayout}
                  type="quick_prompt"
                  itemsPerRow={itemsPerRow}
                  label={t('ai-effects')}
                  showSearch={showAIEffectsSearch}
                  selected={selectedEffect?.name}
                  onSelect={onChangeQuickPrompt}
                  filterItems={filterQuickPrompts}
                />
              ))}

            {/* Ratio Selector */}
            {showRatioSelector && (
              <PopoverRatioSelector selectedRatio={aspectRatio} handleRatioChange={onChangeAspectRatio} />
            )}

            {/* Description */}
            {allowCustomerToUseQuickPrompts && (
              <DescriptionSection
                prompt={prompt}
                placeholder={placeholder}
                mainTextLabel={mainTextLabel}
                placeholderMainTextLabel={placeholderMainTextLabel}
                onChangeImagePrompt={onChangeImagePrompt}
                selectedEffectName={selectedEffect?.name}
                hasVariables={hasVariables}
              />
            )}
          </BlockStack>
        </Box>
      </div>

      {/* Footer - Generate Button */}
      <GenerateButton
        isGenerating={isGenerating}
        isDisabled={isGenerateDisabled}
        existingImageOptions={existingImageOptions}
        isPopover={isPopover}
        disabledMessage={disabledGenerateMessage}
        onClick={handleGenerateButtonClick}
        errorMessage={errorMessage}
      />
    </div>
  )
}
