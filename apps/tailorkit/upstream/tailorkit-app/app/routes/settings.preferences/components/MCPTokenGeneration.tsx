import { useRevalidator } from '@remix-run/react'
import { Banner, BlockStack, Button, Card, InlineStack, Text, TextField } from '@shopify/polaris'
import { ClipboardIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { CopyToClipboard } from '~/components/CopyToClipboard/CopyToClipboard'
import { TOAST } from '~/constants/toasts'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showToast } from '~/utils/toastEvents'
import { generateToken } from '~/utils/uuid'
import SettingLayout from '~/routes/settings/components/SettingLayout'

function MCPTokenGeneration(props: { appConfig: any }) {
  const { t } = useTranslation()
  const mcpConfig = props.appConfig?.mcp
  const isTokenExpired = mcpConfig?.expiresAt && mcpConfig?.expiresAt < new Date()

  const [token, setToken] = useState(mcpConfig?.accessToken || '')
  const [isGenerating, setIsGenerating] = useState(false)

  const { trackEvent } = useEventsTracking()
  const { revalidate } = useRevalidator()

  const generateMCPToken = useCallback(async () => {
    setIsGenerating(true)
    trackEvent(EVENTS_TRACKING.GENERATE_MCP_ACCESS_TOKEN)

    const newToken = generateToken(512)
    setToken(newToken)

    try {
      // Save token to database in appConfig/mcp/accessToken
      await authenticatedFetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ mcp: { accessToken: newToken, expiresAt: null, createdAt: new Date() } }),
      })

      revalidate()
    } catch (error) {
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }, [trackEvent, revalidate])

  return (
    <SettingLayout title={t('mcp-access-token-generation')}>
      <Card>
        <BlockStack gap={'400'}>
          <BlockStack gap={'200'}>
            <Text as="span" variant="bodyMd">
              {t('mcp-access-token-generation-description')}
            </Text>
          </BlockStack>

          {isTokenExpired && <Banner title={t('mcp-access-expired')} tone="critical" />}

          <TextField
            autoComplete="off"
            label={t('mcp-access-token')}
            labelHidden
            disabled
            suffix={
              <CopyToClipboard text={token} onCopy={() => showToast(t(TOAST.COMMON.COPIED_TO_CLIPBOARD))}>
                <div style={{ marginTop: '4px' }}>
                  <Button variant="plain" id={'copy_code'} icon={ClipboardIcon} />
                </div>
              </CopyToClipboard>
            }
            value={token}
          />
          <InlineStack align="end">
            <Button variant="primary" loading={isGenerating} onClick={generateMCPToken}>
              {!isTokenExpired ? t('generate-access-token') : t('refresh-access-token')}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}

export default MCPTokenGeneration
