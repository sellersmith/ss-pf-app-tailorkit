/** @jsxImportSource preact */
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { translate } from '../../../assets/libraries/translation'
import { ASPECT_RATIO_OPTIONS } from '../../../assets/components/commons/ai-generate/generate-image/constants'
import TextField from '../../../assets/components/preact/commons/textfield'
import Button from '../../../assets/components/preact/commons/button'
import PromptPresets from '../../../assets/components/preact/commons/ai-generate/PromptPresets'
import { AccordionList } from '../../../assets/components/preact/commons/accordion'
import { findNearestAspectRatio } from '../../libraries/template/calculateLayerRatio'
import { validateImageFile } from '../../../assets/handlers/event-handlers/image-editor/upload-service'
import type {
  AIImageGeneratorProps,
  GeneratedImage,
  GenerateParams,
} from './types'

/**
 * AI Image Generator Preact Component
 *
 * A unified component for generating images with AI that can be used in both
 * the admin preview and storefront. The actual API call is handled by the
 * parent via the onGenerate callback.
 */
export function AIImageGenerator(props: AIImageGeneratorProps) {
  const {
    layerId,
    layerDimensions,
    generativeOptions = {},
    showTitle = true,
    disabledGenerate = false,
    disabledGenerateMessage,
    maxGeneratedImages = 3,
    allowCustomerToUseReferenceImage = false,
    allowCustomerToUseQuickPrompts = false,
    allowCustomerToUseTemplateTypes = false,
    allowCustomerToUseVisualStyles = false,
    allowCustomerToUseContentThemes = false,
    enabledQuickPrompts,
    enabledTemplateTypes,
    enabledVisualStyles,
    enabledContentThemes,
    onGenerate,
    onSelectImage,
  } = props

  // Calculate default aspect ratio from layer dimensions
  const defaultAspectRatio = useMemo(
    () =>
      findNearestAspectRatio(
        { width: layerDimensions.width, height: layerDimensions.height },
        Object.keys(ASPECT_RATIO_OPTIONS)
      ),
    [layerDimensions.width, layerDimensions.height]
  )

  // Form state
  const [prompt, setPrompt] = useState<string>(generativeOptions?.prompt || '')
  const [templateType, setTemplateType] = useState<string>(generativeOptions?.templateType || '')
  const [visualStyle, setVisualStyle] = useState<string>(generativeOptions?.visualStyle || '')
  const [contentTheme, setContentTheme] = useState<string>(generativeOptions?.contentTheme || '')
  const [aspectRatio] = useState<string>(
    generativeOptions?.aspectRatio || defaultAspectRatio?.label || '1:1'
  )

  // Reference image state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string>('')

  // Generation state
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Unique IDs for form elements
  const ids = useMemo(
    () => ({
      containerId: `emtlkit--ai-gen-container-${layerId}`,
      textFieldId: `emtlkit--ai-gen-textarea-${layerId}`,
      referenceInputId: `emtlkit--ai-gen-ref-input-${layerId}`,
      generateButtonId: `emtlkit--ai-gen-btn-${layerId}`,
    }),
    [layerId]
  )

  // Create preview URL for reference image
  useEffect(() => {
    const file = selectedFiles[0]
    if (!file) {
      setReferencePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setReferencePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFiles])

  // Handle file input change
  const handleFileChange = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0] || null
    setSelectedFiles([])
    setFileError('')

    if (!file) return

    const { valid } = validateImageFile(file)
    if (!valid) {
      setFileError(translate('invalid-file-only-webp-jpg-png-25mb-allowed', 'Invalid file. Only WebP, JPG, PNG up to 2.5MB allowed.'))
      input.value = ''
      return
    }

    setSelectedFiles([file])
  }, [])

  // Trigger file input click
  const handleSelectFile = useCallback(() => {
    const input = document.getElementById(ids.referenceInputId) as HTMLInputElement | null
    input?.click()
  }, [ids.referenceInputId])

  // Preset selection handlers
  const onVisualStyleSelect = useCallback((names: string[]) => {
    setVisualStyle(names[0] || '')
  }, [])

  const onQuickPromptSelect = useCallback(
    (_: string[], instructions?: string[]) => {
      const promptInput = document.getElementById(ids.textFieldId) as HTMLInputElement
      if (promptInput) {
        promptInput.value = instructions?.[0] || ''
      }
      setPrompt(instructions?.[0] || '')
    },
    [ids.textFieldId]
  )

  const onTemplateTypeSelect = useCallback((names: string[]) => {
    setTemplateType(names[0] || '')
  }, [])

  const onContentThemeSelect = useCallback((names: string[]) => {
    setContentTheme(names[0] || '')
  }, [])

  // Filter functions for presets
  const filterQuickPrompts = useCallback(
    (items: any[]) =>
      enabledQuickPrompts === undefined
        ? items
        : enabledQuickPrompts.length
          ? items.filter(item => enabledQuickPrompts.includes(item.name))
          : [],
    [enabledQuickPrompts]
  )

  const filterTemplateTypes = useCallback(
    (items: any[]) =>
      enabledTemplateTypes === undefined
        ? items
        : enabledTemplateTypes.length
          ? items.filter(item => enabledTemplateTypes.includes(item.name))
          : [],
    [enabledTemplateTypes]
  )

  const filterVisualStyles = useCallback(
    (items: any[]) =>
      enabledVisualStyles === undefined
        ? items
        : enabledVisualStyles.length
          ? items.filter(item => enabledVisualStyles.includes(item.name))
          : [],
    [enabledVisualStyles]
  )

  const filterContentThemes = useCallback(
    (items: any[]) =>
      enabledContentThemes === undefined
        ? items
        : enabledContentThemes.length
          ? items.filter(item => enabledContentThemes.includes(item.name))
          : [],
    [enabledContentThemes]
  )

  // Check if generation is allowed
  const hasValidInput = prompt || (visualStyle && selectedFiles?.length)
  const limitReached = generatedImages.length >= maxGeneratedImages
  const isGenerateDisabled = disabledGenerate || limitReached || !hasValidInput || isLoading

  const disabledMessage =
    disabledGenerateMessage ||
    (limitReached
      ? translate(
          'ai-limit-reached',
          `AI has generated ${maxGeneratedImages} images. Click an image below to use it.`
        )
      : '')

  // Handle generate button click
  const handleGenerate = useCallback(async () => {
    if (isGenerateDisabled) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      const params: GenerateParams = {
        prompt,
        referenceFiles: selectedFiles,
        aspectRatio,
        templateType: templateType || undefined,
        visualStyle: visualStyle || undefined,
        contentTheme: contentTheme || undefined,
      }

      const images = await onGenerate(params)

      if (images && images.length > 0) {
        setGeneratedImages(prev => [...prev, ...images])
        // Auto-select first generated image
        onSelectImage(images[0])
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : translate('error-generating-image', 'An error occurred while generating the image. Please try again.')
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }, [
    isGenerateDisabled,
    prompt,
    selectedFiles,
    aspectRatio,
    templateType,
    visualStyle,
    contentTheme,
    onGenerate,
    onSelectImage,
  ])

  // Handle image selection
  const handleImageClick = useCallback(
    (image: GeneratedImage) => {
      onSelectImage(image)
    },
    [onSelectImage]
  )

  // Check if features are available
  const showVisualStyles = allowCustomerToUseVisualStyles && (enabledVisualStyles === undefined || enabledVisualStyles.length > 0)
  const showQuickPrompts = allowCustomerToUseQuickPrompts && (enabledQuickPrompts === undefined || enabledQuickPrompts.length > 0)
  const showTemplateTypes = allowCustomerToUseTemplateTypes && (enabledTemplateTypes === undefined || enabledTemplateTypes.length > 0)
  const showContentThemes = allowCustomerToUseContentThemes && (enabledContentThemes === undefined || enabledContentThemes.length > 0)

  return (
    <div className="emtlkit--ai-image-generator emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
      {showTitle && (
        <div className="emtlkit--popover-title">
          {translate('generate-image-with-ai', 'Generate image with AI')}
        </div>
      )}

      <div id={ids.containerId} className="emtlkit--generate-image-wrapper emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
        {/* 1. Visual Style - Always visible first */}
        {showVisualStyles && (
          <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
            <label className="emtlkit--option-set-label" style={{ marginBottom: '0px' }}>
              {translate('visual-style', 'Visual style')}
            </label>
            <PromptPresets
              viewAll={true}
              layout="carousel"
              showLabel={false}
              type="visual_style"
              selected={visualStyle}
              filterItems={filterVisualStyles}
              onSelect={onVisualStyleSelect}
            />
          </div>
        )}

        {/* 2. Reference Image */}
        {allowCustomerToUseReferenceImage && (
          <div className="emtlkit--reference-selector">
            <label className="emtlkit--option-set-label" style={{ marginBottom: '0px' }}>
              {translate('reference-image', 'Reference image')}
            </label>

            {selectedFiles[0] ? (
              // Show preview with "Choose another image" button
              <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8" style={{ width: 150 }}>
                <img
                  alt="reference"
                  src={referencePreviewUrl || ''}
                  style={{
                    width: 150,
                    height: 150,
                    objectFit: 'cover',
                    borderRadius: 'var(--emtlkit-border-radius-200)',
                  }}
                />
                <Button fullWidth variant="outline" onClick={handleSelectFile}>
                  {translate('choose-another-image', 'Choose another image')}
                </Button>
              </div>
            ) : (
              // Show dropzone-style upload UI
              <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8" style={{ width: 150 }}>
                <div
                  style={{
                    width: 150,
                    height: 150,
                    border: 'var(--emtlkit-border-width-050) dashed var(--emtlkit-border-color-secondary)',
                    borderRadius: 'var(--emtlkit-border-radius-200)',
                    cursor: 'pointer',
                  }}
                  className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-justify-center"
                  onClick={handleSelectFile}
                >
                  <span style={{ fontSize: 40, color: '#999', fontWeight: 300 }}>+</span>
                </div>
                <Button fullWidth variant="outline" onClick={handleSelectFile}>
                  {translate('choose-an-image', 'Choose an image')}
                </Button>
              </div>
            )}

            {fileError && (
              <div className="emtlkit--reference-status" style={{ color: 'var(--emtlkit-color-critical)' }}>
                {fileError}
              </div>
            )}

            <input
              id={ids.referenceInputId}
              type="file"
              accept="image/*"
              multiple={false}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* 3. Description, Template Type, Content Theme - In accordions */}
        {(showQuickPrompts || showTemplateTypes || showContentThemes) && (
          <div className="emtlkit--creative-tools">
            <AccordionList
              hideDivider={true}
              paddingBlockEnd="0"
              style={{ margin: '0 -0.75rem' }}
              items={[
                ...(showQuickPrompts
                  ? [
                      {
                        open: false,
                        rememberState: false,
                        id: 'description',
                        label: translate('description', 'Description'),
                        content: (
                          <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
                            <TextField
                              id={ids.textFieldId}
                              label={translate('what-would-you-like-to-create', 'What would you like to create?')}
                              placeholder={translate(
                                'type-your-idea-or-click-a-quick-prompt-below-to-save-time.',
                                'Type your idea or click a quick prompt below to save time.'
                              )}
                              maxLength={2000}
                              multiline
                              rows={3}
                              showCharacterCount
                              onChange={setPrompt}
                            />
                            <PromptPresets
                              viewAll={true}
                              layout="carousel"
                              type="quick_prompt"
                              filterItems={filterQuickPrompts}
                              onSelect={onQuickPromptSelect}
                              label={translate('need-inspiration-try-these', 'Need inspiration? Try these →')}
                            />
                          </div>
                        ),
                      },
                    ]
                  : []),
                ...(showTemplateTypes
                  ? [
                      {
                        open: false,
                        rememberState: false,
                        id: 'template_type',
                        label: translate('template-type-optional', 'Template type (optional)'),
                        content: (
                          <PromptPresets
                            viewAll={true}
                            layout="carousel"
                            showLabel={false}
                            type="template_type"
                            selected={templateType}
                            filterItems={filterTemplateTypes}
                            onSelect={onTemplateTypeSelect}
                          />
                        ),
                      },
                    ]
                  : []),
                ...(showContentThemes
                  ? [
                      {
                        open: false,
                        rememberState: false,
                        id: 'content_theme',
                        label: translate('content-theme-optional', 'Content theme (optional)'),
                        content: (
                          <PromptPresets
                            viewAll={true}
                            layout="carousel"
                            showLabel={false}
                            type="content_theme"
                            selected={contentTheme}
                            filterItems={filterContentThemes}
                            onSelect={onContentThemeSelect}
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="emtlkit--loading-indicator">
            {translate('generating-images-can-take-up-to-30-seconds', 'Generating images can take up to 30 seconds.')}
          </div>
        )}

        {/* Generated images grid */}
        {(generatedImages.length > 0 || isLoading) && (
          <div className="emtlkit--generated-images-grid">
            <label className="emtlkit--option-set-label" style={{ marginBottom: '8px' }}>
              {translate('generated-images', 'Generated images')}
            </label>
            <div
              className="emtlkit--d-grid emtlkit--gap-8"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}
            >
              {generatedImages.map(image => (
                <div
                  key={image.id}
                  className="emtlkit--generated-image-item"
                  style={{
                    cursor: 'pointer',
                    borderRadius: 'var(--emtlkit-border-radius-200)',
                    overflow: 'hidden',
                    border: '2px solid transparent',
                  }}
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={image.thumbnailSource || image.originalSource}
                    alt={image.alt}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
              ))}
              {isLoading && (
                <div
                  className="emtlkit--image-skeleton"
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: 'var(--emtlkit-color-bg-surface-secondary, #f6f6f7)',
                    borderRadius: 'var(--emtlkit-border-radius-200)',
                    animation: 'emtlkit-skeleton-pulse 1.5s ease-in-out infinite',
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="emtlkit--error-message" style={{ color: 'var(--emtlkit-color-critical)' }}>
            {errorMessage}
          </div>
        )}
      </div>

      {/* Generate button */}
      <div>
        {disabledMessage && (
          <div className="emtlkit--reference-status" style={{ marginBottom: 8 }}>
            {disabledMessage}
          </div>
        )}
        <Button
          id={ids.generateButtonId}
          variant="primary"
          fullWidth
          disabled={isGenerateDisabled}
          loading={isLoading}
          onClick={handleGenerate}
        >
          {generatedImages.length > 0
            ? translate('generate-more', 'Generate more')
            : translate('generate', 'Generate')}
        </Button>
      </div>
    </div>
  )
}

export default AIImageGenerator

