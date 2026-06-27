import { BlockStack, Box, Divider, InlineStack, SkeletonBodyText, SkeletonDisplayText } from '@shopify/polaris'

/**
 * Loading skeleton for notification items
 * Displays while notifications are being fetched
 */
export function NotificationSkeleton() {
  return (
    <>
      <Box paddingBlock="200" paddingInline="0">
        <InlineStack gap="100" blockAlign="start" wrap={false}>
          {/* Unread indicator placeholder */}
          <Box minWidth="20px" paddingBlockStart="050">
            <Box width="8px" height="8px" borderRadius="100" background="bg-fill-disabled" />
          </Box>

          {/* Left column: Metadata skeleton */}
          <Box minWidth="90px" paddingInlineEnd="200">
            <BlockStack gap="050">
              <Box maxWidth="80px">
                <SkeletonBodyText lines={1} />
              </Box>
              <Box maxWidth="80px">
                <SkeletonBodyText lines={1} />
              </Box>
            </BlockStack>
          </Box>

          {/* Right column: Title and Content skeleton */}
          <BlockStack gap="100" style={{ flex: 1, minWidth: 0 }}>
            {/* Title skeleton */}
            <Box maxWidth="300px">
              <SkeletonDisplayText size="small" />
            </Box>

            {/* Content skeleton */}
            <SkeletonBodyText lines={2} />

            {/* Button skeleton */}
            <Box maxWidth="100px">
              <SkeletonBodyText lines={1} />
            </Box>
          </BlockStack>
        </InlineStack>
      </Box>
      <Divider />
    </>
  )
}

/**
 * Multiple skeleton items for loading state
 */
export function NotificationSkeletonList() {
  return (
    <BlockStack gap="0">
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
    </BlockStack>
  )
}
