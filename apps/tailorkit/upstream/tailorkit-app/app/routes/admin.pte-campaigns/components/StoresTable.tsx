import { Card, IndexTable, Badge, InlineStack, BlockStack, Text, Tabs, Tooltip, Icon } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PTE_BADGE_THRESHOLDS } from '~/bootstrap/constants/achievements'
import { ProductsModal } from './ProductsModal'
import { EmailFilter } from './EmailFilter'

/**
 * Store participation metrics for PTE campaign
 */
interface Store {
  shopDomain: string
  shopEmail?: string // Shop email for filtering
  currentPublishedCount: number // Current active products
  peakPublishedCount: number // Highest count achieved (for persistent badges)
  firstPublishedAt?: Date // First product published in campaign
  lastPublishedAt?: Date // Most recent publish
  daysSinceLastPublish?: number | null
  isActive?: boolean // Published in last 7 days
  daysToFirstPublish?: number | null // Days from campaign start to first publish
  engagementSpan?: number // Days between first and last publish
  shopCreatedAt?: Date // Shop install date
}

/**
 * Displays participating stores in a sortable, filterable table
 * Shows store domain, product counts, dates, and badge status
 *
 * @param stores - Array of stores participating in the campaign with their metrics
 */
interface StoresTableProps {
  stores: Store[]
  campaignId: string
}

export function StoresTable({ stores, campaignId }: StoresTableProps) {
  const [selectedTab, setSelectedTab] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedShop, setSelectedShop] = useState<{ domain: string; count: number } | null>(null)
  const [emailPattern, setEmailPattern] = useState('')
  const [filterMode, setFilterMode] = useState<'include' | 'exclude'>('exclude')
  const { t } = useTranslation()

  /**
   * Filter stores by email pattern
   */
  const filterByEmail = useCallback(
    (store: Store) => {
      const trimmedPattern = emailPattern.trim()

      // No filter applied
      if (!trimmedPattern) return true

      // Store has no email
      if (!store.shopEmail) {
        return filterMode === 'exclude' // Exclude mode: include stores without email
      }

      // Case-insensitive substring match
      const matches = store.shopEmail.toLowerCase().includes(trimmedPattern.toLowerCase())

      return filterMode === 'include' ? matches : !matches
    },
    [emailPattern, filterMode]
  )

  // Stage 1: Email filter
  const emailFilteredStores = useMemo(() => stores.filter(filterByEmail), [stores, filterByEmail])

  // Calculate badge counts from EMAIL-FILTERED stores
  const noBadgeCount = useMemo(
    () => emailFilteredStores.filter(s => s.peakPublishedCount < PTE_BADGE_THRESHOLDS.CREATOR).length,
    [emailFilteredStores]
  )
  const creatorCount = useMemo(
    () =>
      emailFilteredStores.filter(
        s => s.peakPublishedCount >= PTE_BADGE_THRESHOLDS.CREATOR && s.peakPublishedCount < PTE_BADGE_THRESHOLDS.ARTISAN
      ).length,
    [emailFilteredStores]
  )
  const artisanCount = useMemo(
    () =>
      emailFilteredStores.filter(
        s => s.peakPublishedCount >= PTE_BADGE_THRESHOLDS.ARTISAN && s.peakPublishedCount < PTE_BADGE_THRESHOLDS.MASTER
      ).length,
    [emailFilteredStores]
  )
  const masterCount = useMemo(
    () => emailFilteredStores.filter(s => s.peakPublishedCount >= PTE_BADGE_THRESHOLDS.MASTER).length,
    [emailFilteredStores]
  )
  const tabs = useMemo(
    () => [
      { id: 'all', content: `All (${emailFilteredStores.length})` },
      {
        id: 'no-badge',
        content: `No Badge (${noBadgeCount})`,
      },
      {
        id: 'creator',
        content: `Creator (${creatorCount})`,
      },
      {
        id: 'artisan',
        content: `Artisan (${artisanCount})`,
      },
      {
        id: 'master',
        content: `Master (${masterCount})`,
      },
    ],
    [artisanCount, creatorCount, masterCount, noBadgeCount, emailFilteredStores.length]
  )

  // Stage 2: Badge filter
  const filteredStores = useMemo(() => {
    switch (tabs[selectedTab].id) {
      case 'no-badge':
        return emailFilteredStores.filter(s => s.peakPublishedCount < PTE_BADGE_THRESHOLDS.CREATOR)
      case 'creator':
        return emailFilteredStores.filter(
          s =>
            s.peakPublishedCount >= PTE_BADGE_THRESHOLDS.CREATOR && s.peakPublishedCount < PTE_BADGE_THRESHOLDS.ARTISAN
        )
      case 'artisan':
        return emailFilteredStores.filter(
          s =>
            s.peakPublishedCount >= PTE_BADGE_THRESHOLDS.ARTISAN && s.peakPublishedCount < PTE_BADGE_THRESHOLDS.MASTER
        )
      case 'master':
        return emailFilteredStores.filter(s => s.peakPublishedCount >= PTE_BADGE_THRESHOLDS.MASTER)
      default:
        return emailFilteredStores
    }
  }, [emailFilteredStores, selectedTab, tabs])

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="200" blockAlign="center">
          <Text variant="headingMd" as="h3">
            Participating Stores
          </Text>
          <Tooltip content="Detailed view of all stores participating in this campaign">
            <Icon source={InfoIcon} tone="subdued" />
          </Tooltip>
        </InlineStack>
        <EmailFilter
          emailPattern={emailPattern}
          filterMode={filterMode}
          onEmailPatternChange={setEmailPattern}
          onFilterModeChange={setFilterMode}
        />
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
        <IndexTable
          itemCount={filteredStores.length}
          headings={[
            { title: 'Shop Domain' },
            { title: 'Email' },
            {
              id: 'published-products',
              title: (
                <InlineStack gap="100" blockAlign="center">
                  <Text as="span">{t('published-products')}</Text>
                  <Tooltip content={t('published-products-tooltip')}>
                    <Icon source={InfoIcon} tone="subdued" />
                  </Tooltip>
                </InlineStack>
              ),
            },
            { title: 'Badges Earned' },
            {
              id: 'activity-status',
              title: (
                <InlineStack gap="100" blockAlign="center">
                  <Text as="span">Activity Status</Text>
                  <Tooltip content="Is this store still engaged? Active = published in past 7 days | Dormant = no activity for 7+ days">
                    <Icon source={InfoIcon} tone="subdued" />
                  </Tooltip>
                </InlineStack>
              ),
            },
            {
              id: 'days-to-first',
              title: (
                <InlineStack gap="100" blockAlign="center">
                  <Text as="span">{t('days-to-first')}</Text>
                  <Tooltip content={t('days-to-first-tooltip')}>
                    <Icon source={InfoIcon} tone="subdued" />
                  </Tooltip>
                </InlineStack>
              ),
            },
            {
              id: 'engagement-span',
              title: (
                <InlineStack gap="100" blockAlign="center">
                  <Text as="span">{t('engagement-span')}</Text>
                  <Tooltip content={t('engagement-span-tooltip')}>
                    <Icon source={InfoIcon} tone="subdued" />
                  </Tooltip>
                </InlineStack>
              ),
            },
            { title: 'Install At' },
            { title: 'First Publish' },
            { title: 'Last Publish' },
          ]}
          selectable={false}
        >
          {filteredStores.map((store, index) => {
            const badges: string[] = []
            if (store.peakPublishedCount >= PTE_BADGE_THRESHOLDS.MASTER) badges.push('Master')
            if (store.peakPublishedCount >= PTE_BADGE_THRESHOLDS.ARTISAN) badges.push('Artisan')
            if (store.peakPublishedCount >= PTE_BADGE_THRESHOLDS.CREATOR) badges.push('Creator')

            return (
              <IndexTable.Row id={store.shopDomain} key={index} position={index}>
                <IndexTable.Cell>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    {store.shopDomain}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Tooltip content={store.shopEmail || 'No email'}>
                    <Text variant="bodySm" as="p" truncate>
                      {store.shopEmail || '-'}
                    </Text>
                  </Tooltip>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Tooltip content="Click to view products published by this store">
                    <div
                      style={{ cursor: 'pointer', width: 'fit-content' }}
                      onClick={() => {
                        setSelectedShop({ domain: store.shopDomain, count: store.currentPublishedCount })
                        setModalOpen(true)
                      }}
                    >
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                          {store.currentPublishedCount} active
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="p">
                          Peak: {store.peakPublishedCount}
                        </Text>
                      </BlockStack>
                    </div>
                  </Tooltip>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="100">
                    {badges.includes('Master') && <Badge tone="success">Master</Badge>}
                    {badges.includes('Artisan') && <Badge tone="warning">Artisan</Badge>}
                    {badges.includes('Creator') && <Badge tone="info">Creator</Badge>}
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <BlockStack gap="100">
                    <Badge tone={store.isActive ? 'success' : 'attention'}>
                      {store.isActive ? 'Active' : 'Dormant'}
                    </Badge>

                    {/* High-value churn alert */}
                    {!store.isActive && store.peakPublishedCount >= 5 && (
                      <Badge tone="critical">High-value churn ⚠️</Badge>
                    )}

                    {/* Stagnant store alert */}
                    {store.isActive
                      && store.daysSinceLastPublish !== null
                      && store.daysSinceLastPublish !== undefined
                      && store.daysSinceLastPublish > 14 && (
                        <Badge tone="warning">{`Stagnant (${store.daysSinceLastPublish}d)`}</Badge>
                      )}

                    {store.daysSinceLastPublish !== null
                      && store.daysSinceLastPublish !== undefined
                      && store.daysSinceLastPublish <= 14 && (
                        <Text variant="bodySm" tone="subdued" as="p">
                          {store.daysSinceLastPublish}d ago
                        </Text>
                      )}
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="p">
                    {store.daysToFirstPublish !== null && store.daysToFirstPublish !== undefined
                      ? `${store.daysToFirstPublish}d`
                      : '-'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="p">
                    {store.engagementSpan !== undefined ? `${store.engagementSpan}d` : '0d'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="p">
                    {store.shopCreatedAt ? new Date(store.shopCreatedAt).toLocaleDateString() : '-'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="p">
                    {store.firstPublishedAt ? new Date(store.firstPublishedAt).toLocaleDateString() : '-'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="p">
                    {store.lastPublishedAt ? new Date(store.lastPublishedAt).toLocaleDateString() : '-'}
                  </Text>
                </IndexTable.Cell>
              </IndexTable.Row>
            )
          })}
        </IndexTable>
      </BlockStack>

      {selectedShop && (
        <ProductsModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setSelectedShop(null)
          }}
          campaignId={campaignId}
          shopDomain={selectedShop.domain}
        />
      )}
    </Card>
  )
}
