import { BlockStack, Box, Button, Card, Icon, InlineStack, TextField } from '@shopify/polaris'
import { CheckSmallIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import useDevices from '~/utils/hooks/useDevice'

export const InputAPIKeyCard = (props: {
  apiToken: string
  testingStatus: { isTesting?: boolean; isValid?: boolean; errorMessage?: string }
  setApiToken: (value: string) => void
  setShopsList: (shopsList: { label: string; value: number | string }[]) => void
  setTestingStatus: (params: { isTesting?: boolean; isValid?: boolean; errorMessage?: string }) => void
  fetchShopsList: () => Promise<any>
  layout?: 'page' | 'modal'
  required?: boolean
}) => {
  const { t } = useTranslation()
  const { isMobileView } = useDevices()
  const {
    apiToken,
    testingStatus,
    setApiToken,
    fetchShopsList,
    setShopsList,
    setTestingStatus,
    layout = 'page',
    required = true,
  } = props

  async function handleTestAPI() {
    setTestingStatus({ ...testingStatus, isTesting: true })
    const res = await fetchShopsList()

    if (res.success && res.shopsList) {
      setShopsList(res.shopsList)
      setTestingStatus({ isTesting: false, errorMessage: '', isValid: true })
    } else {
      setTestingStatus({
        isTesting: false,
        errorMessage: t('api-failed-please-recheck-the-api-again'),
        isValid: false,
      })
      setShopsList([])
    }
  }

  function handleChangeAPIToken(value: string) {
    setApiToken(value)
    setTestingStatus({ ...testingStatus, errorMessage: '' })
  }

  function handleBlur() {
    const realValue = apiToken.trim()
    setApiToken(realValue)
  }

  const Wrapper = layout === 'page' ? Card : Box
  const BlockWrapper = isMobileView ? BlockStack : InlineStack

  return (
    <Box id="api-token-card">
      <Wrapper>
        <BlockWrapper
          wrap={false}
          gap={'200'}
          align={isMobileView ? 'end' : undefined}
          blockAlign={isMobileView ? (testingStatus.errorMessage ? 'center' : 'end') : undefined}
        >
          <div style={{ flex: 1 }}>
            <TextField
              id="api-token-input"
              label={t('api-token')}
              autoComplete={'off'}
              value={apiToken}
              placeholder={t('input-token')}
              onChange={handleChangeAPIToken}
              onBlur={handleBlur}
              error={testingStatus.errorMessage}
              requiredIndicator={required}
            />
          </div>

          <BlockStack align={!isMobileView && testingStatus.errorMessage ? 'center' : 'end'} inlineAlign={'end'}>
            <Box>
              <Button
                id="test-api-key-btn"
                variant="secondary"
                onClick={handleTestAPI}
                loading={testingStatus.isTesting}
                disabled={!apiToken}
                icon={testingStatus.isValid ? <Icon source={CheckSmallIcon} tone="success" /> : undefined}
              >
                {t('test-api-key')}
              </Button>
            </Box>
          </BlockStack>
        </BlockWrapper>
      </Wrapper>
    </Box>
  )
}
