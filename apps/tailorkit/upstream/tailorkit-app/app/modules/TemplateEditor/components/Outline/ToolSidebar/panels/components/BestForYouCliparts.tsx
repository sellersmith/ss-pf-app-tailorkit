import { memo, useMemo } from 'react'
import { ClipartSkeleton, type ClipartGridItem } from '~/routes/dashboard/components/ClipartShowcase'
import { useSuggestedFontCombinations } from '../hooks/useSuggestedFontCombinations'
import { type TEMPLATE_TYPE as TEMPLATE_TYPE_ENUM } from '~/routes/api.templates/constants'
import { getShopifyThumbnail } from '~/utils/loadImage'
import ClipartList from './ClipartList'
import { useTranslation } from 'react-i18next'
import { Box, BlockStack, InlineStack, InlineGrid, Icon, Text } from '@shopify/polaris'
import { StarFilledIcon } from '@shopify/polaris-icons'
import { ClickContext } from '~/models/ClipartClickEvent'

/**
 * BestForYouCliparts Component - Displays AI-suggested cliparts
 * based on the current product in the integration
 */
function BestForYouCliparts() {
  const { t } = useTranslation()
  const { cliparts, hasProduct, isLoading } = useSuggestedFontCombinations()

  const clipartItems: ClipartGridItem[] = useMemo(() => {
    const items = cliparts.map(item => ({
      _id: item._id,
      previewUrl: getShopifyThumbnail(item.thumbnailUrl, 180) as string,
      alt: item.name,
      type: (item.type as TEMPLATE_TYPE_ENUM) || undefined,
      name: item.name,
      thumbnailUrl: item.thumbnailUrl,
      clickCount: item.clickCount, // Include click count from suggested cliparts
    }))

    return items
  }, [cliparts])

  const loadingSkeleton = useMemo(() => {
    return (
      <InlineGrid columns={2} alignItems="start" gap="400">
        {Array.from({ length: 2 }).map((_, index) => (
          <ClipartSkeleton key={`skeleton-clipart-${index}`} showTitle={false} />
        ))}
      </InlineGrid>
    )
  }, [])

  if (!hasProduct || !clipartItems.length) return null

  if (isLoading) {
    return loadingSkeleton
  }

  return (
    <BlockStack gap="200">
      <InlineStack blockAlign="center">
        <Box>
          <Icon source={StarFilledIcon} tone="success" />
        </Box>
        <Text as="h4" variant="headingSm" tone="success">
          {t('best-for-you')}
        </Text>
      </InlineStack>
      <ClipartList
        trackingContext={ClickContext.EDITOR_TEXT_PANEL_FONTS_COMBINED_SUGGESTED}
        defaultCliparts={clipartItems}
        columns={2}
        gapPx={8}
        showTitle={false}
        showTitleOnHover={true}
        lazy={true}
        forceFetch={false}
        emptyStateMessage={t('no-font-combinations-found')}
      />
    </BlockStack>
  )
}

export default memo(BestForYouCliparts)
