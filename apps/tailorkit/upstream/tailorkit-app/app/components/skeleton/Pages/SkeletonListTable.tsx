import { SkeletonPage, Layout, Card, SkeletonBodyText, BlockStack, SkeletonDisplayText } from '@shopify/polaris'

interface SkeletonListTableProps {
  titleKey: string
  showPrimaryAction?: boolean
}

/**
 * Reusable skeleton for list table pages
 * Used by Personalized Products, Templates, and Orders
 */
export function SkeletonListTable({ titleKey, showPrimaryAction = true }: SkeletonListTableProps) {
  return (
    <SkeletonPage title={titleKey} fullWidth primaryAction={showPrimaryAction}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {/* Search and filter bar skeleton */}
              <SkeletonDisplayText size="small" />

              {/* Table rows skeleton */}
              <SkeletonBodyText lines={8} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  )
}
