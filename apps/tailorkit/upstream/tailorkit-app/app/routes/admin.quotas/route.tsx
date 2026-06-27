import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Badge, BlockStack, Card, IndexTable, InlineStack, Page, Text } from '@shopify/polaris'
import { useMemo } from 'react'
import { json } from '~/bootstrap/fns/fetch.server'
import withTranslation from '~/bootstrap/hoc/withTranslation'
import type { ApiQuotaDocument } from '~/models/ApiUsageLog'
import { ApiQuotaModel } from '~/models/ApiUsageLog.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Fetch all quotas
  const url = new URL(request.url)
  const shopFilter = url.searchParams.get('shopDomain') || undefined
  const userFilter = url.searchParams.get('userId') || undefined

  const filter: any = {}
  if (shopFilter) filter.shopDomain = shopFilter
  if (userFilter) filter.userId = userFilter

  const quotas = await ApiQuotaModel.find(filter).sort({ updatedAt: -1 }).lean()
  return json({ quotas })
}

type LoaderData = {
  quotas: ApiQuotaDocument[]
}

function QuotaPage() {
  const { quotas } = useLoaderData<LoaderData>()

  const rows = useMemo(() => {
    return quotas.map((q, idx) => {
      const reqPct = Math.min((q.currentRequests / q.dailyRequestLimit) * 100, 999).toFixed(1)
      const tokenPct = Math.min((q.currentTokens / q.dailyTokenLimit) * 100, 999).toFixed(1)
      const costPct = Math.min((q.currentCost / q.dailyCostLimit) * 100, 999).toFixed(1)

      return (
        <IndexTable.Row id={`${idx}`} position={idx} key={`${idx}`}>
          <IndexTable.Cell>{q.userId}</IndexTable.Cell>
          <IndexTable.Cell>{q.shopDomain || '—'}</IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="200" blockAlign="center">
              <Text as="span">{`${q.currentRequests} / ${q.dailyRequestLimit}`}</Text>
              <Badge tone={Number(reqPct) > 90 ? 'critical' : Number(reqPct) > 75 ? 'warning' : 'success'}>
                {`${reqPct}%`}
              </Badge>
            </InlineStack>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="200" blockAlign="center">
              <Text as="span">{`${q.currentTokens.toLocaleString()} / ${q.dailyTokenLimit.toLocaleString()}`}</Text>
              <Badge tone={Number(tokenPct) > 90 ? 'critical' : Number(tokenPct) > 75 ? 'warning' : 'success'}>
                {`${tokenPct}%`}
              </Badge>
            </InlineStack>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="200" blockAlign="center">
              <Text as="span">{`$${q.currentCost.toFixed(4)} / $${q.dailyCostLimit.toFixed(2)}`}</Text>
              <Badge tone={Number(costPct) > 90 ? 'critical' : Number(costPct) > 75 ? 'warning' : 'success'}>
                {`${costPct}%`}
              </Badge>
            </InlineStack>
          </IndexTable.Cell>
          <IndexTable.Cell>{q.lastResetDate}</IndexTable.Cell>
        </IndexTable.Row>
      )
    })
  }, [quotas])

  return (
    <Page title="API Quotas" fullWidth backAction={{ content: 'Admin Dashboard', url: '/admin' }}>
      <BlockStack gap="400">
        <Card>
          <IndexTable
            itemCount={rows.length}
            selectable={false}
            resourceName={{ singular: 'quota', plural: 'quotas' }}
            headings={[
              { title: 'User ID' },
              { title: 'Shop Domain' },
              { title: 'Requests (today)' },
              { title: 'Tokens (today)' },
              { title: 'Cost (today)' },
              { title: 'Last Reset' },
            ]}
          >
            {rows}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  )
}

export default withTranslation(QuotaPage)
