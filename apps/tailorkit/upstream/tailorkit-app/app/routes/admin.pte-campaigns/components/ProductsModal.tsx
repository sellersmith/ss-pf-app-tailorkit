import {
  Badge,
  BlockStack,
  DataTable,
  InlineStack,
  Modal,
  Pagination,
  Select,
  SkeletonBodyText,
  Text,
  Tabs,
} from '@shopify/polaris'
import { useEffect, useMemo, useState } from 'react'

interface CampaignIntegration {
  _id: string
  title: string
  shopDomain: string
  publishedAt: Date | null
  unpublishedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  status: 'Published' | 'Unpublished'
  daysActive: number
  lifecycleStage: 'new' | 'active' | 'veteran' | 'churned'
}

interface ProductsModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  shopDomain: string
}

export function ProductsModal({ open, onClose, campaignId, shopDomain }: ProductsModalProps) {
  const [integrations, setIntegrations] = useState<CampaignIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedTab, setSelectedTab] = useState(0)
  const [summary, setSummary] = useState({ total: 0, published: 0, unpublished: 0 })
  const [filters, setFilters] = useState({
    status: 'all',
    lifecycle: 'all',
  })

  useEffect(() => {
    if (!open) return

    setLoading(true)

    const params = new URLSearchParams({
      campaignId,
      shopDomain,
      page: currentPage.toString(),
      limit: '50',
      status: filters.status,
      lifecycle: filters.lifecycle,
    })

    fetch(`/admin/pte-campaigns/products?${params}`)
      .then(res => res.json())
      .then(data => {
        setIntegrations(data.integrations)
        setTotalPages(data.pagination.totalPages)
        if (data.summary) {
          setSummary(data.summary)
        }
      })
      .catch(err => {
        console.error('Failed to load products:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [campaignId, shopDomain, currentPage, open, filters])

  const tabs = useMemo(
    () => [
      { id: 'all', content: `All (${summary.total})` },
      { id: 'published', content: `Published (${summary.published})` },
      { id: 'unpublished', content: `Unpublished (${summary.unpublished})` },
    ],
    [summary]
  )

  const filteredIntegrations = useMemo(() => {
    const tabId = tabs[selectedTab]?.id
    if (tabId === 'published') {
      return integrations.filter(i => i.status === 'Published')
    }
    if (tabId === 'unpublished') {
      return integrations.filter(i => i.status === 'Unpublished')
    }
    return integrations
  }, [integrations, selectedTab, tabs])

  const rows = filteredIntegrations.map(integration => {
    const isPublished = integration.status === 'Published'
    const publishedDate = integration.publishedAt ? new Date(integration.publishedAt) : null
    const unpublishedDate = integration.unpublishedAt ? new Date(integration.unpublishedAt) : null

    // Lifecycle badge tone mapping
    const lifecycleTone = {
      new: 'info',
      active: 'success',
      veteran: 'warning',
      churned: 'critical',
    }[integration.lifecycleStage] as 'info' | 'success' | 'warning' | 'critical'

    return [
      // Product Title
      <Text key={`title-${integration._id}`} as="span" fontWeight="semibold">
        {integration.title || 'Untitled Integration'}
      </Text>,

      // Status
      <Badge key={`status-${integration._id}`} tone={isPublished ? 'success' : 'critical'}>
        {integration.status}
      </Badge>,

      // Published Date
      <Text key={`published-${integration._id}`} as="span" variant="bodyMd">
        {publishedDate
          ? publishedDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '-'}
      </Text>,

      // Unpublished Date
      <Text key={`unpublished-${integration._id}`} as="span" variant="bodyMd">
        {unpublishedDate
          ? unpublishedDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '-'}
      </Text>,

      // Days Active
      <Text
        key={`days-${integration._id}`}
        as="span"
        variant="bodyMd"
        fontWeight={integration.daysActive >= 31 ? 'semibold' : 'regular'}
        tone={integration.daysActive <= 7 ? 'subdued' : undefined}
      >
        {integration.daysActive}d
      </Text>,

      // Lifecycle Stage
      <Badge key={`lifecycle-${integration._id}`} tone={lifecycleTone}>
        {integration.lifecycleStage.charAt(0).toUpperCase() + integration.lifecycleStage.slice(1)}
      </Badge>,
    ]
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <InlineStack gap="200" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Campaign Products
          </Text>
          <Badge tone="info">{shopDomain}</Badge>
        </InlineStack>
      }
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd" tone="subdued">
              {loading
                ? 'Loading...'
                : `${summary.total} products in campaign (${summary.published} active, ${summary.unpublished} churned)`}
            </Text>
          </InlineStack>

          {!loading && (
            <>
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />

              {/* Filter Controls */}
              <InlineStack gap="300">
                <Select
                  label="Status"
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Published', value: 'published' },
                    { label: 'Unpublished', value: 'unpublished' },
                  ]}
                  value={filters.status}
                  onChange={value => setFilters({ ...filters, status: value })}
                />
                <Select
                  label="Lifecycle Stage"
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'New (0-7 days)', value: 'new' },
                    { label: 'Active (8-30 days)', value: 'active' },
                    { label: 'Veteran (31+ days)', value: 'veteran' },
                    { label: 'Churned', value: 'churned' },
                  ]}
                  value={filters.lifecycle}
                  onChange={value => setFilters({ ...filters, lifecycle: value })}
                />
              </InlineStack>
            </>
          )}

          {loading ? (
            <SkeletonBodyText lines={5} />
          ) : (
            <>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'text']}
                headings={['Product Title', 'Status', 'Published Date', 'Unpublished Date', 'Days Active', 'Lifecycle']}
                rows={rows}
                footerContent={
                  filteredIntegrations.length === 0 ? (
                    <Text as="p" alignment="center" tone="subdued">
                      No products in this category
                    </Text>
                  ) : undefined
                }
              />

              {totalPages > 1 && (
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={currentPage > 1}
                    onPrevious={() => setCurrentPage(p => Math.max(1, p - 1))}
                    hasNext={currentPage < totalPages}
                    onNext={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    label={`Page ${currentPage} of ${totalPages}`}
                  />
                </InlineStack>
              )}
            </>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
