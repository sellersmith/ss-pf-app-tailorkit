import { useSearchParams } from '@remix-run/react'
import { Page } from '@shopify/polaris'
import { useMemo } from 'react'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

const Index = withNavMenu(function Index(props: WithTranslationProps) {
  const { t } = props
  const [searchParams] = useSearchParams()
  const optionType = useMemo(() => searchParams.get('option_type'), [searchParams]) || ''

  return <Page title={t(optionType)}></Page>
})

export default withInteractiveChat(Index)
