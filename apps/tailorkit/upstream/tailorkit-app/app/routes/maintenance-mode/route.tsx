import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { BlockStack, Box, Card, Image, Page, Text } from '@shopify/polaris'
import { AppProvider } from '@shopify/shopify-app-remix/react'
import { useTranslation } from 'react-i18next'
import withTranslation from '~/bootstrap/hoc/withTranslation'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { SHOPIFY_API_KEY, MAINTENANCE_MODE } = process.env

  const maintenanceMode = MAINTENANCE_MODE === 'true'

  if (!maintenanceMode) {
    return redirect('/')
  }

  return { apiKey: SHOPIFY_API_KEY || '' }
}
function MaintenanceMode() {
  const { apiKey } = useLoaderData<typeof loader>()

  const { t } = useTranslation()

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <Page>
          <Card>
            <BlockStack align="center" inlineAlign="center">
              <Image
                source="https://cdn.shopify.com/s/files/1/0704/8429/5925/files/tailorkit_maintenace_mode.svg?v=1731303460"
                width={'100%'}
                alt="TailorKit Maintenance Mode"
              />
              <Box maxWidth="70%">
                <BlockStack gap={'300'} inlineAlign="center">
                  <Text as="h2" variant="headingLg" alignment="center">
                    {t('tailorkit-maintenance-mode')}
                  </Text>
                  <Text as="p" variant="bodyLg" alignment="center">
                    {t('tailorkit-maintenance-mode-description')}
                  </Text>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Page>
      </div>
    </AppProvider>
  )
}

export default withTranslation(MaintenanceMode)
