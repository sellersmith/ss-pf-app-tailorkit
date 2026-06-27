import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import {
  AppProvider,
  BlockStack,
  Button,
  Card,
  Form,
  FormLayout,
  Layout,
  Page,
  Text,
  TextField,
} from '@shopify/polaris'
import { useState } from 'react'
import { rootPage } from '~/bootstrap/app-config'
import withTranslation from '~/bootstrap/hoc/withTranslation'
import { login } from '../../shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)

  if (url.searchParams.get('shop')) {
    throw redirect(`${rootPage}?${url.searchParams.toString()}`)
  }

  return json({ showForm: Boolean(login) })
}

function App(props: any) {
  const { t } = props
  const { showForm } = useLoaderData<typeof loader>()
  const [shop, setShop] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handleChange = (value: string) => {
    setShop(value)
  }

  const onSubmit = () => {
    setLoading(true)
    window.location.href = `/auth/login?shop=${shop}`
  }

  return (
    <AppProvider i18n={{}}>
      <Page fullWidth>
        <Layout>
          <Layout.Section>
            <div style={{ width: 'min(90vw, 480px)', transform: 'translateY(calc(50vh - 160px))', margin: 'auto' }}>
              {showForm && (
                <Form onSubmit={onSubmit} method="post" action="/auth/login">
                  <FormLayout>
                    <BlockStack align="center" inlineAlign="center" gap="100">
                      <Text as="h1" variant="heading2xl">
                        TailorKit
                      </Text>
                      <Text as="p" variant="bodyMd">
                        {t('an-insane-magnificent-significant-product-customization-app')}
                      </Text>
                    </BlockStack>
                    <Card>
                      <BlockStack gap={'400'}>
                        <TextField
                          label={'Store name'}
                          autoComplete="off"
                          value={shop}
                          onChange={handleChange}
                          suffix=".myshopify.com"
                        />
                        <Button
                          loading={loading}
                          fullWidth
                          onClick={() => onSubmit()}
                          disabled={!shop}
                          variant="primary"
                        >
                          {t('login')}
                        </Button>
                      </BlockStack>
                    </Card>
                  </FormLayout>
                </Form>
              )}
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  )
}

export default withTranslation(App)
