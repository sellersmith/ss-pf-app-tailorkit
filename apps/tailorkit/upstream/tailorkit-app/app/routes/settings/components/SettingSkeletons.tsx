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

interface SettingSectionSkeletonProps {
  bodyLines?: number
  actionCount?: number
}

function SettingSectionSkeleton({ bodyLines = 2, actionCount = 0 }: SettingSectionSkeletonProps) {
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

export function SettingsPreferencesSkeleton() {
  const { t } = useTranslation()
  const { isSmallMobileView } = useDevices()

  return (
    <SkeletonPage title={t('settings')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <SkeletonTabs count={3} />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        <BlockStack gap="400">
          <SettingSectionSkeleton bodyLines={3} actionCount={2} />
          <Divider borderColor="border" />
          <SettingSectionSkeleton bodyLines={2} actionCount={1} />
          <Divider borderColor="border" />
          <SettingSectionSkeleton bodyLines={3} actionCount={2} />
        </BlockStack>
      </Box>
    </SkeletonPage>
  )
}

export function SettingsAccountSkeleton() {
  const { t } = useTranslation()
  const { isSmallMobileView } = useDevices()

  return (
    <SkeletonPage title={t('settings')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <SkeletonTabs count={3} />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        <BlockStack gap="400">
          <SettingSectionSkeleton bodyLines={2} />
          <Divider borderColor="border" />
          <SettingSectionSkeleton bodyLines={3} actionCount={2} />
        </BlockStack>
      </Box>
    </SkeletonPage>
  )
}

export function SettingsBillingSkeleton() {
  const { t } = useTranslation()
  const { isSmallMobileView } = useDevices()

  return (
    <SkeletonPage title={t('settings')}>
      <div style={{ marginLeft: isSmallMobileView ? 0 : '-16px' }}>
        <SkeletonTabs count={3} />
      </div>
      <Box paddingBlockStart="400" paddingBlockEnd="400">
        <BlockStack gap="400">
          <SettingSectionSkeleton bodyLines={4} actionCount={1} />
          <Divider borderColor="border" />
          <SettingSectionSkeleton bodyLines={3} actionCount={2} />
          <Divider borderColor="border" />
          <SettingSectionSkeleton bodyLines={2} />
        </BlockStack>
      </Box>
    </SkeletonPage>
  )
}
