import { BlockStack, Box, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import ListMediaGrid from '~/modules/modals/ImageSelector/components/ListMediaGrid'
import type { IImageQuery } from '~/types/shopify-files'

interface GeneratedImagesSectionProps {
  isGenerating: boolean
  imageOptions: IImageQuery[]
  allowMultiple: boolean
  numberOfSkeletons: number
  onImageClick: (image: IImageQuery) => void
}

export function GeneratedImagesSection({
  isGenerating,
  imageOptions,
  allowMultiple,
  numberOfSkeletons,
  onImageClick,
}: GeneratedImagesSectionProps) {
  const { t } = useTranslation()
  const hasImages = imageOptions.length > 0

  if (!isGenerating && !hasImages) return null

  return (
    <Box>
      <BlockStack gap="200">
        {isGenerating && (
          <Box>
            <Text as="p" variant="bodySm">
              {t('generating-images-this-can-take-up-to-30-seconds')}
            </Text>
          </Box>
        )}
        <div style={{ display: 'flex' }}>
          <div
            style={{
              display: 'flex',
              flex: '0 0 auto',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
            }}
          >
            <ListMediaGrid
              isLoading={isGenerating}
              files={imageOptions}
              imagesSelected={[]}
              setImagesSelected={() => {}}
              allowMultiple={allowMultiple}
              numberOfSkeletons={numberOfSkeletons}
              showFilenameInTooltip={false}
              showFilename={false}
              backgroundSkeletonLoading={true}
              gridColumns={{ xs: 2, sm: 2, md: 2, lg: 2, xl: 2 }}
              thumbnailFullWidth={true}
              onImageClick={onImageClick}
              showCheckbox={false}
              preloadOriginalOnHover={true}
              preloadDelay={150}
            />
          </div>
        </div>
      </BlockStack>
    </Box>
  )
}
