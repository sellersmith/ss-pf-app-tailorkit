/** @jsxImportSource preact */
import { useEffect, useMemo, useState, useCallback } from 'preact/hooks'
import { translate } from '../../../assets/libraries/translation'
import { ASPECT_RATIO_OPTIONS } from '../../../assets/components/commons/ai-generate/generate-image/constants'
import TextField from '../../../assets/components/preact/commons/textfield'
import Button from '../../../assets/components/preact/commons/button'
import PromptPresets from '../../../assets/components/preact/commons/ai-generate/PromptPresets'
import { AccordionList } from '../../../assets/components/preact/commons/accordion'
import { findNearestAspectRatio } from '../../libraries/template/calculateLayerRatio'
import { validateImageFile } from '../../../assets/handlers/event-handlers/image-editor/upload-service'
import type { AIImageGeneratorWebComponentProps, GenerateImageData } from './types'

export function PreactAIImageGenerator(props: AIImageGeneratorWebComponentProps) {
  const {
    layerId,
    layerDimensions,
    generativeOptions = {},
    allowCustomerToUseReferenceImage = false,
    enabledQuickPrompts = [],
    enabledTemplateTypes = [],
    enabledVisualStyles = [],
    enabledContentThemes = [],
    allowCustomerToUseQuickPrompts = false,
    allowCustomerToUseTemplateTypes = false,
    allowCustomerToUseVisualStyles = false,
    allowCustomerToUseContentThemes = false,
    disabledGenerate = false,
    disabledGenerateMessage,
    showTitle = true,
    onGenerate,
    onGenerateStart,
    onGenerateComplete,
    onGenerateError,
  } = props

  const defaultAspectRatio = findNearestAspectRatio(
    { width: layerDimensions.width, height: layerDimensions.height },
    Object.keys(ASPECT_RATIO_OPTIONS)
  )

  const [prompt, setPrompt] = useState<string>(generativeOptions.prompt || '')
  const [templateType, setTemplateType] = useState<string>(generativeOptions.templateType || '')
  const [visualStyle, setVisualStyle] = useState<string>(generativeOptions.visualStyle || '')
  const [contentTheme, setContentTheme] = useState<string>(generativeOptions.contentTheme || '')
  const [selectedRatio] = useState<string>(generativeOptions.aspectRatio || defaultAspectRatio?.label || '1:1')
  const [loading, setLoading] = useState<boolean>(false)
  const [statusText, setStatusText] = useState<string>('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null)

  const ids = useMemo(
    () => ({
      containerId: `emtlkit--container-${layerId}`,
      textFieldContainerId: `emtlkit--text-field-container-${layerId}`,
      textFieldId: `emtlkit--generate-image-textarea-${layerId}`,
      referenceSelectContainerId: `emtlkit--reference-select-container-${layerId}`,
      referenceSelectBtnId: `emtlkit--reference-select-btn-${layerId}`,
      referenceStatusId: `emtlkit--reference-status-${layerId}`,
      aspectRatioBtnId: `emtlkit--aspect-ratio-btn-${layerId}`,
      ratioOptionsContainerId: `emtlkit--aspect-ratio-options-container-${layerId}`,
      styleBtnId: `emtlkit--style-btn-${layerId}`,
      styleOptionsContainerId: `emtlkit--style-options-container-${layerId}`,
      generateButtonContainerId: `emtlkit--generate-text-btn-container-${layerId}`,
      generateButtonId: `emtlkit--generate-text-btn-${layerId}`,
    }),
    [layerId]
  )

  // Create a stable preview URL only when the selected file changes.
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

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = (target.files && target.files[0]) || null
    setSelectedFiles([])
    if (!file) {
      setStatusText('')
      return
    }

    const { valid } = validateImageFile(file)

    if (!valid) {
      setStatusText(translate('invalid-file-only-webp-jpg-png-25mb-allowed'))
      target.value = ''
      return
    }
    setStatusText('')
    setSelectedFiles([file])
  }

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

  const isGenerateDisabled = disabledGenerate || !(prompt || (visualStyle && selectedFiles?.length))
  const disabledMessage =
    disabledGenerateMessage ||
    translate(
      'ai-limit-reached',
      'AI has generated the maximum number of images. View an existing AI image below to replace it.'
    )

  useEffect(() => {
    const inputPrompt = document.getElementById(ids.textFieldId) as HTMLInputElement

    if (inputPrompt) {
      inputPrompt.value = generativeOptions.prompt || ''
    }
  }, [generativeOptions.prompt, ids.textFieldId])

  const handleGenerate = async () => {
    if (isGenerateDisabled || !onGenerate) return

    const data: GenerateImageData = {
      prompt,
      referenceFiles: selectedFiles,
      aspectRatio: selectedRatio,
      templateType: templateType || undefined,
      visualStyle: visualStyle || undefined,
      contentTheme: contentTheme || undefined,
    }

    try {
      setLoading(true)
      onGenerateStart?.()
      await onGenerate(data)
      onGenerateComplete?.()
    } catch (error) {
      onGenerateError?.(error as Error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
      {showTitle && (
        <div className="emtlkit--popover-title">{translate('generate-image-with-ai', 'Generate image with AI')}</div>
      )}

      <div
        id={ids.containerId}
        className="emtlkit--generate-image-wrapper emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8"
      >
        {/* 1. Visual Style - Always visible first */}
        {allowCustomerToUseVisualStyles && enabledVisualStyles?.length ? (
          <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
            <label className={'emtlkit--option-set-label'} style={{ marginBottom: '0px' }}>
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
        ) : null}

        {/* 2. Reference Image */}
        {allowCustomerToUseReferenceImage ? (
          <div id={ids.referenceSelectContainerId}>
            <div className="emtlkit--reference-selector">
              <label className={'emtlkit--option-set-label'} style={{ marginBottom: '0px' }}>
                {translate('reference-image', 'Reference image')}
              </label>

              {selectedFiles[0] ? (
                // Show preview with "Choose another image" button below
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
                  <Button
                    id={ids.referenceSelectBtnId}
                    fullWidth
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById(
                        `${ids.referenceSelectBtnId}-input`
                      ) as HTMLInputElement | null
                      input?.click()
                    }}
                  >
                    {translate('choose-another-image')}
                  </Button>
                </div>
              ) : (
                // Show dropzone-style upload UI when no file selected
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
                    onClick={() => {
                      const input = document.getElementById(
                        `${ids.referenceSelectBtnId}-input`
                      ) as HTMLInputElement | null
                      input?.click()
                    }}
                  >
                    <span style={{ fontSize: 40, color: '#999', fontWeight: 300 }}>+</span>
                  </div>
                  <Button
                    id={ids.referenceSelectBtnId}
                    fullWidth
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById(
                        `${ids.referenceSelectBtnId}-input`
                      ) as HTMLInputElement | null
                      input?.click()
                    }}
                  >
                    {translate('choose-an-image')}
                  </Button>
                </div>
              )}

              <input
                id={`${ids.referenceSelectBtnId}-input`}
                type="file"
                accept="image/*"
                multiple={false}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {statusText && (
                <div id={ids.referenceStatusId} className="emtlkit--reference-status">
                  {statusText}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* 3. Description, 4. Template Type, 5. Content Theme - In accordions */}
        <div className="emtlkit--creative-tools">
          <AccordionList
            hideDivider={true}
            paddingBlockEnd="0"
            style={{ margin: '0 -0.75rem' }}
            items={[
              ...(allowCustomerToUseQuickPrompts && enabledQuickPrompts?.length
                ? [
                    {
                      open: false,
                      rememberState: false,
                      id: 'description',
                      label: translate('description', 'Description'),
                      content: (
                        <div
                          id={ids.textFieldContainerId}
                          className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8"
                        >
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
              ...(allowCustomerToUseTemplateTypes && enabledTemplateTypes?.length
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
              ...(allowCustomerToUseContentThemes && enabledContentThemes?.length
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
      </div>

      <div id={ids.generateButtonContainerId}>
        {disabledGenerate && (
          <div className="emtlkit--reference-status" style={{ marginBottom: 8 }}>
            {disabledMessage}
          </div>
        )}
        <Button
          id={ids.generateButtonId}
          variant="primary"
          fullWidth
          disabled={isGenerateDisabled}
          loading={loading}
          onClick={handleGenerate}
        >
          {translate('generate', 'Generate')}
        </Button>
      </div>
    </div>
  )
}

export default PreactAIImageGenerator




