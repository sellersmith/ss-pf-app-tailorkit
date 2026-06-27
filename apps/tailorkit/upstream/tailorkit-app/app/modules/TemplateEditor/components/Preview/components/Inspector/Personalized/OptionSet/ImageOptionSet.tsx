/* eslint-disable max-lines */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type ImageOptionSet as ImageOptionSetType, type OptionSet, type ImageSettings } from '~/types/psd'
import { getOptionSetFormatted } from '../../../../utils/getOptionSetFormatted'
import { tlkOptionSetClickEvent } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import type { IOptionSetComponentProps } from '.'
import { Button, DropZone, Tooltip, Icon, InlineStack, Text } from '@shopify/polaris'
import { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_IMAGE_TYPES } from '~/constants/dropzone'
import { useModal } from '~/utils/hooks/useModal'
import { UPLOAD_PREVIEW_MODAL_ID } from '../../../../constant'
import { PopoverAIImageGenerator } from '~/components/AITextField/PopoverAIImageGenerator'
import type { IImageQuery } from '~/types/shopify-files'
import { UploadIcon, ViewIcon, MagicIcon, InfoIcon } from '@shopify/polaris-icons'
import useDevices from '~/utils/hooks/useDevice'
import { useLocation } from '@remix-run/react'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { DEFAULT_IMAGE_UPLOADER_OPTION_DATA } from '~/modules/TemplateEditor/elements/constants/image'
import { useUploadFiles } from '~/modules/TemplateEditor/hooks/useUploadFiles'
import type { GenerativeOptions } from '~/modules/TemplateEditor/components/Editor/utils/elementCreators'
import { findNearestAspectRatio } from 'extensions/tailorkit-src/src/shared/libraries/template/calculateLayerRatio'
import { AI_IMAGE_EDIT_LIMITS } from '~/routes/api.ai-assistant.suggestion/constants'
import { useImageWithOverlay } from '~/hooks/useImageWithOverlay'
import { isSvgImage } from '~/utils/file-types'
import type { VectorGenerationResult, VectorGenerationOptions } from '~/components/AITextField/AIImageGenerator/types'
import {
  getAppliedFilterPresetId,
  getAppliedFilterPresetParams,
  getAppliedFillStroke,
  applyStyleTransferToSvg,
} from '~/shared/utils/applyFilterPreset'

const MAX_UPLOAD_IMAGES = 3
const MAX_AI_GENERATED_IMAGES = 3
const ALLOWED_SVG_EXTENSIONS = '.svg'
const ALLOWED_SVG_TYPES = ['image/svg+xml']

interface LayerDimensions {
  width?: number
  height?: number
}

interface ImageOptionUploadProps {
  layerId: string
  layerDimensions: LayerDimensions
  disabled: boolean
  openFileDialog: boolean
  toggleOpenFileDialog: () => void
  optionSet: OptionSet
  onSelect: (optionSet: OptionSet, id: string) => void
  /** When true, handles SVG upload with filter preset application */
  isVectorMode?: boolean
  /** Layer store for dispatching updates (required for vector mode) */
  layerStore?: IOptionSetComponentProps['layerStore']
  /** Original SVG source to extract filter preset from (for vector mode) */
  originalSvgSrc?: string
}

interface ImageOptionGenerateAIProps {
  isAiGeneratedLimited: boolean
  layerId: string
  layerDimensions: LayerDimensions
  disabled: boolean
  optionSet: OptionSet
  onSelect: (optionSet: OptionSet, id: string) => void
  generativeOptions?: GenerativeOptions
  allowCustomerToUseReferenceImage: boolean
  enabledQuickPrompts: string[]
  enabledTemplateTypes: string[]
  enabledVisualStyles: string[]
  enabledContentThemes: string[]
  allowCustomerToUseQuickPrompts: boolean
  allowCustomerToUseTemplateTypes: boolean
  allowCustomerToUseVisualStyles: boolean
  allowCustomerToUseContentThemes: boolean
  aiGeneratorRef?: React.RefObject<HTMLDivElement>
  onGenerateClick?: () => void
  onFocusGenerator?: () => void
  /** When 'vector', generates SVG shapes instead of raster images */
  mode?: 'image' | 'vector'
  /** Layer store for dispatching updates (required for vector mode) */
  layerStore?: IOptionSetComponentProps['layerStore']
  /** Original SVG source to extract filter preset from (for vector mode) */
  originalSvgSrc?: string
}

export interface ImageOptionSetTypeWithSource extends ImageOptionSetType {
  source?: 'upload' | 'ai'
}

interface IImageOptionProps {
  file: ImageOptionSetTypeWithSource
  layerId: string
  optionSet: OptionSet
  layerDimensions: LayerDimensions
  onSelect: (optionSet: OptionSet, id: string) => void
  onReplace: () => void
  onDelete: (fileId: string) => void
  /** When true, hides the View button (vectors don't have preview/edit functionality) */
  isVectorMode?: boolean
}

const ImageOption = ({
  file,
  optionSet,
  layerDimensions,
  onSelect,
  onReplace,
  layerId,
  onDelete,
  isVectorMode = false,
}: IImageOptionProps) => {
  const { dataSrc, src, name, _id, selecting, source, overlay } = file
  const { openModal } = useModal()
  const { t } = useTranslation()
  const { isMobileView } = useDevices()

  const { imageUrl: compositedUrl } = useImageWithOverlay({
    imageUrl: dataSrc || src,
    overlay: overlay || null,
    enabled: !isVectorMode && !!overlay?.overlaySvg,
  })

  const handleClick = useCallback(() => {
    onSelect(optionSet, _id)
  }, [onSelect, optionSet, _id])

  const handleViewImage = useCallback(() => {
    openModal(UPLOAD_PREVIEW_MODAL_ID, {
      layerId,
      url: src,
      layerDimensions,
      name,
      source,
      onReplace,
      optionSet,
      onSelect,
      replacingImage: file,
    })
  }, [file, openModal, src, layerDimensions, name, source, onReplace, optionSet, onSelect, layerId])

  const handleDeleteImage = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onDelete(_id)
    },
    [_id, onDelete]
  )

  return (
    <div
      id={_id}
      key={_id}
      className={`emtlkit--option-container emtlkit-image-option${selecting ? ' active' : ''} emtlkit--d-flex emtlkit--flex-column emtlkit--gap-4`}
      style={{ position: 'relative' }}
    >
      <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={handleClick}>
        <img alt={name} src={compositedUrl || dataSrc || src} loading="lazy" />
        {source === 'ai' && (
          <div style={{ position: 'absolute', bottom: '-10px', right: '-8px' }}>
            <Icon source={MagicIcon} tone="success" />
          </div>
        )}
        <button
          type="button"
          className="emtlkit--button emtlkit--button-plain emtlkit-image-option-delete-btn"
          onClick={handleDeleteImage}
          aria-label={t('delete')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L9 9M9 1L1 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {/* View button is hidden for vector mode - vectors don't have preview/edit functionality */}
      {source && !isVectorMode && (
        <Button
          variant="plain"
          {...(!isMobileView ? { icon: ViewIcon } : {})}
          size={isMobileView ? 'micro' : 'medium'}
          onClick={handleViewImage}
          textAlign="center"
        >
          {t('view')}
        </Button>
      )}
    </div>
  )
}

const ImageOptionUpload = ({
  layerId,
  layerDimensions,
  openFileDialog,
  toggleOpenFileDialog,
  disabled,
  optionSet,
  onSelect,
  isVectorMode = false,
  layerStore,
  originalSvgSrc,
}: ImageOptionUploadProps) => {
  const { state, openModal } = useModal()
  const modalData = useMemo(() => state[UPLOAD_PREVIEW_MODAL_ID]?.data || {}, [state])
  const { t } = useTranslation()

  // State to hold fetched SVG content (for vector mode - CDN URLs)
  const [fetchedSvgContent, setFetchedSvgContent] = useState<string | null>(null)

  // Decode the original SVG content or fetch from URL (vector mode only)
  useEffect(() => {
    if (!isVectorMode || !originalSvgSrc) {
      setFetchedSvgContent(null)
      return
    }

    // Handle data URI - decode the SVG content directly
    if (originalSvgSrc.startsWith('data:image/svg+xml')) {
      try {
        const base64Match = originalSvgSrc.match(/^data:image\/svg\+xml;base64,(.+)$/i)
        if (base64Match) {
          setFetchedSvgContent(atob(base64Match[1]))
          return
        }
        const urlEncodedMatch = originalSvgSrc.match(/^data:image\/svg\+xml,(.+)$/i)
        if (urlEncodedMatch) {
          setFetchedSvgContent(decodeURIComponent(urlEncodedMatch[1]))
          return
        }
      } catch {
        setFetchedSvgContent(null)
      }
      return
    }

    // Handle CDN URL - fetch the SVG content
    if (originalSvgSrc.startsWith('http') && originalSvgSrc.toLowerCase().includes('.svg')) {
      fetch(originalSvgSrc)
        .then(res => res.text())
        .then(svgText => {
          if (svgText.includes('<svg')) {
            setFetchedSvgContent(svgText)
          }
        })
        .catch(() => {
          setFetchedSvgContent(null)
        })
    }
  }, [isVectorMode, originalSvgSrc])

  // Extract filter preset from the original SVG (vector mode only)
  const originalFilterPresetId = useMemo(() => {
    if (!isVectorMode || !fetchedSvgContent) return null
    return getAppliedFilterPresetId(fetchedSvgContent)
  }, [isVectorMode, fetchedSvgContent])

  const originalFilterPresetParams = useMemo(() => {
    if (!isVectorMode || !fetchedSvgContent) return null
    return getAppliedFilterPresetParams(fetchedSvgContent)
  }, [isVectorMode, fetchedSvgContent])

  // Extract fill and stroke from the original SVG (vector mode only)
  const originalFillStroke = useMemo(() => {
    if (!isVectorMode || !fetchedSvgContent) return null
    return getAppliedFillStroke(fetchedSvgContent)
  }, [isVectorMode, fetchedSvgContent])

  const handleDrop = useCallback(
    (files: File[]) => {
      if (files.length === 0) return

      const file = files[0]

      if (isVectorMode) {
        // Vector mode: validate SVG file type
        if (!ALLOWED_SVG_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.svg')) {
          return
        }

        // Read the SVG file content as text to allow style transfer
        const reader = new FileReader()
        reader.onload = e => {
          let svgContent = e.target?.result as string

          // Apply complete style transfer from original SVG (filter + fill + stroke)
          const hasStylesToTransfer = originalFilterPresetId || originalFillStroke?.fill || originalFillStroke?.stroke
          if (hasStylesToTransfer) {
            svgContent = applyStyleTransferToSvg(svgContent, {
              filterPresetId: originalFilterPresetId ?? undefined,
              filterPresetParams: originalFilterPresetParams ?? undefined,
              fill: originalFillStroke?.fill,
              stroke: originalFillStroke?.stroke,
              strokeWidth: originalFillStroke?.strokeWidth,
              // If original SVG has stroke but no fill, remove fill from uploaded SVG
              removeFillIfNoFill: true,
            })
          }

          // Convert to data URI for storage
          const dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`

          // Create a new vector file entry
          const newFile = {
            _id: `vector-${Date.now()}`,
            name: file.name,
            src: dataUri,
            selecting: false,
            source: 'upload' as const,
          }

          // Update option set with new file
          const currentFiles = (optionSet?.data as Record<string, unknown[]> | null)?.files || []
          const updatedOptionSet = {
            ...optionSet,
            data: {
              ...optionSet.data,
              files: [...currentFiles, newFile],
            },
          } as OptionSet

          layerStore?.dispatch({
            type: 'UPDATE_OPTION_SET',
            payload: { optionSet: updatedOptionSet },
            skipTrace: true,
          })

          // Select the new file
          onSelect(updatedOptionSet, newFile._id)
        }

        // Read as text to preserve SVG structure for filter application
        reader.readAsText(file)
      } else {
        // Image mode: open preview modal
        openModal(UPLOAD_PREVIEW_MODAL_ID, {
          ...modalData,
          layerId,
          url: URL.createObjectURL(file),
          layerDimensions,
          name: file.name,
          source: 'upload',
          onReplace: toggleOpenFileDialog,
          optionSet,
          onSelect,
        })
      }
    },
    [
      isVectorMode,
      openModal,
      modalData,
      layerId,
      layerDimensions,
      toggleOpenFileDialog,
      optionSet,
      onSelect,
      layerStore,
      originalFilterPresetId,
      originalFilterPresetParams,
      originalFillStroke,
    ]
  )

  const activator = (
    <Button
      fullWidth
      onClick={toggleOpenFileDialog}
      icon={UploadIcon}
      aria-label={isVectorMode ? 'Upload SVG' : 'Upload image'}
      disabled={disabled}
    >
      {t('upload')}
    </Button>
  )

  return (
    <div className="emtlkit--flex-1">
      {disabled ? (
        <Tooltip
          content={`You have uploaded ${MAX_UPLOAD_IMAGES} images. Click View button below an image to replace it.`}
        >
          {activator}
        </Tooltip>
      ) : (
        activator
      )}
      <div style={{ display: 'none' }}>
        <DropZone
          openFileDialog={openFileDialog}
          allowMultiple={false}
          type={isVectorMode ? 'file' : 'image'}
          accept={isVectorMode ? ALLOWED_SVG_EXTENSIONS : ALLOWED_IMAGE_EXTENSIONS.join(',')}
          onDrop={handleDrop}
          onFileDialogClose={toggleOpenFileDialog}
        />
      </div>
    </div>
  )
}

const ImageOptionAIGenerate = (props: ImageOptionGenerateAIProps) => {
  const {
    isAiGeneratedLimited,
    layerId,
    layerDimensions,
    disabled,
    optionSet,
    onSelect,
    generativeOptions,
    allowCustomerToUseReferenceImage,
    enabledQuickPrompts,
    allowCustomerToUseQuickPrompts,
    aiGeneratorRef,
    onGenerateClick,
    onFocusGenerator,
    mode = 'image',
    layerStore,
    originalSvgSrc,
  } = props
  const { state, openModal } = useModal()
  const modalData = useMemo(() => state[UPLOAD_PREVIEW_MODAL_ID]?.data || {}, [state])
  const [imageOptions, setImageOptions] = useState<IImageQuery[]>([])
  const { t } = useTranslation()
  const { uploadFiles } = useUploadFiles()
  const localContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = aiGeneratorRef ?? localContainerRef

  const isVectorMode = mode === 'vector'

  // State to hold fetched SVG content (for vector mode - CDN URLs)
  const [fetchedSvgContent, setFetchedSvgContent] = useState<string | null>(null)

  // Decode the original SVG content or fetch from URL (vector mode only)
  useEffect(() => {
    if (!isVectorMode || !originalSvgSrc) {
      setFetchedSvgContent(null)
      return
    }

    // Handle data URI - decode the SVG content directly
    if (originalSvgSrc.startsWith('data:image/svg+xml')) {
      try {
        const base64Match = originalSvgSrc.match(/^data:image\/svg\+xml;base64,(.+)$/i)
        if (base64Match) {
          setFetchedSvgContent(atob(base64Match[1]))
          return
        }
        const urlEncodedMatch = originalSvgSrc.match(/^data:image\/svg\+xml,(.+)$/i)
        if (urlEncodedMatch) {
          setFetchedSvgContent(decodeURIComponent(urlEncodedMatch[1]))
          return
        }
      } catch {
        setFetchedSvgContent(null)
      }
      return
    }

    // Handle CDN URL - fetch the SVG content
    if (originalSvgSrc.startsWith('http') && originalSvgSrc.toLowerCase().includes('.svg')) {
      fetch(originalSvgSrc)
        .then(res => res.text())
        .then(svgText => {
          if (svgText.includes('<svg')) {
            setFetchedSvgContent(svgText)
          }
        })
        .catch(() => {
          setFetchedSvgContent(null)
        })
    }
  }, [isVectorMode, originalSvgSrc])

  // Extract filter preset and fill/stroke from the original SVG (vector mode only)
  const vectorOptions: VectorGenerationOptions | undefined = useMemo(() => {
    if (!isVectorMode || !fetchedSvgContent) return undefined
    const fillStroke = getAppliedFillStroke(fetchedSvgContent)
    return {
      filterPresetId: getAppliedFilterPresetId(fetchedSvgContent) ?? undefined,
      filterPresetParams: getAppliedFilterPresetParams(fetchedSvgContent) ?? undefined,
      fill: fillStroke?.fill,
      stroke: fillStroke?.stroke,
      strokeWidth: fillStroke?.strokeWidth,
    }
  }, [isVectorMode, fetchedSvgContent])

  const nearestAspectRatio = useMemo(
    () =>
      findNearestAspectRatio(
        { width: layerDimensions.width || 0, height: layerDimensions.height || 0 },
        AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS as unknown as string[]
      )?.label || '1:1',
    [layerDimensions.height, layerDimensions.width]
  )

  const createScopedImageFileInput = useCallback(
    (onFileSelected: (file: File) => void, onCancel?: () => void, onError?: (message: string) => void) => {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = '.png,.jpg,.jpeg,.webp'
      fileInput.style.display = 'none'
      fileInput.multiple = false

      const cleanup = () => {
        if (fileInput.parentNode) {
          fileInput.parentNode.removeChild(fileInput)
        }
      }

      fileInput.addEventListener('change', e => {
        const files = (e.target as HTMLInputElement).files
        if (!files || files.length === 0) {
          cleanup()
          onCancel?.()
          return
        }

        const file = files[0]
        // Validate file type (browsers may not strictly enforce accept attribute)
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          cleanup()
          onError?.(t('only-png-jpg-or-webp-files-are-allowed', 'Only .png, .jpg, or .webp files are allowed.'))
          onCancel?.()
          return
        }

        onFileSelected(file)
        setTimeout(cleanup, 0)
      })

      fileInput.addEventListener('cancel', () => {
        onCancel?.()
        cleanup()
      })

      const handleFocus = () => {
        setTimeout(() => {
          if (fileInput.parentNode) {
            onCancel?.()
            cleanup()
          }
        }, 300)
      }

      window.addEventListener('focus', handleFocus, { once: true })

      const parent = containerRef.current || document.body
      parent.appendChild(fileInput)
      requestAnimationFrame(() => fileInput.click())
    },
    [containerRef, t]
  )

  const onSelectImages = useCallback(
    (images: IImageQuery[]) => {
      openModal(UPLOAD_PREVIEW_MODAL_ID, {
        ...modalData,
        layerId,
        url: images[0].image.originalSrc,
        layerDimensions,
        name: images[0].alt,
        source: 'ai',
        onReplace: onFocusGenerator ?? (() => {}),
        optionSet,
        onSelect,
      })
    },
    [openModal, modalData, layerId, layerDimensions, optionSet, onSelect, onFocusGenerator]
  )

  const onClickAddReferenceImageButton = useCallback(() => {
    return new Promise<{ files: Array<{ name: string; size: number; type: string; url: string }>; error?: string }>(
      resolve => {
        let errorMessage: string | undefined

        createScopedImageFileInput(
          async file => {
            try {
              const results = await uploadFiles([file])
              const first = Array.isArray(results) ? results[0] : results
              const uploaded = first?.data?.uploadedFiles?.[0]
              const url = uploaded?.image?.originalSrc
              if (url) {
                resolve({ files: [{ name: file.name, size: file.size, type: file.type, url }] })
              } else {
                resolve({ files: [], error: 'Failed to upload image' })
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Upload failed'
              resolve({ files: [], error: message })
            }
          },
          () => {
            resolve({ files: [], error: errorMessage })
          },
          error => {
            errorMessage = error
          }
        )
      }
    )
  }, [uploadFiles, createScopedImageFileInput])

  /**
   * Handler for vector generation - creates file entry and updates option set
   * Only used when mode='vector'
   */
  const onSelectVector = useCallback(
    (result: VectorGenerationResult) => {
      if (!layerStore) return

      let svgSrc = result.svgUrl || result.svgDataUri
      if (!svgSrc) return

      // Check if we have any styles to transfer (filter, fill, or stroke)
      const hasStylesToTransfer = vectorOptions?.filterPresetId || vectorOptions?.fill || vectorOptions?.stroke

      // Apply complete style transfer as fallback (backend should already apply it)
      if (hasStylesToTransfer && result.svgDataUri && !result.svgUrl) {
        try {
          const base64Match = result.svgDataUri.match(/^data:image\/svg\+xml;base64,(.+)$/i)
          if (base64Match) {
            let svgContent = atob(base64Match[1])
            // Only apply if filter is not already present
            if (!getAppliedFilterPresetId(svgContent)) {
              svgContent = applyStyleTransferToSvg(svgContent, {
                filterPresetId: vectorOptions?.filterPresetId,
                filterPresetParams: vectorOptions?.filterPresetParams ?? undefined,
                fill: vectorOptions?.fill,
                stroke: vectorOptions?.stroke,
                strokeWidth: vectorOptions?.strokeWidth,
                // If original SVG has stroke but no fill, remove fill from generated SVG
                removeFillIfNoFill: true,
              })
              svgSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`
            }
          }
        } catch {
          // Use original result on error
        }
      }

      // Create a new vector file entry
      const newFile = {
        _id: `vector-ai-${Date.now()}`,
        name: 'AI Generated Shape',
        src: svgSrc,
        selecting: false,
        source: 'ai' as const,
      }

      // Update option set with new file
      const currentFiles = (optionSet?.data as Record<string, unknown[]> | null)?.files || []
      const updatedOptionSet = {
        ...optionSet,
        data: {
          ...optionSet.data,
          files: [...currentFiles, newFile],
        },
      } as OptionSet

      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: { optionSet: updatedOptionSet },
        skipTrace: true,
      })

      // Select the new file
      onSelect(updatedOptionSet, newFile._id)
    },
    [layerStore, optionSet, onSelect, vectorOptions]
  )

  const limitMessage = `AI has generated ${MAX_AI_GENERATED_IMAGES} images.`

  return (
    <div className="emtlkit--flex-1" ref={containerRef} tabIndex={-1}>
      <PopoverAIImageGenerator
        layout="section"
        mode={mode}
        mainTextLabel={
          allowCustomerToUseReferenceImage ? (
            <InlineStack gap={'050'} wrap={false} blockAlign="center">
              <Text variant="bodyMd" as="p" fontWeight="semibold">
                {t('what-s-this-image-about')}
              </Text>
              <Tooltip
                content={t(
                  // eslint-disable-next-line max-len
                  'if-using-a-reference-image-describe-only-what-to-change-or-add-be-specific-and-use-no-extra-objects-to-avoid-unwanted-details'
                )}
              >
                <Icon source={InfoIcon} tone="subdued" />
              </Tooltip>
            </InlineStack>
          ) : (
            t('what-s-this-image-about')
          )
        }
        placeholderMainTextLabel={t('type-your-idea-or-click-a-quick-prompt-below-to-save-time')}
        numberGeneratedImages={1}
        initialImageOptions={imageOptions}
        allowMultiple={false}
        setInitialImageOptions={setImageOptions}
        onSelectImages={onSelectImages}
        onSelectVector={isVectorMode ? onSelectVector : undefined}
        vectorOptions={vectorOptions}
        generativeOptions={{
          ...(generativeOptions || {}),
          aspectRatio:
            ((generativeOptions as Record<string, unknown>)?.aspectRatio as string | undefined) || nearestAspectRatio,
        }}
        allowCustomerToUseReferenceImage={allowCustomerToUseReferenceImage}
        enabledQuickPrompts={enabledQuickPrompts}
        allowCustomerToUseQuickPrompts={allowCustomerToUseQuickPrompts}
        onClickAddReferenceImageButton={onClickAddReferenceImageButton}
        disabledGenerate={disabled}
        disabledGenerateMessage={isAiGeneratedLimited ? limitMessage : undefined}
        onGenerateButtonClick={onGenerateClick}
      />
    </div>
  )
}

export const ImageOptionSet = ({ optionSet, onSelect, layerStore, groupId = '' }: IOptionSetComponentProps) => {
  const layerId = useStore(layerStore, state => state._id)
  const layerSettings = useStore(layerStore, state => state.settings) as ImageSettings | undefined
  const layerWidth = useStore(layerStore, state => state.width)
  const layerHeight = useStore(layerStore, state => state.height)
  const { t } = useTranslation()
  const layerDimensions = useMemo(
    () => ({
      width: layerWidth,
      height: layerHeight,
    }),
    [layerWidth, layerHeight]
  )

  // Check if this is an SVG image layer
  const image = useStore(layerStore, state => state.image)
  const imageSrc = image?.src || image?.dataSrc
  const isVectorImage = useMemo(() => isSvgImage(imageSrc), [imageSrc])

  const imageUploaderConfig = useMemo(() => {
    // Read from layer settings as primary source (option set data is deprecated)
    // Uses unified imageUploaderOptions for both raster and vector images
    const imageUploaderOptions = layerSettings?.imageUploaderOptions || {}

    return {
      generativeOptions: (layerSettings as ImageSettings & { generativeOptions?: GenerativeOptions })
        ?.generativeOptions,
      allowCustomerUploadImage:
        imageUploaderOptions.allowCustomerUploadImage ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerUploadImage,
      allowCustomerGenerateImageWithAI:
        imageUploaderOptions.allowCustomerGenerateImageWithAI
        ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerGenerateImageWithAI,
      allowCustomerToUseReferenceImage:
        imageUploaderOptions.allowCustomerToUseReferenceImage
        ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerToUseReferenceImage,
      enabledQuickPrompts:
        imageUploaderOptions.enabledQuickPrompts ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.enabledQuickPrompts,
      enabledTemplateTypes:
        imageUploaderOptions.enabledTemplateTypes ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.enabledTemplateTypes,
      enabledVisualStyles:
        imageUploaderOptions.enabledVisualStyles ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.enabledVisualStyles,
      enabledContentThemes:
        imageUploaderOptions.enabledContentThemes ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.enabledContentThemes,
      allowCustomerToUseQuickPrompts:
        imageUploaderOptions.allowCustomerToUseQuickPrompts
        ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerToUseQuickPrompts,
      allowCustomerToUseTemplateTypes:
        imageUploaderOptions.allowCustomerToUseTemplateTypes
        ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerToUseTemplateTypes,
      allowCustomerToUseVisualStyles:
        imageUploaderOptions.allowCustomerToUseVisualStyles
        ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerToUseVisualStyles,
      allowCustomerToUseContentThemes:
        imageUploaderOptions.allowCustomerToUseContentThemes
        ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerToUseContentThemes,
    }
  }, [layerSettings])

  const {
    generativeOptions,
    allowCustomerUploadImage,
    allowCustomerGenerateImageWithAI,
    allowCustomerToUseReferenceImage,
    enabledQuickPrompts,
    enabledTemplateTypes,
    enabledVisualStyles,
    enabledContentThemes,
    allowCustomerToUseQuickPrompts,
    allowCustomerToUseTemplateTypes,
    allowCustomerToUseVisualStyles,
    allowCustomerToUseContentThemes,
  } = imageUploaderConfig

  // Derive the image creation mode from mutually exclusive flags (Fix EMTLKIT-5105)
  // This matches the pattern used in the Editor's Image component (Image/index.tsx:153-157)
  const imageCreatedBy: 'merchant' | 'customers' | undefined = useMemo(() => {
    const enableBuyerImage
      = layerSettings?.enableBuyerImage
      ?? layerSettings?.imageUploaderOptions?.allowCustomerGenerateImageWithAI
      ?? layerSettings?.imageUploaderOptions?.allowCustomerUploadImage
      ?? false
    const enableSellerImage
      = layerSettings?.enableSellerImage ?? layerSettings?.imageUploaderOptions?.allowCustomerUseImageOptionSet ?? false

    // Mutually exclusive: only one mode should be active at a time
    if (enableBuyerImage && !enableSellerImage) return 'customers'
    if (enableSellerImage && !enableBuyerImage) return 'merchant'
    return undefined
  }, [layerSettings])

  const [openFileDialog, setOpenFileDialog] = useState(false)
  const aiGeneratorRef = useRef<HTMLDivElement>(null)

  const { trackEvent } = useEventsTracking()
  const location = useLocation()
  const isTemplatePreview = location.pathname.includes('templates')

  const toggleOpenFileDialog = useCallback(() => {
    setOpenFileDialog(prev => !prev)

    if (!openFileDialog) {
      trackEvent(EVENTS_TRACKING.UPLOAD_IMAGE_OPTION_SET, {
        [EVENTS_PARAMETERS_NAME.UPLOAD_IMAGE_FROM]: isTemplatePreview ? 'template_preview' : 'onboarding',
      })
    }
  }, [openFileDialog, isTemplatePreview, trackEvent])

  const handleScrollToAIGenerator = useCallback(() => {
    if (!allowCustomerGenerateImageWithAI) return
    requestAnimationFrame(() => {
      aiGeneratorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      aiGeneratorRef.current?.focus?.()
    })
  }, [allowCustomerGenerateImageWithAI])

  const handleGenerateButtonClick = useCallback(() => {
    trackEvent(EVENTS_TRACKING.AI_GENERATE_IMAGE, {
      [EVENTS_PARAMETERS_NAME.AI_GENERATE_FROM]: isTemplatePreview ? 'template_preview' : 'onboarding',
    })
  }, [isTemplatePreview, trackEvent])

  const handleReplaceImage = useCallback(
    (source?: ImageOptionSetTypeWithSource['source']) => {
      if (source === 'upload') {
        toggleOpenFileDialog()
        return
      }

      handleScrollToAIGenerator()
    },
    [toggleOpenFileDialog, handleScrollToAIGenerator]
  )

  const optionSetFiles: ImageOptionSetTypeWithSource[] = useMemo(
    () => ((optionSet?.data as Record<string, unknown[]> | null)?.files as ImageOptionSetTypeWithSource[]) || [],
    [optionSet?.data]
  )

  // Separate uploaded/generated files and base option set files
  const uploadedGeneratedFiles = useMemo(
    () => optionSetFiles.filter(file => file.source === 'upload' || file.source === 'ai'),
    [optionSetFiles]
  )

  const baseOptionFiles = useMemo(() => optionSetFiles.filter(file => !file.source), [optionSetFiles])

  const enhancedOptionSet = useMemo(
    () => ({
      ...optionSet,
      data: {
        ...optionSet?.data,
        files: optionSetFiles,
      },
    }),
    [optionSet, optionSetFiles]
  )

  // Option set for tailorkit list should exclude uploaded/generated files
  const baseOptionSet = useMemo(
    () => ({
      ...optionSet,
      data: {
        ...optionSet?.data,
        files: baseOptionFiles,
      },
    }),
    [optionSet, baseOptionFiles]
  )

  const computedStates = useMemo(() => {
    // Unified settings: allowCustomerUploadImage and allowCustomerGenerateImageWithAI
    // work for both raster and vector images - file type detection handles rendering
    const hasActions = allowCustomerUploadImage || allowCustomerGenerateImageWithAI
    const hasFiles = optionSetFiles.length > 0

    const countImages = (source: 'upload' | 'ai') => optionSetFiles.filter(file => file.source === source).length
    const isUploadLimited = countImages('upload') >= MAX_UPLOAD_IMAGES
    const isAiGeneratedLimited = countImages('ai') >= MAX_AI_GENERATED_IMAGES

    return {
      hasActions,
      hasFiles,
      isUploadLimited,
      isAiGeneratedLimited,
    }
  }, [allowCustomerUploadImage, allowCustomerGenerateImageWithAI, optionSetFiles])

  const { hasActions, isUploadLimited, isAiGeneratedLimited } = computedStates

  // Format option set data for TailorKit web component
  const _optionSet = useMemo(() => getOptionSetFormatted(baseOptionSet as OptionSet, t), [baseOptionSet, t])

  // Bridge selection events emitted from the web component to the parent handler
  const handleSelect = useCallback(
    (os: OptionSet, id: string) => {
      onSelect(os as OptionSet, id)
    },
    [onSelect]
  )

  const handleDelete = useCallback(
    (fileId: string) => {
      // Filter out the deleted file
      const updatedFiles = optionSetFiles.filter(file => file._id !== fileId)

      // Find fallback selection: prefer original images (no source), then other uploaded/ai images
      let fallbackFile = updatedFiles.find(file => !file.source)
      if (!fallbackFile && updatedFiles.length > 0) {
        fallbackFile = updatedFiles[0]
      }

      // Update the option set with filtered files
      const updatedOptionSet = {
        ...optionSet,
        data: {
          ...optionSet.data,
          files: updatedFiles,
        },
      } as OptionSet

      // Dispatch UPDATE_OPTION_SET to update the files array
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: updatedOptionSet,
        },
        skipTrace: true,
      })

      // If we have a fallback, select it
      if (fallbackFile) {
        onSelect(updatedOptionSet as OptionSet, fallbackFile._id)
      }
    },
    [optionSetFiles, optionSet, layerStore, onSelect]
  )

  useEffect(() => {
    const handleOptionSetClick = (event: Event) => {
      const { detail } = event as CustomEvent
      if (detail?.optionSet?.ol) {
        const selectedOption = detail.optionSet.ol.find((opt: { selecting: boolean; i: string }) => opt.selecting)

        if (
          selectedOption
          && detail?.optionSet?.i === optionSet._id
          && detail?.currentPrintAreaId === groupId
          && detail?.currentLayerId === layerId
        ) {
          handleSelect(optionSet as OptionSet, selectedOption.i)
        }
      }
    }

    document.addEventListener(tlkOptionSetClickEvent, handleOptionSetClick as EventListener)

    return () => {
      document.removeEventListener(tlkOptionSetClickEvent, handleOptionSetClick as EventListener)
    }
  }, [groupId, handleSelect, layerId, optionSet])

  const WebComponentContainer = useMemo(() => {
    if (!_optionSet?.ol?.length) return null

    return (
      <tailorkit-image-options-list
        data-option-set-data={JSON.stringify(_optionSet)}
        data-current-print-area-id={groupId}
        data-current-option-set-id={optionSet._id}
        data-option-set-type={optionSet.type}
        data-can-default-select={false}
      />
    )
  }, [_optionSet, groupId, optionSet._id, optionSet.type])

  return (
    <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8" data-current-option-set-id={optionSet._id}>
      {/* Buyer's Image Actions - Only show when imageCreatedBy === 'customers' (Fix EMTLKIT-5105) */}
      {imageCreatedBy === 'customers' && hasActions && (
        <Fragment>
          {isVectorImage ? (
            // Vector image actions (SVG upload/generate)
            // Uses unified ImageOptionAIGenerate with mode="vector" for consistent UI
            <Fragment>
              {allowCustomerGenerateImageWithAI && (
                <ImageOptionAIGenerate
                  isAiGeneratedLimited={isAiGeneratedLimited}
                  layerId={layerId}
                  layerDimensions={layerDimensions}
                  disabled={isAiGeneratedLimited}
                  optionSet={enhancedOptionSet}
                  onSelect={onSelect}
                  generativeOptions={generativeOptions}
                  allowCustomerToUseReferenceImage={allowCustomerToUseReferenceImage}
                  enabledQuickPrompts={enabledQuickPrompts}
                  enabledTemplateTypes={enabledTemplateTypes}
                  enabledVisualStyles={enabledVisualStyles}
                  enabledContentThemes={enabledContentThemes}
                  allowCustomerToUseQuickPrompts={allowCustomerToUseQuickPrompts}
                  allowCustomerToUseTemplateTypes={allowCustomerToUseTemplateTypes}
                  allowCustomerToUseVisualStyles={allowCustomerToUseVisualStyles}
                  allowCustomerToUseContentThemes={allowCustomerToUseContentThemes}
                  aiGeneratorRef={aiGeneratorRef}
                  onGenerateClick={handleGenerateButtonClick}
                  onFocusGenerator={handleScrollToAIGenerator}
                  mode="vector"
                  layerStore={layerStore}
                  originalSvgSrc={imageSrc}
                />
              )}
              {allowCustomerUploadImage && (
                <ImageOptionUpload
                  layerId={layerId}
                  layerDimensions={layerDimensions}
                  disabled={isUploadLimited}
                  openFileDialog={openFileDialog}
                  toggleOpenFileDialog={toggleOpenFileDialog}
                  optionSet={enhancedOptionSet}
                  onSelect={onSelect}
                  isVectorMode={true}
                  layerStore={layerStore}
                  originalSvgSrc={imageSrc}
                />
              )}
            </Fragment>
          ) : (
            // Raster image actions (image upload/generate)
            <Fragment>
              <div>
                {allowCustomerGenerateImageWithAI && (
                  <ImageOptionAIGenerate
                    isAiGeneratedLimited={isAiGeneratedLimited}
                    layerId={layerId}
                    layerDimensions={layerDimensions}
                    disabled={isAiGeneratedLimited}
                    optionSet={enhancedOptionSet}
                    onSelect={onSelect}
                    generativeOptions={generativeOptions}
                    allowCustomerToUseReferenceImage={allowCustomerToUseReferenceImage}
                    enabledQuickPrompts={enabledQuickPrompts}
                    enabledTemplateTypes={enabledTemplateTypes}
                    enabledVisualStyles={enabledVisualStyles}
                    enabledContentThemes={enabledContentThemes}
                    allowCustomerToUseQuickPrompts={allowCustomerToUseQuickPrompts}
                    allowCustomerToUseTemplateTypes={allowCustomerToUseTemplateTypes}
                    allowCustomerToUseVisualStyles={allowCustomerToUseVisualStyles}
                    allowCustomerToUseContentThemes={allowCustomerToUseContentThemes}
                    aiGeneratorRef={aiGeneratorRef}
                    onGenerateClick={handleGenerateButtonClick}
                    onFocusGenerator={handleScrollToAIGenerator}
                  />
                )}
              </div>
              {allowCustomerUploadImage && (
                <ImageOptionUpload
                  layerId={layerId}
                  layerDimensions={layerDimensions}
                  openFileDialog={openFileDialog}
                  toggleOpenFileDialog={toggleOpenFileDialog}
                  disabled={isUploadLimited}
                  optionSet={enhancedOptionSet}
                  onSelect={onSelect}
                />
              )}
            </Fragment>
          )}
        </Fragment>
      )}

      {/* Uploaded / Generated images/vectors - Only show in buyer mode (Fix EMTLKIT-5105) */}
      {imageCreatedBy === 'customers' && uploadedGeneratedFiles.length > 0 && (
        <div className="image-uploaded-generated-option-set-container emtlkit--d-flex emtlkit--flex-start emtlkit--gap-8 emtlkit--flex-wrap">
          {uploadedGeneratedFiles.map(file => (
            <ImageOption
              key={file._id}
              file={file}
              layerId={layerId}
              onSelect={onSelect}
              optionSet={enhancedOptionSet}
              layerDimensions={layerDimensions}
              onReplace={() => handleReplaceImage(file.source)}
              onDelete={handleDelete}
              isVectorMode={isVectorImage}
            />
          ))}
        </div>
      )}

      {/* Seller's Preset Images - Show for merchant mode AND undefined (legacy/unset state).
          Using !== 'customers' so buyer-upload UI stays hidden while still rendering
          for image layers where enableSellerImage/enableBuyerImage were never set. */}
      {imageCreatedBy !== 'customers' && WebComponentContainer}
    </div>
  )
}

// Extend JSX intrinsic elements map for the custom web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'tailorkit-image-options-list': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          ref?: React.RefObject<HTMLElement>
          'data-option-set-data'?: string
          'data-current-print-area-id'?: string
          'data-current-option-set-id'?: string
          'data-option-set-type'?: string
          'data-can-default-select'?: boolean | string
        },
        HTMLElement
      >
    }
  }
}
