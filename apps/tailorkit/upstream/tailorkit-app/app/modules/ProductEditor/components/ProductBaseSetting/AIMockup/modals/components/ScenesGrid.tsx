import { Badge, BlockStack, Box, InlineGrid, SkeletonBodyText, Text } from '@shopify/polaris'
import { ELink } from '~/constants/enum'
import type { Scene } from '../types'

interface ScenesGridProps {
  scenes: Scene[]
  isLoading?: boolean
  skeletonCount?: number
  selectedSceneIndex: number
  onSelectScene: (index: number) => void
  isTrending: (scene: Scene) => boolean
  trendingLabel: string
}

/**
 * Scene selection grid for AI mockups.
 */
export function ScenesGrid(props: ScenesGridProps) {
  const {
    scenes,
    isLoading = false,
    skeletonCount = 8,
    selectedSceneIndex,
    onSelectScene,
    isTrending,
    trendingLabel,
  } = props

  if (isLoading) {
    return (
      <InlineGrid columns={{ xs: 2, md: 3, lg: 5 }} gap="300">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div key={`scene-skeleton-${index}`}>
            <BlockStack gap="100">
              <Box
                background="bg-surface-secondary"
                borderRadius="200"
                borderWidth="025"
                borderColor="border"
                minHeight="182px"
              />
              <SkeletonBodyText lines={1} />
            </BlockStack>
          </div>
        ))}
      </InlineGrid>
    )
  }

  return (
    <InlineGrid columns={{ xs: 2, md: 3, lg: 5 }} gap="300">
      {scenes.map((scene, index) => {
        const isSelected = index === selectedSceneIndex
        const trending = isTrending(scene)

        return (
          <div key={`${scene.scene}-${index}`} onClick={() => onSelectScene(index)} style={{ cursor: 'pointer' }}>
            <BlockStack gap="100">
              <Box position="relative">
                <img
                  src={scene.thumbnailUrl || ELink.IMAGE_PREVIEW_PLACEHOLDER}
                  alt={scene.scene}
                  style={{
                    width: '100%',
                    height: '182px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid var(--p-color-border-inverse)' : '1px solid var(--p-color-border)',
                    boxSizing: 'border-box',
                  }}
                />

                {trending && (
                  <Box position="absolute" insetBlockStart="200" insetInlineEnd="200">
                    <Badge tone="success">{trendingLabel}</Badge>
                  </Box>
                )}
              </Box>

              <Text as="p" variant="bodyMd" fontWeight={isSelected ? 'semibold' : 'regular'} alignment="start">
                {scene.scene}
              </Text>
            </BlockStack>
          </div>
        )
      })}
    </InlineGrid>
  )
}
