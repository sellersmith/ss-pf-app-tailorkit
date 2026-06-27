import {
  BlockStack,
  Box,
  Card,
  Divider,
  InlineStack,
  Layout,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  SkeletonTabs,
} from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import useDevices from '~/utils/hooks/useDevice'

interface SaleToolsSectionSkeletonProps {
  bodyLines?: number
  actionCount?: number
}

function SaleToolsSectionSkeleton({ bodyLines = 2, actionCount = 0 }: SaleToolsSectionSkeletonProps) {
  return (
    <Layout>
      <Layout.Section variant="oneThird">
        <Box paddingInlineStart={{ xs: '200', md: '0' }}>
          <SkeletonDisplayText size="small" />
        </Box>
      </Layout.Section>
      <Layout.Section>
        <Card>
          <BlockStack gap="300">
            <SkeletonBodyText lines={bodyLines} />
            {actionCount > 0 && (
              <InlineStack gap="200" align="end">
                {Array.from({ length: actionCount }).map((_, index) => (
                  <SkeletonDisplayText key={`action-${index.toString()}`} size="small" />
                ))}
              </InlineStack>
            )}
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  )
}

export function SaleToolsStorefrontSkeleton() {
  const { t } = useTranslation()
  const { isSmallMobileView } = useDevices()

  return (
    <SkeletonPage title={t('sales-tools')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <SkeletonTabs count={3} />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        <BlockStack gap="400">
          <SaleToolsSectionSkeleton bodyLines={2} actionCount={1} />
          <Divider borderColor="border" />
          <SaleToolsSectionSkeleton bodyLines={4} />
          <Divider borderColor="border" />
          <SaleToolsSectionSkeleton bodyLines={2} actionCount={1} />
          <Divider borderColor="border" />
          <SaleToolsSectionSkeleton bodyLines={3} />
          <Divider borderColor="border" />
          <SaleToolsSectionSkeleton bodyLines={3} />
        </BlockStack>
      </Box>
    </SkeletonPage>
  )
}

export function SaleToolsSalesSkeleton() {
  const { t } = useTranslation()
  const { isSmallMobileView } = useDevices()

  return (
    <SkeletonPage title={t('sales-tools')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <SkeletonTabs count={3} />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        <BlockStack gap="400">
          <SaleToolsSectionSkeleton bodyLines={3} actionCount={1} />
          <Divider borderColor="border" />
          <SaleToolsSectionSkeleton bodyLines={4} actionCount={1} />
        </BlockStack>
      </Box>
    </SkeletonPage>
  )
}

export function SaleToolsAIToolsSkeleton() {
  const { t } = useTranslation()
  const { isSmallMobileView } = useDevices()

  return (
    <SkeletonPage title={t('sales-tools')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <SkeletonTabs count={3} />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        <BlockStack gap="400">
          <SaleToolsSectionSkeleton bodyLines={2} actionCount={1} />
        </BlockStack>
      </Box>
    </SkeletonPage>
  )
}
