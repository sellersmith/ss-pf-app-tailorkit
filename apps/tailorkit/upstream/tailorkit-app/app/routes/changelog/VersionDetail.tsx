import { useTranslation } from 'react-i18next'
import { useNavigate } from '@remix-run/react'
import { type IChangeLog } from '~/bootstrap/hooks/useChangelog'
import { ListChangeLog } from '~/routes/changelog/ListChangeLogs'
import { Badge, BlockStack, Box, Button, Card, Divider, InlineStack, Text } from '@shopify/polaris'
import { formatDate } from 'date-fns'
import { useMemo } from 'react'

interface IVersionDetail {
  index: number
  title: string
  badgeText: string
  item: IChangeLog
  showViewFullChangelog?: boolean
}

export const VersionDetail = (props: IVersionDetail) => {
  const { item, index, showViewFullChangelog, title, badgeText } = props
  const { features, bugsFixed, improvements, date } = item || {}

  const { t } = useTranslation()
  const navigate = useNavigate()

  const descriptionView = useMemo(
    () =>
      [
        {
          title: t('new-features'),
          list: features,
        },
        {
          title: t('improvements'),
          list: improvements,
        },
        {
          title: t('fixes'),
          list: bugsFixed,
        },
      ]
        .map(item => {
          const { title, list } = item
          return list?.length ? <ListChangeLog key={title} title={title} list={list} /> : null
        })
        .filter(Boolean),
    [t, features, improvements, bugsFixed]
  )

  return (
    <Card padding="400">
      <BlockStack gap="300">
        <BlockStack gap="200">
          <InlineStack gap="200">
            <Text variant="headingMd" as="h2">
              {title}
            </Text>
            {index === 0 && <Badge tone="info">{badgeText}</Badge>}
          </InlineStack>
          <Text variant="bodyLg" as="p" tone="subdued">
            {t('released-on-versiondate', { versionDate: formatDate(date, 'MMM d, yyyy') })}
          </Text>
        </BlockStack>

        {descriptionView.length ? (
          <>
            <Divider />
            <BlockStack gap="300">{descriptionView}</BlockStack>
          </>
        ) : null}

        {showViewFullChangelog && (
          <Box>
            <Button onClick={() => navigate('/changelog')}>{t('view-full-changelog')}</Button>
          </Box>
        )}
      </BlockStack>
    </Card>
  )
}
