import { MODAL_ID } from '~/constants/modal'
import { useTranslation } from 'react-i18next'
import type { ComplexAction } from '@shopify/polaris'
import { BlockStack, Modal, Text, TextField, Banner } from '@shopify/polaris'
import { useModal } from '~/utils/hooks/useModal'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { AiCreditExhaustedBanner } from '~/components/common/AiCreditExhaustedBanner'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import ImageSelector from '~/modules/modals/ImageSelector'
import type { IImageQuery } from '~/types/shopify-files'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import { useIntegrationEditorContext } from '~/modules/ProductEditor/contexts'
import { exportMockupCanvasAsDataUrl } from '~/modules/ProductEditor/utils/exportMockupCanvas'
import { AI_IMAGE_EDIT_LIMITS, type AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'
import { findNearestAspectRatio } from 'extensions/tailorkit-src/src/shared/libraries/template/calculateLayerRatio'
import { generatedMockupsStorage } from './generatedMockupsStorage'
import type { GeneratedMockup, Scene } from './types'
import { ScenesGrid } from './components/ScenesGrid'
import { ReferenceImageSection } from './components/ReferenceImageSection'
import { GeneratedMockupsSection } from './components/GeneratedMockupsSection'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { isTemporaryVariant } from '~/utils/integration/temporaryProduct'

interface IAIMockupModalProps extends WithVariantsProps {
  viewId?: string
}

/**
 * AI Mockup Modal component for selecting scenes and generating AI mockups
 */
export default function AIMockupModal(props: IAIMockupModalProps) {
  const { t } = useTranslation()
  const { state, closeModal, openModal } = useModal()
  const { variants, viewId } = props
  const { stageRef } = useIntegrationEditorContext()
  const { hasCredits } = useAiCreditsStatus()

  const isOpen = state[MODAL_ID.AI_MOCKUP_MODAL]?.active
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isScenesLoading, setIsScenesLoading] = useState<boolean>(false)
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(-1)
  const [prompt, setPrompt] = useState<string>('')
  const [isCreatingMockup, setIsCreatingMockup] = useState<boolean>(false)
  const [generatedMockups, setGeneratedMockups] = useState<GeneratedMockup[]>([])
  const [selectedMockupIds, setSelectedMockupIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedReferenceImage, setSelectedReferenceImage] = useState<IImageQuery | null>(null)
  const [imageSelectorOpen, setImageSelectorOpen] = useState<boolean>(false)
  const [mockupImageDataUrl, setMockupImageDataUrl] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState<AllowedAspectRatio>(AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS[0])
  const hasUserChangedRatioRef = useRef(false)
  const generatedMockupsRef = useRef<HTMLDivElement>(null)

  // Get current view and product base image
  const currentViewId = useMemo(() => {
    if (viewId) return viewId
    const firstVariant = variants[0]
    const mockup = firstVariant?.mockup
    return mockup?.selectedViewId || mockup?.views?.[0]?._id
  }, [variants, viewId])

  const baseProduct = useMemo(() => {
    const firstVariant = variants[0]
    if (!firstVariant) return null

    const product = firstVariant.product
    return product
  }, [variants])

  // Detect temporary products
  const isTemporary = useMemo(() => {
    const firstVariant = variants[0]
    return isTemporaryVariant(firstVariant?.id ?? '')
  }, [variants])

  // Get base product image from current view
  const baseProductImage = useMemo(() => {
    const firstVariant = variants[0]
    if (!firstVariant) return null

    const mockup = firstVariant.mockup
    const currentView = (mockup?.views || []).find(v => v._id === currentViewId)
    const viewBaseImage = currentView?.baseImage

    // Fallback to variant image or product featured image
    const mockupProductVariantImage = variants.find(v => !!v.image)
    const variantImage = mockupProductVariantImage?.image
    const productFeaturedImage = firstVariant.product?.featuredImage

    return viewBaseImage || variantImage || productFeaturedImage || null
  }, [variants, currentViewId])

  // Get current reference image (priority: selected image > mockup image > base product image)
  const currentReferenceImage = useMemo(() => {
    // 1. User selected image (highest priority)
    if (selectedReferenceImage?.image?.originalSrc) {
      return {
        url: selectedReferenceImage.image.originalSrc,
        width: selectedReferenceImage.image.width,
        height: selectedReferenceImage.image.height,
        altText: selectedReferenceImage.alt || t('reference-image'),
      }
    }
    // 2. Mockup image from canvas (new default)
    if (mockupImageDataUrl) {
      return {
        url: mockupImageDataUrl, // base64 data URL
        width: baseProductImage?.width || 0,
        height: baseProductImage?.height || 0,
        altText: t('mockup-reference-image'),
      }
    }
    // 3. Fallback to base product image
    return baseProductImage
  }, [selectedReferenceImage, mockupImageDataUrl, baseProductImage, t])

  const defaultAspectRatio = useMemo<AllowedAspectRatio>(() => {
    const width = currentReferenceImage?.width || 0
    const height = currentReferenceImage?.height || 0
    if (!width || !height) return AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS[0]

    const nearest = findNearestAspectRatio(
      { width, height },
      AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS as unknown as string[]
    )
    return (nearest?.label as AllowedAspectRatio) || AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS[0]
  }, [currentReferenceImage?.width, currentReferenceImage?.height])

  // Fetch scenes data when modal opens
  useEffect(() => {
    if (!isOpen) return

    const fetchScenes = async () => {
      setIsScenesLoading(true)
      try {
        const response = await authenticatedFetch('/api/ai-mockup-scenes', { preferCache: true })

        if (response && Array.isArray(response.scenes)) {
          setScenes(response.scenes)
          setSelectedSceneIndex(0)
          setPrompt(response.scenes[0]?.suggestPrompt || '')
        }
      } catch (error) {
        console.error('Error fetching AI mockup scenes:', error)
        setScenes([])
      } finally {
        setIsScenesLoading(false)
      }
    }

    fetchScenes()
  }, [isOpen])

  // Load generated mockups from storage when modal opens or viewId changes
  useEffect(() => {
    if (isOpen && currentViewId) {
      const stored = generatedMockupsStorage.get(currentViewId) || []
      setGeneratedMockups(stored)
      // Keep selection only for mockups that still exist (e.g. after switching views)
      setSelectedMockupIds(prev => prev.filter(id => stored.some(m => m.id === id)))
    }
  }, [isOpen, currentViewId])

  // If mockups list changes (e.g. new generated, cleared, etc.), prune selection.
  useEffect(() => {
    setSelectedMockupIds(prev => prev.filter(id => generatedMockups.some(m => m.id === id)))
  }, [generatedMockups])

  // Initialize aspect ratio when modal opens (auto from reference image size).
  useEffect(() => {
    if (!isOpen) return
    if (hasUserChangedRatioRef.current) return
    setAspectRatio(defaultAspectRatio)
  }, [isOpen, defaultAspectRatio])

  // Generate mockup image from canvas when modal opens and canvas is ready
  useEffect(() => {
    if (!isOpen || !stageRef.current) {
      return
    }

    let isCancelled = false

    const generateMockupImage = async () => {
      try {
        const dataUrl = await exportMockupCanvasAsDataUrl(stageRef)

        if (!isCancelled && dataUrl) {
          setMockupImageDataUrl(dataUrl)
        } else if (!isCancelled) {
          // Export failed, fallback to base product image (already handled in currentReferenceImage)
          setMockupImageDataUrl(null)
        }
      } catch (error) {
        console.error('Error generating mockup image from canvas:', error)
        if (!isCancelled) {
          setMockupImageDataUrl(null)
        }
      }
    }

    // Small delay to ensure canvas is fully rendered
    const timeoutId = setTimeout(() => {
      generateMockupImage()
    }, 100)

    return () => {
      isCancelled = true
      clearTimeout(timeoutId)
    }
  }, [isOpen, stageRef])

  // Auto-scroll to generated mockups section when generation starts
  useEffect(() => {
    // Scroll immediately when generation starts (user clicked Generate/Regenerate)
    if (isCreatingMockup && generatedMockupsRef.current) {
      // Small delay to ensure the loading skeleton is rendered
      const timeoutId = setTimeout(() => {
        if (generatedMockupsRef.current) {
          generatedMockupsRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [isCreatingMockup])

  // NOTE:
  // We intentionally do NOT auto-fill the prompt from scenes.
  // The TextField prompt is treated as pure user instructions,
  // while the scene preset is sent separately.

  const onClose = useCallback(() => {
    closeModal(MODAL_ID.AI_MOCKUP_MODAL)
    // Reset state when closing (but keep generatedMockups - they're persisted in storage)
    setSelectedSceneIndex(-1)
    setPrompt('')
    setIsCreatingMockup(false)
    // Don't reset generatedMockups - they're persisted per view
    setSelectedMockupIds([])
    setError(null)
    setSelectedReferenceImage(null)
    setImageSelectorOpen(false)
    setMockupImageDataUrl(null)
    setAspectRatio(AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS[0])
    hasUserChangedRatioRef.current = false
  }, [closeModal])

  const selectedMockupUrls = useMemo(() => {
    if (!selectedMockupIds.length) return []
    const selectedSet = new Set(selectedMockupIds)
    return generatedMockups.filter(m => selectedSet.has(m.id)).map(m => m.url)
  }, [generatedMockups, selectedMockupIds])

  const handleToggleMockup = useCallback((mockupId: string) => {
    setSelectedMockupIds(prev => (prev.includes(mockupId) ? prev.filter(id => id !== mockupId) : [...prev, mockupId]))
  }, [])

  const handleSceneSelect = useCallback(
    (index: number) => {
      setSelectedSceneIndex(index)
      if (index !== -1) {
        setPrompt(scenes[index]?.suggestPrompt || '')
      }
    },
    [scenes]
  )

  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value)
    setError(null)
  }, [])

  const handleOpenImageSelector = useCallback(() => {
    setImageSelectorOpen(true)
  }, [])

  const handleCloseImageSelector = useCallback(() => {
    setImageSelectorOpen(false)
  }, [])

  const handleSelectImageFromLibrary = useCallback((images: IImageQuery[] | null) => {
    setImageSelectorOpen(false)
    setError(null)

    if (!images || !images.length) {
      return
    }

    // Only allow one image - take the first one
    const selectedImage = images[0]
    setSelectedReferenceImage(selectedImage)
  }, [])

  const handleResetToBaseImage = useCallback(() => {
    setSelectedReferenceImage(null)
  }, [])

  /**
   * Generate AI mockup using the API endpoint
   */
  const handleCreateMockup = useCallback(async () => {
    showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_GENERATING))
    setIsCreatingMockup(true)
    setSelectedMockupIds([])
    setError(null)
    const selectedScene = scenes[selectedSceneIndex]
    const sceneText = selectedScene?.scene || ''

    // Reference image is required for AI mockup generation
    if (!currentReferenceImage?.url) {
      setError(t('base-product-image-required-for-ai-mockup'))
      setIsCreatingMockup(false)
      showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_GENERATE_FAILED), { isError: true })
      return
    }

    // Determine if we should use base64 data URL (mockup image) or URL (selected/base product image)
    const isUsingMockupImage = mockupImageDataUrl && !selectedReferenceImage
    // Only send user's custom prompt if they modified it from the default suggestPrompt
    const defaultPrompt = selectedScene?.suggestPrompt || ''
    const userCustomPrompt = prompt.trim() !== defaultPrompt.trim() ? prompt.trim() : ''

    const requestBody: {
      scene: string
      prompt: string
      aspectRatio: AllowedAspectRatio
      referenceImageUrl?: string
      referenceImageData?: string
      numberGeneratedImages: number
      productTitle?: string
    } = {
      scene: sceneText,
      prompt: userCustomPrompt,
      numberGeneratedImages: 1,
      aspectRatio,
      productTitle: baseProduct?.title,
    }

    if (isUsingMockupImage && mockupImageDataUrl) {
      // Use base64 data URL from canvas mockup
      requestBody.referenceImageData = mockupImageDataUrl
    } else {
      // Use URL (selected image or base product image)
      requestBody.referenceImageUrl = currentReferenceImage.url
    }

    try {
      const response = await authenticatedFetch('/api/ai-mockup-scenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.success) {
        showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_GENERATE_FAILED), { isError: true })
        throw new Error(response.error || t('failed-to-generate-mockup'))
      }

      if (response.mockupUrl) {
        // Add new mockup to the beginning of the array
        const newMockup: GeneratedMockup = {
          url: response.mockupUrl,
          id: `mockup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          aspectRatio,
        }
        setGeneratedMockups(prev => {
          const updated = [newMockup, ...prev]
          // Save to storage for persistence across modal open/close
          if (currentViewId) {
            generatedMockupsStorage.set(currentViewId, updated)
          }
          return updated
        })
        showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_GENERATED))
      } else {
        showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_GENERATE_FAILED), { isError: true })
        throw new Error(t('no-mockup-url-returned'))
      }
    } catch (error) {
      console.error('Error creating mockup:', error)
      setError(error instanceof Error ? error.message : t('failed-to-generate-mockup-please-try-again'))
      showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_GENERATE_FAILED), { isError: true })
    } finally {
      setIsCreatingMockup(false)
    }
  }, [
    scenes,
    selectedSceneIndex,
    prompt,
    currentReferenceImage,
    selectedReferenceImage,
    mockupImageDataUrl,
    currentViewId,
    aspectRatio,
    baseProduct?.title,
    t,
  ])

  /**
   * Open confirmation modal to apply selected mockups to Shopify product media.
   */
  const handleOpenApplyConfirmModal = useCallback(() => {
    if (!selectedMockupUrls.length) return
    const productId = baseProduct?.id
    if (!productId) {
      setError(t('failed-to-save-mockup'))
      return
    }

    closeModal(MODAL_ID.AI_MOCKUP_MODAL)

    // Use numeric product id in route param to avoid GID slashes.
    const productNumberId = formatShopifyObjectIdToNumberId(productId, PREFIX_PRODUCT_ID)

    openModal(MODAL_ID.APPLY_AI_MOCKUPS_MODAL, {
      productId: productNumberId,
      productTitle: baseProduct?.title,
      mockupUrls: selectedMockupUrls,
      isTemporary,
      onAfterClose: () => {
        openModal(MODAL_ID.AI_MOCKUP_MODAL, {})
      },
    })
  }, [baseProduct?.id, baseProduct?.title, closeModal, openModal, selectedMockupUrls, isTemporary, t])

  /**
   * Download a specific mockup image as WebP format
   */
  const handleDownloadMockup = useCallback(
    async (mockupUrl: string, index: number) => {
      try {
        showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_DOWNLOADING))
        // Fetch the image as blob
        const response = await fetch(mockupUrl)
        const blob = await response.blob()

        // Convert blob to image and then to WebP
        const img = new Image()
        img.crossOrigin = 'anonymous'

        // Load image from blob URL
        const blobUrl = URL.createObjectURL(blob)
        img.src = blobUrl

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            URL.revokeObjectURL(blobUrl) // Clean up blob URL
            resolve()
          }
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl) // Clean up blob URL
            reject(new Error('Failed to load image'))
          }
        })

        // Create canvas and draw image
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Failed to get canvas context')
        }

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        // Convert canvas to WebP blob
        canvas.toBlob(
          webpBlob => {
            if (!webpBlob) {
              setError(t('failed-to-download-mockup'))
              return
            }

            // Create download link with WebP format
            const url = URL.createObjectURL(webpBlob)
            const downloadLink = document.createElement('a')
            downloadLink.href = url
            downloadLink.download = `ai-mockup-${index + 1}.webp`
            downloadLink.click()

            // Clean up
            setTimeout(() => {
              URL.revokeObjectURL(url)
            }, 100)
          },
          'image/webp',
          0.8 // Quality: 0.8 for good balance between quality and file size
        )
        showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_DOWNLOADED))
      } catch (error) {
        console.error('Error downloading mockup:', error)
        showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_DOWNLOAD_FAILED), { isError: true })
        setError(error instanceof Error ? error.message : t('failed-to-download-mockup'))
      }
    },
    [t]
  )

  /**
   * Check if scene has "trending" tag.
   */
  const hasTrendingTag = useCallback((scene: Scene) => {
    return scene.tags?.some(tag => tag.toLowerCase() === 'trending') || false
  }, [])

  const handlePromptBlur = useCallback(() => {
    const selectedScene = scenes[selectedSceneIndex]
    if (!prompt.trim() && selectedScene) {
      setPrompt(selectedScene.suggestPrompt)
    }
  }, [scenes, selectedSceneIndex, prompt])

  return (
    <>
      <Modal
        open={isOpen && !imageSelectorOpen}
        title={t('ai-mockups')}
        size="large"
        onClose={onClose}
        primaryAction={
          generatedMockups.length > 0
            ? {
                content: t('apply'),
                onAction: handleOpenApplyConfirmModal,
                disabled: selectedMockupUrls.length === 0,
              }
            : {
                content: t('create-mockup'),
                onAction: handleCreateMockup,
                loading: isCreatingMockup,
                disabled: !hasCredits || isCreatingMockup || !currentReferenceImage?.url,
              }
        }
        secondaryActions={
          [
            {
              content: generatedMockups.length > 0 ? t('re-generate') : t('cancel'),
              onAction: generatedMockups.length > 0 ? handleCreateMockup : onClose,
              loading: isCreatingMockup,
            },
          ].filter(Boolean) as ComplexAction[]
        }
      >
        <Modal.Section>
          <BlockStack gap="300">
            {!hasCredits && <AiCreditExhaustedBanner />}

            {/* Warning banner if reference image is missing */}
            {!currentReferenceImage?.url && (
              <Banner tone="warning">
                <Text as="p" variant="bodyMd">
                  {t('base-product-image-required-for-ai-mockup')}
                </Text>
              </Banner>
            )}

            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {t('select-scene')}
            </Text>

            <ScenesGrid
              scenes={scenes}
              isLoading={isScenesLoading}
              skeletonCount={8}
              selectedSceneIndex={selectedSceneIndex}
              onSelectScene={handleSceneSelect}
              isTrending={hasTrendingTag}
              trendingLabel={t('trending')}
            />

            {/* Prompt TextField */}
            <TextField
              label={t('description')}
              labelHidden
              multiline={4}
              value={prompt}
              onChange={handlePromptChange}
              placeholder={scenes[selectedSceneIndex]?.suggestPrompt || t('what-would-you-like-to-create')}
              onBlur={handlePromptBlur}
              autoComplete="off"
            />

            {/* Reference Image Display */}
            {currentReferenceImage?.url && (
              <ReferenceImageSection
                url={currentReferenceImage.url}
                alt={currentReferenceImage.altText || t('reference-image')}
                isBusy={isCreatingMockup}
                showReset={!!selectedReferenceImage}
                resetLabel={mockupImageDataUrl ? t('reset-to-mockup-image') : t('reset-to-base-image')}
                changeLabel={t('change-reference-image')}
                onReset={handleResetToBaseImage}
                onChangeReferenceImage={handleOpenImageSelector}
              />
            )}

            {/* Error Banner */}
            {error && (
              <Banner tone="critical" onDismiss={() => setError(null)}>
                <Text as="p" variant="bodyMd">
                  {error}
                </Text>
              </Banner>
            )}

            <div ref={generatedMockupsRef}>
              <GeneratedMockupsSection
                title={t('mockup-image')}
                generatedAlt={t('generated-mockup')}
                downloadLabel={t('download-mockup')}
                selectLabel="Select mockup"
                generatedMockups={generatedMockups}
                isCreatingMockup={isCreatingMockup}
                selectedMockupIds={selectedMockupIds}
                onToggleMockup={handleToggleMockup}
                onDownload={handleDownloadMockup}
              />
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Image Selector Modal - Rendered outside parent modal to avoid nesting */}
      {imageSelectorOpen && (
        <ImageSelector
          active={imageSelectorOpen}
          allowMultiple={false}
          onSelectImage={handleSelectImageFromLibrary}
          onClose={handleCloseImageSelector}
        />
      )}
    </>
  )
}
