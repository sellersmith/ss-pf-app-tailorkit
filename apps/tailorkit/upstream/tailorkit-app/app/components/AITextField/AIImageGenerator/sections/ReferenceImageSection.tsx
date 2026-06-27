import { BlockStack, Box, Button, InlineStack, Text } from '@shopify/polaris'
import { XIcon } from '@shopify/polaris-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ImageSelector from '~/modules/modals/ImageSelector'
import { MAX_REFERENCE_FILES, MAX_IMAGE_SIZE, type ReferenceImage } from '../types'
import type { IImageQuery } from '~/types/shopify-files'

interface ReferenceImageSectionProps {
  referenceImages: ReferenceImage[]
  imageSelectorOpen: boolean
  isSelectingImagesFromLibrary: boolean
  onAddImage: () => void
  onRemoveImage: (idx: number) => void
  onSelectFromLibrary: (images: IImageQuery[] | null) => void
  onCloseImageSelector: () => void
}

export function ReferenceImageSection({
  referenceImages,
  imageSelectorOpen,
  isSelectingImagesFromLibrary,
  onAddImage,
  onRemoveImage,
  onSelectFromLibrary,
  onCloseImageSelector,
}: ReferenceImageSectionProps) {
  const { t } = useTranslation()
  const [isHovering, setIsHovering] = useState(false)

  const hasReferenceImage = referenceImages.length > 0

  return (
    <>
      {/* Show placeholder only when no reference image */}
      {!hasReferenceImage && (
        <BlockStack gap={'100'}>
          <Text as="p" variant="bodyMd">
            {t('reference-image')}
          </Text>
          <Box
            padding="400"
            borderRadius="200"
            borderWidth="025"
            borderStyle="dashed"
            borderColor="border"
            background="bg-surface"
            position="relative"
          >
            <BlockStack gap="200" align="center">
              <InlineStack align="center">
                <Button onClick={onAddImage} loading={isSelectingImagesFromLibrary}>
                  {t('add-image')}
                </Button>
              </InlineStack>
              <Text as="p" variant="bodySm" alignment="center" tone="subdued">
                {t('accepts-a-single-webp-jpg-or-png-file-up-to-maximagesize', {
                  maxImageSize: MAX_IMAGE_SIZE,
                })}
              </Text>
            </BlockStack>
          </Box>
        </BlockStack>
      )}

      {/* Show reference image with same size as placeholder */}
      {hasReferenceImage && (
        <Box
          padding="400"
          borderRadius="200"
          borderWidth="025"
          borderStyle="dashed"
          borderColor="border"
          background="bg-surface"
          position="relative"
        >
          {referenceImages.map((f, idx) => (
            <div
              key={`${f.name}-${idx}`}
              style={{ position: 'relative' }}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <BlockStack gap="200" align="center">
                <img
                  src={f.url}
                  alt={f.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '120px',
                    objectFit: 'contain',
                    borderRadius: '4px',
                  }}
                />
              </BlockStack>

              {/* X button - only visible on hover, positioned at top-right */}
              {isHovering && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                  }}
                >
                  <Button variant="plain" size="micro" icon={XIcon} onClick={() => onRemoveImage(idx)} />
                </div>
              )}
            </div>
          ))}
        </Box>
      )}

      {imageSelectorOpen && (
        <ImageSelector
          active={imageSelectorOpen}
          allowMultiple={MAX_REFERENCE_FILES > 1}
          onSelectImage={onSelectFromLibrary}
          onClose={onCloseImageSelector}
        />
      )}
    </>
  )
}
