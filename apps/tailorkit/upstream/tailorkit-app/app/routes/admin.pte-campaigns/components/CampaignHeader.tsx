import { Badge, Card, InlineGrid, InlineStack, Select, BlockStack, Text, Button } from '@shopify/polaris'
import { useNavigate } from '@remix-run/react'
import { RefreshIcon } from '@shopify/polaris-icons'

/**
 * Campaign selector and metadata header for admin dashboard
 * Displays campaign selection dropdown and last updated timestamp
 *
 * @param selectedCampaign - Currently selected campaign ID
 * @param allCampaigns - Array of all available campaign IDs
 * @param lastCalculatedAt - Timestamp when analytics were last calculated
 * @param startAt - Campaign start date
 * @param endAt - Campaign end date
 * @param fromCache - Whether data is from cache (optional)
 * @param cachedAt - Cache timestamp (optional)
 */
interface CampaignHeaderProps {
  selectedCampaign: string
  allCampaigns: string[]
  lastCalculatedAt: Date
  startAt?: Date
  endAt?: Date
  fromCache?: boolean
  cachedAt?: Date
}

export function CampaignHeader({
  selectedCampaign,
  allCampaigns,
  lastCalculatedAt,
  startAt,
  endAt,
  fromCache = false,
  cachedAt,
}: CampaignHeaderProps) {
  const navigate = useNavigate()

  const handleRefresh = () => {
    navigate(`?campaignId=${selectedCampaign}&refresh=true`)
  }

  // Determine campaign status
  const now = new Date()
  const isActive = startAt && endAt && now >= new Date(startAt) && now <= new Date(endAt)
  const isUpcoming = startAt && now < new Date(startAt)
  const isEnded = endAt && now > new Date(endAt)

  return (
    <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
      <Card>
        <Select
          label="Campaign"
          options={allCampaigns.map(id => ({ label: id, value: id }))}
          value={selectedCampaign}
          onChange={value => navigate(`?campaignId=${value}`)}
        />
      </Card>

      <Card>
        <BlockStack gap="200">
          <Text variant="bodyMd" tone="subdued" as="p">
            Campaign Period
          </Text>
          <InlineStack gap="200" blockAlign="center">
            {startAt && endAt ? (
              <>
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  {new Date(startAt).toLocaleDateString()} - {new Date(endAt).toLocaleDateString()}
                </Text>
                {isActive && <Badge tone="success">Active</Badge>}
                {isUpcoming && <Badge tone="info">Upcoming</Badge>}
                {isEnded && <Badge>Ended</Badge>}
              </>
            ) : (
              <Text variant="bodyMd" as="p">
                -
              </Text>
            )}
          </InlineStack>
          <InlineStack gap="200" align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="bodyMd" tone="subdued" as="p">
                Last Updated: {new Date(lastCalculatedAt).toLocaleString()}
              </Text>
              {fromCache && cachedAt && (
                <Text variant="bodySm" tone="subdued" as="p">
                  Cached data from {new Date(cachedAt).toLocaleTimeString()}
                </Text>
              )}
            </BlockStack>
            <Button icon={RefreshIcon} onClick={handleRefresh} variant="secondary">
              Refresh
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </InlineGrid>
  )
}
