/* eslint-disable max-len */
import { useNavigate } from '@remix-run/react'
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Card,
  InlineStack,
  Layout,
  Link,
  Modal,
  Page,
  PageActions,
  Text,
} from '@shopify/polaris'
import isEqual from 'lodash/isEqual'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { TOAST } from '~/constants/toasts'
import { type ProviderDocument } from '~/models/Provider'
import type { ProviderIntegrationDocument } from '~/models/ProviderIntegration'
import { showToast } from '~/utils/toastEvents'
import { AutoFulfillmentCard } from './AutoFulfillmentCard'
import { ConnectedStoreCard } from './ConnectedStoreCard'
import HowToFulfillCard from './HowToFulfillCard'
import { InputAPIKeyCard } from './InputApiKeyCard'
import {
  DEFAULT_PROVIDER_CONNECTION_DATA,
  SHINEON_DEFAULT_SHOP_ID,
  PRINTWAY_DEFAULT_SHOP_ID,
  useProviderIntegration,
} from './hooks/useProviderIntegration'
import { EHelpLinks } from '~/constants/enum'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { PROVIDER_TRANSMISSION_EVENTS } from './constant'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import ConnectionLostBanner from './ConnectionLostBanner'

interface IProviderConnectionFormProps {
  required?: boolean
  infoBanner?: ReactNode
  providerData: ProviderDocument
  providerIntegrationData: ProviderIntegrationDocument
  layout?: 'page' | 'modal'
  showProviderInfo?: boolean
  /** Callback after save provider connection to update providerConnectionData  */
  callbackAfterSave?: (data: any) => void
}

export default function ProviderConnectionForm(props: IProviderConnectionFormProps) {
  const {
    providerData,
    providerIntegrationData,
    layout = 'page',
    showProviderInfo = true,
    required = true,
    infoBanner,
  } = props
  const { t } = useTranslation()
  const { logoUrl, name: providerName, _id: providerId }: ProviderDocument = providerData || {}
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const {
    shopsList,
    providerConnectionData,
    testingStatus,
    defaultProviderConnectionData,
    setDefaultProviderConnectionData,
    setTestingStatus,
    setShopsList,
    fetchShopsList,
    setProviderConnectionData,
    handleSaveProviderIntegration,
    handleDisconnectProviderIntegration,
  } = useProviderIntegration({ providerId, providerName, providerIntegrationData })

  const isShineOnProvider = providerName === EPROVIDER.SHINEON
  const isPrintWayProvider = providerName === EPROVIDER.PRINTWAY
  const isSingleShopProvider = isShineOnProvider || isPrintWayProvider
  const connectedStatus = providerConnectionData?.apiToken && providerConnectionData?.shopId

  const { apiToken, shopId, autoFulfill } = providerConnectionData
  const enableSave = useMemo(() => {
    const dataUpdated = !isEqual(providerConnectionData, defaultProviderConnectionData)

    return dataUpdated
  }, [defaultProviderConnectionData, providerConnectionData])

  const { trackEvent } = useEventsTracking()

  const handleSave = useCallback(async () => {
    trackEvent(EVENTS_TRACKING.SAVE_PROVIDER_CONNECTION)

    showToast(t(TOAST.PROVIDER.CONNECTING_FULFILLMENT_PROVIDER))
    setSaving(true)

    // Check api is valid or not
    const res = await fetchShopsList()

    if (res.success && res.shopsList) {
      setShopsList(res.shopsList)
      setTestingStatus({ isTesting: false, errorMessage: '', isValid: true })

      const effectiveShopId
        = shopId
        || (isSingleShopProvider ? (isPrintWayProvider ? PRINTWAY_DEFAULT_SHOP_ID : SHINEON_DEFAULT_SHOP_ID) : '')

      if (!effectiveShopId) {
        setErrors({ ...errors, storeIsNull: t('there-are-no-stores-connected') })
      } else {
        const newData = {
          apiToken,
          shopId: effectiveShopId,
          autoFulfill,
        }

        const dataSaved = await handleSaveProviderIntegration({ ...newData, vendor: providerName })

        if (dataSaved.success) {
          setProviderConnectionData(newData)
          setDefaultProviderConnectionData(newData)

          showToast(t(TOAST.PROVIDER.CONNECTED_FULFILLMENT_PROVIDER))
          setSaving(false)

          return
        }

        showToast(t(TOAST.PROVIDER.CONNECT_FULFILLMENT_PROVIDER_FAILED))
        setSaving(false)

        return
      }
    } else {
      setTestingStatus({
        isTesting: false,
        errorMessage: t('api-failed-please-recheck-the-api-again'),
        isValid: false,
      })
    }

    setSaving(false)
    showToast(t(TOAST.PROVIDER.CONNECT_FULFILLMENT_PROVIDER_FAILED), { isError: true })
  }, [
    trackEvent,
    t,
    fetchShopsList,
    setShopsList,
    setTestingStatus,
    shopId,
    errors,
    apiToken,
    autoFulfill,
    handleSaveProviderIntegration,
    providerName,
    isPrintWayProvider,
    isSingleShopProvider,
    setProviderConnectionData,
    setDefaultProviderConnectionData,
  ])

  const toggleConfirmDisconnectModal = () => {
    setConfirmDisconnect(!confirmDisconnect)
  }

  const handleDisconnect = async () => {
    setSaving(true)
    showToast(t(TOAST.PROVIDER.DISCONNECTING_FULFILLMENT_PROVIDER))

    const dataSaved = await handleDisconnectProviderIntegration()

    if (dataSaved.success) {
      showToast(t(TOAST.PROVIDER.DISCONNECTED_FULFILLMENT_PROVIDER))
      setSaving(false)
      setProviderConnectionData(DEFAULT_PROVIDER_CONNECTION_DATA)
      setShopsList([])
      setDefaultProviderConnectionData(DEFAULT_PROVIDER_CONNECTION_DATA)
      toggleConfirmDisconnectModal()
      return
    }
    setSaving(false)
    showToast(t(TOAST.PROVIDER.DISCONNECT_FULFILLMENT_PROVIDER_FAILED), { isError: true })
  }

  const handleDiscard = useCallback(() => {
    // Revert to saved state
    setProviderConnectionData(defaultProviderConnectionData)
    // Clear any validation errors
    setErrors({})
    // Reset testing status if needed
    if (!defaultProviderConnectionData?.apiToken) {
      setTestingStatus({
        isTesting: false,
        errorMessage: '',
        isValid: false,
      })
    }
  }, [defaultProviderConnectionData, setProviderConnectionData, setErrors, setTestingStatus])

  useEffect(() => {
    const handleSaveProviderConnectionData = async () => {
      await handleSave()

      Transmitter.trigger(PROVIDER_TRANSMISSION_EVENTS.PROVIDER_CONNECTION_SAVED, providerConnectionData)
    }

    Transmitter.listen(PROVIDER_TRANSMISSION_EVENTS.SAVE_PROVIDER_CONNECTION_DATA, handleSaveProviderConnectionData)

    return () => {
      Transmitter.remove(PROVIDER_TRANSMISSION_EVENTS.SAVE_PROVIDER_CONNECTION_DATA, handleSaveProviderConnectionData)
    }
  }, [providerConnectionData, handleSave])

  const isValidToken = apiToken && testingStatus.isValid

  const Wrapper = layout === 'page' ? Page : Box
  const wrapperProps = useMemo(
    () =>
      layout === 'page'
        ? { backAction: { content: t('providers'), onAction: () => navigate('/settings/providers') } }
        : { style: { width: '100%' } },
    [t, navigate, layout]
  )
  const LayoutComponent = layout === 'page' ? Layout : Box
  const SectionComponent = layout === 'page' ? Layout.Section : Box

  const renderProviderInfo = () => (
    <SectionComponent>
      <BlockStack gap={'400'}>
        {infoBanner && <Banner tone="info">{infoBanner}</Banner>}

        <InputAPIKeyCard
          required={required}
          setApiToken={(value: string) => setProviderConnectionData({ ...providerConnectionData, apiToken: value })}
          apiToken={apiToken}
          fetchShopsList={fetchShopsList}
          setShopsList={setShopsList}
          testingStatus={testingStatus}
          setTestingStatus={setTestingStatus}
          layout={layout}
        />

        {!showProviderInfo && (
          <Link target="_blank" url={EHelpLinks.HOW_TO_GET_API_KEY} removeUnderline>
            {t('learn-how-to-get-api-key')} ↗
          </Link>
        )}

        <BlockStack gap={'400'}>
          {!isSingleShopProvider && (
            <ConnectedStoreCard
              required={required}
              disabled={!isValidToken}
              errors={errors}
              setErrors={setErrors}
              shopId={shopId}
              setShopId={(value: string) => setProviderConnectionData({ ...providerConnectionData, shopId: value })}
              shopsList={shopsList}
              layout={layout}
            />
          )}
          {/* Temporary hide auto fulfill card */}
          {isValidToken && (shopId || isSingleShopProvider) && (
            <AutoFulfillmentCard
              autoFulfill={autoFulfill}
              layout={layout}
              setAutoFulfill={(value: boolean) =>
                setProviderConnectionData({ ...providerConnectionData, autoFulfill: value })
              }
            />
          )}
        </BlockStack>
      </BlockStack>
    </SectionComponent>
  )

  return (
    <Wrapper title={t('connect-fulfillment-provider')} {...wrapperProps}>
      {/* Add ContextualSaveBar - only show in page layout */}
      {layout === 'page' && (
        <ContextualSaveBar isOpen={enableSave} loading={saving} onSave={handleSave} onDiscard={handleDiscard} />
      )}

      {providerIntegrationData?.connectionStatus === 'disconnected' && (
        <Box paddingBlockEnd="400">
          <ConnectionLostBanner
            onReconnect={() => {
              setProviderConnectionData({ ...providerConnectionData, apiToken: '' })
              setTestingStatus({ isTesting: false, errorMessage: '', isValid: false })
            }}
          />
        </Box>
      )}

      <LayoutComponent>
        {showProviderInfo ? (
          <SectionComponent variant="oneThird">
            <Card>
              <BlockStack gap={'200'}>
                <Text variant="headingMd" as="h3">
                  {t('provider')}
                </Text>

                <Box
                  padding={'200'}
                  paddingInlineStart={'0'}
                  borderColor="border"
                  borderBlockEndWidth="025"
                  borderBlockStartWidth="025"
                >
                  <InlineStack blockAlign="center">
                    <img src={logoUrl} width={'auto'} height={24} alt={providerName} />
                  </InlineStack>
                </Box>
                <Box id="fulfillment-description">
                  <Text variant="bodyMd" as="p">
                    {t(
                      'providername-support-fetching-product-base-and-fulfilling-order-automatically-via-api-with-a-valid-access-token-tailorkit-can-import-product-base-and-fulfill-orders-automatically-for-you',
                      { providerName }
                    )}
                  </Text>
                  <HowToFulfillCard providerName={providerName} />
                </Box>
              </BlockStack>
            </Card>
          </SectionComponent>
        ) : (
          <BlockStack gap={'400'}>
            <InlineStack blockAlign="center" gap="400">
              <InlineStack gap="300" blockAlign="center">
                <Text variant="headingSm" as="h3">
                  {t('connect-fulfillment-provider')} {providerData?.name || 'Printify'}
                </Text>
              </InlineStack>

              <Badge tone={connectedStatus ? 'success' : 'enabled'}>
                {connectedStatus ? t('connected') : t('not-connected')}
              </Badge>
            </InlineStack>

            {!infoBanner && (
              <Text variant="bodyMd" as="p" tone="subdued">
                {t('connect-to-printify-using-api-to-enable-automatic-order-fulfillment')}
              </Text>
            )}

            {layout === 'modal' && renderProviderInfo()}
          </BlockStack>
        )}

        {layout === 'page' && renderProviderInfo()}
      </LayoutComponent>

      {/* PageActions - only show in page layout */}
      {layout === 'page' && (
        <PageActions
          secondaryActions={[
            {
              content: t('disconnect'),
              destructive: true,
              disabled: !defaultProviderConnectionData?.apiToken || enableSave,
              loading: saving,
              onAction: toggleConfirmDisconnectModal,
            },
          ]}
        />
      )}

      <Modal
        open={confirmDisconnect}
        title={t('confirm-disconnection')}
        onClose={toggleConfirmDisconnectModal}
        primaryAction={{
          content: t('disconnect'),
          onAction: handleDisconnect,
          destructive: true,
          loading: saving,
        }}
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: toggleConfirmDisconnectModal,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p" variant="bodyMd">
            {t(
              'if-you-choose-to-disconnect-your-store-will-no-longer-integrate-with-printify-do-you-want-to-proceed-with-the-disconnection'
            )}
          </Text>
        </Modal.Section>
      </Modal>
    </Wrapper>
  )
}
