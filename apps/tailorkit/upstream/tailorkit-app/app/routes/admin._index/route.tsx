import { useNavigate } from '@remix-run/react'
import { BlockStack, Button, Card, InlineGrid, InlineStack, Page, Text, TextField } from '@shopify/polaris'
import { ChartHistogramGrowthIcon, ChartPopularIcon, ClockIcon, DataTableIcon, ImageIcon } from '@shopify/polaris-icons'
import React, { useState } from 'react'
import withTranslation from '~/bootstrap/hoc/withTranslation'

const DUMMY_PASSWORD = process.env.TAILORKIT_INTERNAL_ADMIN_PASSWORD || ''

const adminPages = [
  {
    title: 'API Usage',
    description: 'Monitor API costs, requests, tokens, and quotas',
    url: '/admin/api-usage',
    icon: ChartHistogramGrowthIcon,
  },
  {
    title: 'API Quotas',
    description: 'Detailed quota metrics for users and shops',
    url: '/admin/quotas',
    icon: DataTableIcon,
  },
  {
    title: 'Web Vitals',
    description: 'Performance monitoring across all shops',
    url: '/admin/web-vitals',
    icon: ClockIcon,
  },
  {
    title: 'Clipart Analytics',
    description: 'Track clipart usage and click analytics',
    url: '/admin/clipart-analytics',
    icon: ImageIcon,
  },
  {
    title: 'PTE Campaigns',
    description: 'View Publish to Earn campaign analytics and performance',
    url: '/admin/pte-campaigns',
    icon: ChartPopularIcon,
  },
]

function AdminDashboard() {
  const navigate = useNavigate()

  // Authentication state
  const [authToken, setAuthToken] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('TK_ADMIN_AUTH') === 'true'
    }
    return false
  })

  const handleAuthenticate = () => {
    if (authToken === DUMMY_PASSWORD) {
      setIsAuthenticated(true)
      if (typeof window !== 'undefined') {
        localStorage.setItem('TK_ADMIN_AUTH', 'true')
      }
    }
  }

  // Render login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <Page title="Admin Login" fullWidth>
        <Card>
          <BlockStack gap="400">
            <TextField
              label="Secret Token"
              value={authToken}
              type="password"
              autoComplete="off"
              onChange={value => setAuthToken(value)}
            />
            <InlineStack align="end">
              <Button variant="primary" onClick={handleAuthenticate} disabled={!authToken}>
                Enter
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </Page>
    )
  }

  return (
    <Page title="TailorKit Admin Dashboard" fullWidth>
      <BlockStack gap="400">
        <Text as="p" variant="bodyMd" tone="subdued">
          Select an admin section to view detailed information and analytics
        </Text>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {adminPages.map(page => (
            <Card key={page.url}>
              <BlockStack gap="400">
                <InlineStack gap="400" blockAlign="center">
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--p-color-bg-surface-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <page.icon />
                  </div>
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingMd">
                      {page.title}
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {page.description}
                    </Text>
                  </BlockStack>
                </InlineStack>
                <InlineStack align="end">
                  <Button onClick={() => navigate(page.url)}>View Details</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>
      </BlockStack>
    </Page>
  )
}

export default withTranslation(AdminDashboard)
