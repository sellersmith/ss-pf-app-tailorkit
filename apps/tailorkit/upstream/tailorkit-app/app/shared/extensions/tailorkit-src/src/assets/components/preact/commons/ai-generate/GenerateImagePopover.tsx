/** @jsxImportSource preact */
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { findNearestAspectRatio } from '../../../../../shared/libraries/template/calculateLayerRatio'
import { validateAIReferenceImage } from '../../../../handlers/event-handlers/image-editor/upload-service'
import { uploadIcon, CLOSE_ICON } from '../../../../icons'
import { translate } from '../../../../libraries/translation'
import type { Layer } from '../../../../type'
import { CLASS_EXCLUDE_INPUT_HANDLER } from '../../../../utils/dom-constants'
import { ASPECT_RATIO_OPTIONS } from '../../../commons/ai-generate/generate-image/constants'
import Button from '../button'
import TextField from '../textfield'
import PromptPresets, { type PromptPresetItem } from './PromptPresets'
import {
  createVariablePlaceholder,
  computeFinalPrompt as computePrompt,
  type SelectedEffect,
} from '../../../../../shared/libraries/ai'

export interface GenerateImagePopoverProps {
  layerId: string
  layer: Layer
  allowCustomerToUseReferenceImage?: boolean
  allowCustomerToUseQuickPrompts?: boolean
  enabledQuickPrompts?: string[]
  disabledGenerate?: boolean
  disabledGenerateMessage?: string
  showTitle?: boolean
  generativeOptions?: {
    prompt?: string
    aspectRatio?: string
  }
  onGenerate: (promptValue: string, referenceFiles: File[], selectedRatio: string) => Promise<void> | void
}

export function GenerateImagePopover(props: GenerateImagePopoverProps) {
  const {
    layerId,
    layer,
    generativeOptions = {},
    allowCustomerToUseReferenceImage = false,
    allowCustomerToUseQuickPrompts = false,
    enabledQuickPrompts = [],
    disabledGenerate = false,
    disabledGenerateMessage,
    showTitle = true,
    onGenerate,
  } = props

  const defaultAspectRatio = findNearestAspectRatio(
    { width: layer.ds.w, height: layer.ds.h },
    Object.keys(ASPECT_RATIO_OPTIONS)
  )

  const [prompt, setPrompt] = useState<string>(generativeOptions.prompt || '')
  const [selectedRatio] = useState<string>(generativeOptions.aspectRatio || defaultAspectRatio?.label || '')
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [selectedEffect, setSelectedEffect] = useState<SelectedEffect | null>(null)

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
  // This avoids regenerating blob URLs on every render which causes image reloads.
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
    setFileError(null)

    if (!file) {
      return
    }

    const { valid, errorMessage } = validateAIReferenceImage(file)

    if (!valid) {
      setFileError(errorMessage || translate('invalid-file-only-webp-jpg-png-allowed'))
      target.value = ''
      return
    }

    setSelectedFiles([file])
  }

  const onQuickPromptSelect = useCallback((names: string[], instructions?: string[]) => {
    const name = names[0] || ''
    const instruction = instructions?.[0] || ''

    // Store the selected effect separately
    setSelectedEffect(name ? { name, instruction } : null)

    // Create placeholder text for variables (e.g., "{{family_name}}" -> "Family name: ...")
    const newPromptValue = createVariablePlaceholder(instruction)
    setPrompt(newPromptValue)
  }, [])

  const filterQuickPrompts = useCallback(
    (items: PromptPresetItem[]) =>
      enabledQuickPrompts === undefined
        ? items
        : enabledQuickPrompts.length
          ? items.filter(item => enabledQuickPrompts.includes(item.name))
          : [],
    [enabledQuickPrompts]
  )

  // Generate is enabled if: effect is selected OR prompt has content
  const hasContent = selectedEffect || prompt
  const isGenerateDisabled = disabledGenerate || !hasContent
  const disabledMessage = disabledGenerateMessage || translate('ai-limit-reached')

  // Compute final prompt using shared utility
  const computeFinalPrompt = useCallback(() => {
    return computePrompt(selectedEffect, prompt)
  }, [selectedEffect, prompt])

  useEffect(() => {
    const inputPrompt = document.getElementById(ids.textFieldId) as HTMLInputElement

    if (inputPrompt) {
      inputPrompt.value = generativeOptions.prompt || ''
    }
  }, [generativeOptions.prompt, ids.textFieldId])

  return (
    <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
      {showTitle && (
        <div className="emtlkit--popover-title">{translate('generate-image-with-ai', 'Generate image with AI')}</div>
      )}

      <div
        id={ids.containerId}
        className={`emtlkit--generate-image-wrapper ${CLASS_EXCLUDE_INPUT_HANDLER} emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8`}
      >
        {/* 1. AI Effects - Quick Prompts */}
        {enabledQuickPrompts?.length ? (
          <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
            <label className={'emtlkit--option-set-label'} style={{ marginBottom: '0px' }}>
              {translate('ai-effects', 'AI effects')}
            </label>
            <PromptPresets
              viewAll={true}
              layout="carousel"
              showLabel={false}
              type="quick_prompt"
              filterItems={filterQuickPrompts}
              onSelect={onQuickPromptSelect}
            />
          </div>
        ) : null}

        {/* 2. Reference Image */}
        {allowCustomerToUseReferenceImage ? (
          <div id={ids.referenceSelectContainerId}>
            <div className="emtlkit--reference-selector">
              {/* Only show title when no image uploaded */}
              {/* {!selectedFiles[0] && ( */}
              <label className={'emtlkit--option-set-label'} style={{ marginBottom: '0px', fontWeight: 'normal' }}>
                {translate('reference-image', 'Reference image')}
              </label>
              {/* )} */}

              {selectedFiles[0] ? (
                // Show preview with "Choose another image" button below
                <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8" style={{ width: '100%' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      padding: 8,
                      border: 'var(--emtlkit-border-width-050) solid var(--emtlkit-border-color-secondary)',
                      borderRadius: 'var(--emtlkit-border-radius-200)',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: 120,
                        borderRadius: 'var(--emtlkit-border-radius-100)',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        alt="reference"
                        src={referencePreviewUrl || ''}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                      }}
                    >
                      <Button
                        variant="plain"
                        size="slim"
                        iconOnly
                        icon={CLOSE_ICON}
                        onClick={() => {
                          setSelectedFiles([])
                          setFileError(null)
                        }}
                      />
                    </div>
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
                    {translate('choose-another-image')}
                  </Button>
                </div>
              ) : (
                // Show dropzone-style upload UI when no file selected
                <div
                  style={{
                    width: '100%',
                    minHeight: 120,
                    border: 'var(--emtlkit-border-width-050) dashed var(--emtlkit-border-color-secondary)',
                    borderRadius: 'var(--emtlkit-border-radius-200)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'transparent',
                  }}
                  className="emtlkit--d-flex emtlkit--flex-column emtlkit--flex-center emtlkit--flex-justify-center emtlkit--gap-4"
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--emtlkit-border-color-primary, #0066cc)'
                    e.currentTarget.style.backgroundColor = 'var(rgba(0, 102, 204, 0.05))'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--emtlkit-border-color-secondary)'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => {
                    const input = document.getElementById(
                      `${ids.referenceSelectBtnId}-input`
                    ) as HTMLInputElement | null
                    input?.click()
                  }}
                >
                  <img width={15} style={{ width: 15 }} src={uploadIcon} alt="upload" />
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--emtlkit-text-color)',
                      textAlign: 'center',
                      fontWeight: 500,
                    }}
                  >
                    {translate('choose-an-image')}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--emtlkit-text-color-subdued)',
                      textAlign: 'center',
                    }}
                  >
                    {translate('accepts-single-webp-jpg-png-up-to-15mb')}
                  </span>
                </div>
              )}

              {fileError && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--emtlkit-text-critical-color)',
                    textAlign: 'center',
                    marginTop: 4,
                  }}
                >
                  {fileError}
                </div>
              )}

              <input
                id={`${ids.referenceSelectBtnId}-input`}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                multiple={false}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>
        ) : null}

        {/* 3. Description - in accordion for optional/cleaner UX */}
        {allowCustomerToUseQuickPrompts && (
          <div className="emtlkit--creative-tools">
            <div id={ids.textFieldContainerId} className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
              <TextField
                id={ids.textFieldId}
                label={translate('what-would-you-like-to-create')}
                placeholder={
                  selectedEffect ? translate('add-additional-details-optional') : translate('type-your-idea')
                }
                value={prompt}
                maxLength={2000}
                multiline
                rows={3}
                showCharacterCount
                onChange={setPrompt}
              />
            </div>
          </div>
        )}
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
          onClick={async () => {
            if (isGenerateDisabled) return
            try {
              setLoading(true)
              const finalPrompt = computeFinalPrompt()
              await onGenerate(finalPrompt, selectedFiles, selectedRatio)
            } finally {
              setLoading(false)
            }
          }}
        >
          {translate('generate-image')}
        </Button>
      </div>
    </div>
  )
}

export default GenerateImagePopover
