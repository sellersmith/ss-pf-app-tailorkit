import {
  BlockStack,
  Box,
  Card,
  InlineGrid,
  InlineStack,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonTabs,
} from '@shopify/polaris'
import React from 'react'

interface ProductEditorLoadingProps {
  loading?: boolean
}

/** Loading shell for direct ProductEditor routes; prevents falling back to the listing while detail data loads. */
export const ProductEditorLoading: React.FC<ProductEditorLoadingProps> = ({ loading }) => (
  <div aria-busy={loading}>
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center" gap="400">
        <Box minWidth="240px">
          <SkeletonDisplayText size="small" />
        </Box>
        <Box minWidth="160px">
          <SkeletonDisplayText size="small" />
        </Box>
      </InlineStack>
      <Box maxWidth="360px">
        <SkeletonTabs count={3} />
      </Box>
      <InlineGrid columns={{ xs: 1, md: 'minmax(0, 1fr) 380px' }} gap="400">
        <Card>
          <Box minHeight="520px" padding="500">
            <BlockStack gap="400">
              <SkeletonDisplayText size="large" />
              <SkeletonBodyText lines={5} />
            </BlockStack>
          </Box>
        </Card>
        <Card>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={8} />
          </BlockStack>
        </Card>
      </InlineGrid>
    </BlockStack>
  </div>
)
