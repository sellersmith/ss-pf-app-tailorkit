import { Badge, BlockStack, Box, Button, Checkbox, InlineGrid, Text } from '@shopify/polaris'
import { SaveIcon } from '@shopify/polaris-icons'
import ImageLoadingSkeleton from '~/components/skeleton/ImageLoading'
import type { GeneratedMockup } from '../types'

interface GeneratedMockupsSectionProps {
  title: string
  generatedAlt: string
  downloadLabel: string
  selectLabel: string
  generatedMockups: GeneratedMockup[]
  isCreatingMockup: boolean
  selectedMockupIds: string[]
  showAspectRatio?: boolean
  onToggleMockup: (mockupId: string) => void
  onDownload: (mockupUrl: string, index: number) => void
}

/**
 * Generated mockups grid + loading skeleton.
 */
export function GeneratedMockupsSection(props: GeneratedMockupsSectionProps) {
  const {
    title,
    generatedAlt,
    downloadLabel,
    selectLabel,
    generatedMockups,
    isCreatingMockup,
    selectedMockupIds,
    showAspectRatio = false,
    onToggleMockup,
    onDownload,
  } = props

  if (!generatedMockups.length && !isCreatingMockup) return null

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd" fontWeight="semibold">
        {title}
      </Text>

      <InlineGrid columns={{ xs: 2, md: 2, lg: 3 }} gap="200">
        {/* Loading State - Creating Mockup (shown at the beginning) */}
        {isCreatingMockup && (
          <div style={{ aspectRatio: '1/1', position: 'relative', width: '100%' }}>
            <Box
              position="relative"
              borderRadius="200"
              borderWidth="025"
              borderColor="border"
              overflowX="hidden"
              overflowY="hidden"
            >
              <div style={{ paddingBottom: '100%', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  <ImageLoadingSkeleton width="100%" height="100%" />
                </div>
              </div>
            </Box>
          </div>
        )}

        {/* Generated Mockup Results */}
        {generatedMockups.map((mockup, index) => (
          <div
            key={mockup.id}
            style={{ aspectRatio: '1/1', position: 'relative', width: '100%', cursor: 'pointer' }}
            onClick={() => onToggleMockup(mockup.id)}
          >
            <Box
              position="relative"
              borderRadius="200"
              borderWidth="025"
              borderColor="border"
              background="bg-surface-secondary"
              overflowX="hidden"
              overflowY="hidden"
              minHeight="100%"
            >
              <div style={{ position: 'absolute', left: '13px', top: '13px', zIndex: 2 }}>
                <Checkbox label={selectLabel} labelHidden checked={selectedMockupIds.includes(mockup.id)} />
              </div>
              <img
                src={mockup.url}
                alt={generatedAlt}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: '8px',
                  position: 'absolute',
                  inset: 0,
                }}
              />

              {showAspectRatio && mockup.aspectRatio && (
                <div style={{ position: 'absolute', left: '13px', bottom: '13px', zIndex: 1 }}>
                  <Badge tone="info">{mockup.aspectRatio}</Badge>
                </div>
              )}

              <div style={{ position: 'absolute', top: '13px', right: '13px', zIndex: 1 }}>
                <Button
                  icon={SaveIcon}
                  variant="secondary"
                  size="slim"
                  onClick={() => onDownload(mockup.url, index)}
                  accessibilityLabel={downloadLabel}
                />
              </div>
            </Box>
          </div>
        ))}
      </InlineGrid>
    </BlockStack>
  )
}
