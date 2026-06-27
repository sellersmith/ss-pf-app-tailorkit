import { useTranslation } from 'react-i18next'
import { VersionDetail } from '~/routes/changelog/VersionDetail'
import { type IChangeLog, useChangeLog } from '~/bootstrap/hooks/useChangelog'
import { BlockStack, Box, Card, Divider, InlineStack, Spinner, Text } from '@shopify/polaris'
import { useMemo, memo } from 'react'
import { EMPTY_ARRAY } from '~/constants'

function ChangeLogCard() {
  const { t } = useTranslation()
  const { changeLog, loading } = useChangeLog()

  // Get the newest change log
  const newestChangeLog = useMemo(() => [...(changeLog || EMPTY_ARRAY)].shift(), [changeLog])

  if (loading || !changeLog.length) {
    return (
      <Card padding="400" roundedAbove="sm">
        <BlockStack gap="400">
          <Box paddingBlock="200">
            <Box paddingBlock="150">
              <Text variant="headingMd" as="h2">
                {t('what-s-new')}
              </Text>
            </Box>
          </Box>

          <Divider />

          <Box padding="600">
            <InlineStack align="center">
              <Spinner />
            </InlineStack>
          </Box>
        </BlockStack>
      </Card>
    )
  }

  return (
    <VersionDetail
      index={0}
      title={t('what-s-new')}
      badgeText={t('tailorkit-version', { version: newestChangeLog?.version })}
      item={{
        ...(newestChangeLog as IChangeLog),
        // Cutting 4 first items of bugsFixed, features, improvements
        bugsFixed: (newestChangeLog?.bugsFixed || []).slice(0, 4),
        features: (newestChangeLog?.features || []).slice(0, 4),
        improvements: (newestChangeLog?.improvements || []).slice(0, 4),
      }}
      showViewFullChangelog={true}
    />
  )
}

export default memo(ChangeLogCard)
