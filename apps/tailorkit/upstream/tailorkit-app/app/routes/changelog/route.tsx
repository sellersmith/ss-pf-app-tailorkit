import { type LoaderFunctionArgs } from '@remix-run/node'
import { useNavigate } from '@remix-run/react'
import { BlockStack, Page } from '@shopify/polaris'
import { rootPage } from '~/bootstrap/app-config'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { authenticate } from '~/shopify/app.server'
import { VersionDetail } from '~/routes/changelog/VersionDetail'
import { HydrateFallback } from '~/routes/dashboard/route'
import { useChangeLog } from '~/bootstrap/hooks/useChangelog'
import BlockLoading from '~/components/loading/BlockLoading'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export { HydrateFallback }

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

const Index = (props: WithTranslationProps) => {
  const { t } = props
  const navigate = useNavigate()
  const { changeLog, loading } = useChangeLog()

  return (
    <Page title={t('app-changelog')} backAction={{ onAction: () => navigate(rootPage) }}>
      {loading ? (
        <BlockLoading />
      ) : (
        <BlockStack gap="400">
          {changeLog.map((item, index) => (
            <VersionDetail
              key={index}
              item={item}
              index={index}
              badgeText={t('current-version')}
              title={t('version-versionnumber', { versionNumber: item.version })}
            />
          ))}
        </BlockStack>
      )}
    </Page>
  )
}

export default withNavMenu(withInteractiveChat(Index))
