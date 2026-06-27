import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { TOAST } from '~/constants/toasts'
import type { AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'
import { AI_ASSISTANT_SUGGESTION_ACTION, AI_IMAGE_EDIT_LIMITS } from '~/routes/api.ai-assistant.suggestion/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { IImageQuery } from '~/types/shopify-files'
import type { PromptPresetItem } from '~/api/services/prompt-presets'
import { showToast } from '~/utils/toastEvents'
import useDevices from '~/utils/hooks/useDevice'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { ALLOWED_IMAGE_TYPES, getImageMimeTypeFromUrl } from '~/constants/dropzone'
import { findNearestAspectRatio } from 'extensions/tailorkit-src/src/shared/libraries/template/calculateLayerRatio'
import {
  createVariablePlaceholder,
  computeFinalPrompt,
  hasVariables as checkHasVariables,
  type SelectedEffect,
} from 'extensions/tailorkit-src/src/shared/libraries/ai'
import type { GenerativeOptions } from '~/modules/TemplateEditor/components/Editor/utils/elementCreators'
import {
  DEFAULT_ERROR_MESSAGE,
  MAX_REFERENCE_FILES,
  isReferenceImageResult,
  type ReferenceImage,
  type ReferenceImageResult,
  type VectorGenerationResult,
  type VectorGenerationOptions,
} from './types'

interface UseAIImageGeneratorProps {
  generativeOptions?: GenerativeOptions
  initialImageOptions?: IImageQuery[]
  initialReferenceImages?: ReferenceImage[]
  numberGeneratedImages?: number
  setInitialImageOptions?: (imageOptions: IImageQuery[]) => void
  onSelectImages: (mediaFiles: IImageQuery[], generativeOptions?: GenerativeOptions) => void
  onClickAddReferenceImageButton?: () => void | Promise<ReferenceImage[] | ReferenceImageResult>
  enabledQuickPrompts?: string[]
  // Vector mode props
  mode?: 'image' | 'vector'
  vectorOptions?: VectorGenerationOptions
  onSelectVector?: (result: VectorGenerationResult) => void
}

export function useAIImageGenerator(props: UseAIImageGeneratorProps) {
  const {
    generativeOptions,
    initialImageOptions = [],
    initialReferenceImages = [],
    numberGeneratedImages = 1,
    setInitialImageOptions,
    onSelectImages,
    onClickAddReferenceImageButton,
    enabledQuickPrompts,
    mode = 'image',
    vectorOptions,
    onSelectVector,
  } = props

  const isVectorMode = mode === 'vector'

  const { t } = useTranslation()
  const { isMobileView } = useDevices()
  const { trackEvent } = useEventsTracking()
  const sectionRef = useRef<HTMLDivElement>(null)

  // Computed values
  const itemsPerRow = useMemo(() => (isMobileView ? 4 : 3), [isMobileView])

  // State
  const [prompt, setPrompt] = useState(generativeOptions?.prompt || '')
  const [placeholder, setPlaceholder] = useState('')
  const [selectedEffect, setSelectedEffect] = useState<SelectedEffect | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [imageOptions, setImageOptions] = useState<IImageQuery[]>(initialImageOptions)
  const [isSelectingImagesFromLibrary, setIsSelectingImagesFromLibrary] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(generativeOptions?.aspectRatio || '1:1')
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(initialReferenceImages)
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Derived state
  const existingImageOptions = useMemo(() => imageOptions.length > 0, [imageOptions])
  const hasVariables = useMemo(
    () => (selectedEffect?.instruction ? checkHasVariables(selectedEffect.instruction) : false),
    [selectedEffect]
  )

  // Auto-detect aspect ratio from reference image
  useEffect(() => {
    if (referenceImages.length > 0 && referenceImages[0]?.url) {
      const img = new Image()
      img.onload = () => {
        const result = findNearestAspectRatio(
          { width: img.width, height: img.height },
          AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS as unknown as string[]
        )
        if (result.label) {
          setAspectRatio(result.label as AllowedAspectRatio)
        }
      }
      img.src = referenceImages[0].url
    }
  }, [referenceImages])

  // Handlers - Prompt presets
  const onChangeImagePrompt = useCallback((value: string) => setPrompt(value), [])

  const onChangeQuickPrompt = useCallback((names: string[], instructions?: string[]) => {
    const name = names[0] || ''
    const instruction = instructions?.[0] || ''

    setSelectedEffect(name ? { name, instruction } : null)

    // Create placeholder text for variables using shared utility
    const variablePlaceholder = createVariablePlaceholder(instruction)
    setPrompt(variablePlaceholder)
    setPlaceholder('')
  }, [])

  const onRemoveSelectedEffect = useCallback(() => {
    setSelectedEffect(null)
    setPrompt('')
  }, [])

  const onChangeAspectRatio = useCallback((value: AllowedAspectRatio) => setAspectRatio(value), [])

  // Handlers - Scroll
  const scrollToBottom = useCallback(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollTo({
        top: sectionRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [])

  // Handlers - Generate (supports both image and vector modes)
  const handleGenerate = useCallback(async () => {
    try {
      setIsGenerating(true)
      setErrorMessage(null)

      setTimeout(() => {
        scrollToBottom()
      }, 50)

      // Compute final prompt using shared utility
      const finalPrompt = computeFinalPrompt(selectedEffect, prompt)

      if (isVectorMode) {
        // Vector generation mode
        const response = await authenticatedFetch('/api/ai-assistant/suggestion', {
          method: 'POST',
          body: JSON.stringify({
            action: AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_VECTOR,
            prompt: finalPrompt,
            aspectRatio: '1:1', // Vectors always use 1:1
            filterPresetId: vectorOptions?.filterPresetId,
            filterPresetParams: vectorOptions?.filterPresetParams,
            fill: vectorOptions?.fill,
            stroke: vectorOptions?.stroke,
            strokeWidth: vectorOptions?.strokeWidth,
            referenceImageUrls: referenceImages.map(image => image.url),
          }),
        })

        if (response?.success) {
          const result: VectorGenerationResult = {
            svgUrl: response.svgUrl || response.svgDataUri,
            svgDataUri: response.svgDataUri,
          }

          onSelectVector?.(result)
          trackEvent(EVENTS_TRACKING.BUILD_WITH_AI, {
            svgUrl: result.svgUrl,
            feature: 'ai_gen_vector_select',
          })
          localStorage.setItem('TLK_USE_AI_FEATURE_AT', Date.now().toString())
        } else {
          setErrorMessage(response?.error || DEFAULT_ERROR_MESSAGE)
        }
      } else {
        // Image generation mode (original behavior)
        const response = await authenticatedFetch('/api/ai-assistant/suggestion', {
          method: 'POST',
          body: JSON.stringify({
            action: AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_IMAGES,
            prompt: finalPrompt,
            aspectRatio,
            numberGeneratedImages,
            referenceImageUrls: referenceImages.map(image => image.url),
          }),
        })

        if (response?.success) {
          const generatedImages = response.uploadedImages.uploadedFiles || []
          if (generatedImages.length === 0) {
            setErrorMessage(DEFAULT_ERROR_MESSAGE)
            return
          }

          setImageOptions(prev => [...prev, ...generatedImages])
          if (setInitialImageOptions && typeof setInitialImageOptions === 'function') {
            setInitialImageOptions([...initialImageOptions, ...generatedImages])
          }

          // Auto-select the first generated image (skip gallery for faster UX)
          if (generatedImages.length > 0) {
            onSelectImages([generatedImages[0]], { prompt: finalPrompt, aspectRatio })
            trackEvent(EVENTS_TRACKING.BUILD_WITH_AI, {
              images: [generatedImages[0]],
              feature: 'ai_gen_image_select',
            })
            localStorage.setItem('TLK_USE_AI_FEATURE_AT', Date.now().toString())
          }
        } else {
          setErrorMessage(response?.error || DEFAULT_ERROR_MESSAGE)
        }
      }
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE)
      showToast(t(TOAST.ASSISTANT.GENERATION_FAILED), { isError: true })
    } finally {
      setIsGenerating(false)
      scrollToBottom()
    }
  }, [
    prompt,
    selectedEffect,
    aspectRatio,
    numberGeneratedImages,
    referenceImages,
    scrollToBottom,
    setInitialImageOptions,
    initialImageOptions,
    onSelectImages,
    trackEvent,
    t,
    isVectorMode,
    vectorOptions,
    onSelectVector,
  ])

  // Handlers - Select images
  const handleSelectImages = useCallback(
    (images: IImageQuery[]) => {
      onSelectImages(images, {
        prompt,
        aspectRatio,
      })

      trackEvent(EVENTS_TRACKING.BUILD_WITH_AI, {
        images,
        feature: 'ai_gen_image_select',
      })

      localStorage.setItem('TLK_USE_AI_FEATURE_AT', Date.now().toString())
    },
    [aspectRatio, onSelectImages, prompt, trackEvent]
  )

  const handleImageClick = useCallback(
    (image: IImageQuery) => {
      handleSelectImages([image])
    },
    [handleSelectImages]
  )

  // Handlers - Reference images
  const openImageSelector = useCallback(async () => {
    setIsSelectingImagesFromLibrary(true)
    setErrorMessage(null)
    if (typeof onClickAddReferenceImageButton === 'function') {
      try {
        const result = await onClickAddReferenceImageButton()

        // Handle both array format and ReferenceImageResult format
        const { files, error } = isReferenceImageResult(result)
          ? result
          : { files: Array.isArray(result) ? result : [], error: undefined }

        // Show error message if present
        if (error) {
          setErrorMessage(error)
        }

        if (files.length === 0) return

        // Validate file types - reuse validation from dropzone constants
        const validFiles = files.filter(file => file.url && ALLOWED_IMAGE_TYPES.includes(file.type))
        if (validFiles.length === 0) {
          setErrorMessage(t('only-png-jpg-or-webp-files-are-allowed', 'Only .png, .jpg, or .webp files are allowed.'))
          return
        }

        const remaining = Math.max(0, MAX_REFERENCE_FILES - referenceImages.length)
        const picked = validFiles.slice(0, remaining)
        setReferenceImages(prev => [...prev, ...picked])
      } catch (_e) {
        // Fall through to open library if custom handler fails
      } finally {
        setIsSelectingImagesFromLibrary(false)
      }

      return
    }
    setImageSelectorOpen(true)
    setIsSelectingImagesFromLibrary(false)
  }, [onClickAddReferenceImageButton, referenceImages.length, t])

  const closeImageSelector = useCallback(() => setImageSelectorOpen(false), [])

  const onSelectFromLibrary = useCallback(
    (images: IImageQuery[] | null) => {
      if (!images || !images.length) return closeImageSelector()

      // Filter and validate images using shared utility
      const validImages = images.filter(img => {
        const url = img?.image?.originalSrc
        if (!url) return false
        const mimeType = getImageMimeTypeFromUrl(url)
        return mimeType && ALLOWED_IMAGE_TYPES.includes(mimeType)
      })

      if (validImages.length === 0) {
        setErrorMessage(t('only-png-jpg-or-webp-files-are-allowed', 'Only .png, .jpg, or .webp files are allowed.'))
        closeImageSelector()
        return
      }

      const remaining = Math.max(0, MAX_REFERENCE_FILES - referenceImages.length)
      const picked = validImages.slice(0, remaining)
      const merged = picked.map(img => {
        const url = img.image.originalSrc
        return {
          name: img.alt || 'image.png',
          size: 0,
          type: getImageMimeTypeFromUrl(url) || 'image/png',
          url,
        }
      })
      setReferenceImages([...merged])
      closeImageSelector()
    },
    [referenceImages.length, closeImageSelector, t]
  )

  const removeReferenceImage = useCallback(
    (idx: number) => setReferenceImages(prev => prev.filter((_, i) => i !== idx)),
    []
  )

  // Filter functions
  const filterQuickPrompts = useCallback(
    (items: PromptPresetItem[]) =>
      enabledQuickPrompts === undefined
        ? items
        : enabledQuickPrompts.length > 0
          ? items.filter(item => enabledQuickPrompts.includes(item.name))
          : [],
    [enabledQuickPrompts]
  )

  return {
    // Refs
    sectionRef,

    // State
    prompt,
    placeholder,
    isGenerating,
    imageOptions,
    isSelectingImagesFromLibrary,
    aspectRatio,
    referenceImages,
    imageSelectorOpen,
    errorMessage,

    // Derived state
    existingImageOptions,
    itemsPerRow,
    hasVariables,
    isVectorMode,

    // Selected effect
    selectedEffect,

    // Handlers - Prompt presets
    onChangeImagePrompt,
    onChangeQuickPrompt,
    onChangeAspectRatio,
    onRemoveSelectedEffect,

    // Handlers - Generate
    handleGenerate,
    handleSelectImages,
    handleImageClick,

    // Handlers - Reference images
    openImageSelector,
    closeImageSelector,
    onSelectFromLibrary,
    removeReferenceImage,

    // Filter functions
    filterQuickPrompts,

    // Translation
    t,
  }
}
