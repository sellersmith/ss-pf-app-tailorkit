import { useState, useCallback, useMemo } from 'react'
import { BlockStack, Box, Button, InlineStack, Text, Banner, Thumbnail, InlineError, Checkbox } from '@shopify/polaris'
import { ImageMagicIcon, DeleteIcon, ImageIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { AI_ASSISTANT_SUGGESTION_ACTION } from '~/routes/api.ai-assistant.suggestion/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { IImageQuery } from '~/types/shopify-files'
import ImageSelector from '~/modules/modals/ImageSelector'
import { DEFAULT_ERROR_MESSAGE, type ReferenceImage } from '~/components/AITextField/AIImageGenerator/types'

interface TestPromptSectionProps {
  instruction: string
  templateType?: string | null
  visualStyle?: string | null
  contentTheme?: string | null
  thumbnailUrls: string[]
  onSelectThumbnail?: (images: IImageQuery[]) => void
}

export function TestPromptSection({
  instruction,
  templateType,
  visualStyle,
  contentTheme,
  thumbnailUrls,
  onSelectThumbnail,
}: TestPromptSectionProps) {
  const { t } = useTranslation()

  // State
  const [isGenerating, setIsGenerating] = useState(false)
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null)
  const [generatedImages, setGeneratedImages] = useState<IImageQuery[]>([])
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Computed
  const canGenerate = useMemo(() => {
    return instruction.trim().length > 0
  }, [instruction])

  // Handlers
  const openImageSelector = useCallback(() => {
    setImageSelectorOpen(true)
  }, [])

  const closeImageSelector = useCallback(() => {
    setImageSelectorOpen(false)
  }, [])

  const onSelectReferenceImage = useCallback(
    (images: IImageQuery[] | null) => {
      if (!images || !images.length) return closeImageSelector()

      const img = images[0]
      setReferenceImage({
        name: img.alt || 'reference.png',
        size: 0,
        type: 'image/png',
        url: img?.image?.originalSrc || '',
      })
      setErrorMessage(null)
      closeImageSelector()
    },
    [closeImageSelector]
  )

  const removeReferenceImage = useCallback(() => {
    setReferenceImage(null)
    setGeneratedImages([])
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!instruction.trim()) {
      setErrorMessage(t('please-enter-a-prompt-before-testing'))
      return
    }

    try {
      setIsGenerating(true)
      setErrorMessage(null)

      const requestBody: {
        action: string
        prompt: string
        templateType?: string
        visualStyle?: string
        contentTheme?: string
        aspectRatio: string
        numberGeneratedImages: number
        referenceImageUrls?: string[]
      } = {
        action: AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_IMAGES,
        prompt: instruction,
        templateType: templateType || undefined,
        visualStyle: visualStyle || undefined,
        contentTheme: contentTheme || undefined,
        aspectRatio: '1:1',
        numberGeneratedImages: 1,
      }

      // Only include reference image URLs if a reference image is provided
      if (referenceImage?.url) {
        requestBody.referenceImageUrls = [referenceImage.url]
      }

      const response = await authenticatedFetch('/api/ai-assistant/suggestion', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })

      if (response?.success) {
        const images = response.uploadedImages?.uploadedFiles || []
        if (images.length === 0) {
          setErrorMessage(DEFAULT_ERROR_MESSAGE)
          return
        }
        setGeneratedImages(prev => [...prev, ...images])
      } else {
        setErrorMessage(response?.error || DEFAULT_ERROR_MESSAGE)
      }
    } catch (error) {
      console.error('Failed to generate test image:', error)
      setErrorMessage(error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE)
    } finally {
      setIsGenerating(false)
    }
  }, [referenceImage, instruction, templateType, visualStyle, contentTheme, t])

  /**
   * Handle thumbnail selection with support for multiple selection (max 2)
   * Toggles selection state based on thumbnailUrls from parent
   */
  const handleSelectAsThumbnail = useCallback(
    (index: number) => {
      if (!onSelectThumbnail) return

      const image = generatedImages[index]
      if (!image) return

      const imageUrl = image.image?.originalSrc || ''
      const isCurrentlySelected = thumbnailUrls.includes(imageUrl)

      if (isCurrentlySelected) {
        // Deselect: remove this image from thumbnails
        const updatedImages = generatedImages.filter(
          img =>
            img.image?.originalSrc
            && thumbnailUrls.includes(img.image.originalSrc)
            && img.image.originalSrc !== imageUrl
        )
        onSelectThumbnail(updatedImages)
      } else {
        // Select: add this image to thumbnails (max 2)
        const currentSelectedImages = generatedImages.filter(
          img => img.image?.originalSrc && thumbnailUrls.includes(img.image.originalSrc)
        )
        const updatedImages = [...currentSelectedImages, image].slice(0, 2)
        onSelectThumbnail(updatedImages)
      }
    },
    [generatedImages, thumbnailUrls, onSelectThumbnail]
  )

  return (
    <BlockStack gap="300">
      <Text as="h3" variant="headingSm">
        {t('test-prompt')}
      </Text>

      <Banner tone="info">
        <Text as="span" variant="bodySm">
          {t('test-prompt-description')}
        </Text>
      </Banner>

      {/* Reference Image Section */}
      <BlockStack gap="200">
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {t('reference-image')} {t('optional')}
        </Text>

        {referenceImage ? (
          <InlineStack gap="200" align="start" blockAlign="center">
            <Box borderColor="border" borderWidth="025" borderRadius="300" padding="100">
              <Thumbnail source={referenceImage.url} size="large" alt="Reference" />
            </Box>
            <Button icon={DeleteIcon} tone="critical" onClick={removeReferenceImage}>
              {t('remove')}
            </Button>
          </InlineStack>
        ) : (
          <Button icon={ImageIcon} onClick={openImageSelector} fullWidth>
            {t('add-reference-image')}
          </Button>
        )}
      </BlockStack>

      {/* Generate Button */}
      <Button
        icon={ImageMagicIcon}
        variant="primary"
        loading={isGenerating}
        disabled={!canGenerate || isGenerating}
        onClick={handleGenerate}
        fullWidth
      >
        {isGenerating ? t('generating') : generatedImages.length > 0 ? t('generate-more') : t('test-generate')}
      </Button>

      {/* Error Message */}
      {errorMessage && <InlineError message={errorMessage} fieldID="test-prompt-error" />}

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <BlockStack gap="200">
          <Text as="span" variant="bodyMd" fontWeight="medium">
            {t('generated-results')}
          </Text>

          <InlineStack gap="200" wrap>
            {generatedImages.map((img, index) => {
              const imageUrl = img.image?.originalSrc || ''
              const isSelected = thumbnailUrls.includes(imageUrl)
              const canSelect = !isSelected && thumbnailUrls.length < 2
              const isClickable = onSelectThumbnail && (isSelected || canSelect)

              return (
                <div
                  key={img.id || `generated-${index}`}
                  style={{
                    opacity: onSelectThumbnail && !isSelected && !canSelect ? 0.5 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <div
                    onClick={isClickable ? () => handleSelectAsThumbnail(index) : undefined}
                    style={{
                      cursor: isClickable ? 'pointer' : 'default',
                    }}
                  >
                    <Box
                      borderColor={isSelected ? 'border-brand' : 'border'}
                      borderRadius="300"
                      padding="100"
                      position="relative"
                    >
                      <Box position="relative">
                        <Thumbnail source={img.image?.originalSrc || ''} size="large" alt={`Generated ${index + 1}`} />
                        {onSelectThumbnail && (
                          <div
                            onClick={e => {
                              e.stopPropagation()
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              pointerEvents: 'auto',
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={!isSelected && !canSelect}
                              onChange={() => {
                                if (isSelected || canSelect) {
                                  handleSelectAsThumbnail(index)
                                }
                              }}
                              label=""
                              labelHidden
                            />
                          </div>
                        )}
                      </Box>
                    </Box>
                  </div>
                </div>
              )
            })}
          </InlineStack>
        </BlockStack>
      )}

      {/* Image Selector Modal */}
      <ImageSelector
        active={imageSelectorOpen}
        onClose={closeImageSelector}
        onSelectImage={onSelectReferenceImage}
        allowMultiple={false}
      />
    </BlockStack>
  )
}
