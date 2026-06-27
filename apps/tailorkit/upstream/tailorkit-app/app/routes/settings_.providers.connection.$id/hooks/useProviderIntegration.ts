import { useCallback, useEffect, useState } from 'react'
import { PROVIDER_CONNECT_ACTION } from '~/routes/api.providers-connection.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useTranslation } from 'react-i18next'
import { EPROVIDER } from '~/constants/fulfillment-providers'

export const DEFAULT_PROVIDER_CONNECTION_DATA = { apiToken: '', shopId: '', autoFulfill: false }
export const SHINEON_DEFAULT_SHOP_ID = 'shineon-default'
export const PRINTWAY_DEFAULT_SHOP_ID = 'printway-default'

type ShopOption = { label: string; value: number | string }

export const useProviderIntegration = (props: {
  providerId: string
  providerName?: string
  providerIntegrationData: any
}) => {
  const { providerId, providerName, providerIntegrationData } = props
  const { apiToken, shopId, autoFulfill } = providerIntegrationData || DEFAULT_PROVIDER_CONNECTION_DATA
  const { t } = useTranslation()

  const [defaultProviderConnectionData, setDefaultProviderConnectionData] = useState({ apiToken, shopId, autoFulfill })
  const [providerConnectionData, setProviderConnectionData] = useState({ apiToken, shopId, autoFulfill })
  const [shopsList, setShopsList] = useState<ShopOption[]>([])
  const [testingStatus, setTestingStatus] = useState<{
    isTesting?: boolean
    isValid?: boolean
    errorMessage?: string
  }>({
    isTesting: false,
    isValid: false,
    errorMessage: '',
  })

  const fetchShopsList = useCallback(async () => {
    try {
      const { apiToken } = providerConnectionData

      if (providerName === EPROVIDER.SHINEON) {
        const res = await authenticatedFetch(`/api/providers-connection/${providerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: PROVIDER_CONNECT_ACTION.CHECK_VALID_CONNECTION,
            providerName: EPROVIDER.SHINEON,
            apiToken,
          }),
        })

        if (res?.success && res?.isValidConnection) {
          return {
            success: true,
            shopsList: [{ label: 'ShineOn Default', value: SHINEON_DEFAULT_SHOP_ID }],
          }
        }

        return { success: false, shopsList: [] }
      }

      if (providerName === EPROVIDER.PRINTWAY) {
        const res = await authenticatedFetch(`/api/providers-connection/${providerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: PROVIDER_CONNECT_ACTION.CHECK_VALID_CONNECTION,
            providerName: EPROVIDER.PRINTWAY,
            apiToken,
          }),
        })

        if (res?.success && res?.isValidConnection) {
          return {
            success: true,
            shopsList: [{ label: 'PrintWay Default', value: PRINTWAY_DEFAULT_SHOP_ID }],
          }
        }

        return { success: false, shopsList: [] }
      }

      const res = await authenticatedFetch(`/api/providers-connection/${providerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: PROVIDER_CONNECT_ACTION.Printify.GET_SHOPS_LIST,
          apiToken,
        }),
      })

      return res
    } catch (err) {
      console.error('Failed to fetch shops list', err)
    }
  }, [providerConnectionData, providerId, providerName])

  const handleSaveProviderIntegration = useCallback(
    async (params: { vendor: string; apiToken: string; shopId: string; autoFulfill?: boolean }) => {
      try {
        const { vendor, apiToken, shopId, autoFulfill } = params
        const res1 = await authenticatedFetch(`/api/providers-connection/${providerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: PROVIDER_CONNECT_ACTION.SAVE_PROVIDER_INTEGRATION_DATA,
            apiToken,
            shopId,
            autoFulfill,
            providerId,
          }),
        })

        if (!res1?.success) throw new Error(res1.message)

        // Subscribe essential webhooks
        const res2 = await authenticatedFetch(`/api/providers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'webhooks.create',
            vendor,
            data: {
              topic: 'order:updated',
            },
          }),
        })

        if (!res2?.success) throw new Error(res2.message)

        return { success: true }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : (e as string)

        return {
          success: false,
          message: errorMessage,
        }
      }
    },
    [providerId]
  )

  const handleDisconnectProviderIntegration = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`/api/providers-connection/${providerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: PROVIDER_CONNECT_ACTION.DISCONNECT_PROVIDER_INTEGRATION,
          providerId,
        }),
      })

      return res
    } catch (err) {
      console.error('Failed to disconnect provider integration ', err)
    }
  }, [providerId])

  useEffect(() => {
    ;(async () => {
      // Auto test the API key when mounting
      if (providerIntegrationData?.apiToken) {
        setTestingStatus({ ...testingStatus, isTesting: true })
        const res = await fetchShopsList()

        if (res?.success && res.shopsList) {
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
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerIntegrationData?.apiToken])

  return {
    shopsList,
    providerConnectionData,
    testingStatus,
    defaultProviderConnectionData,
    setDefaultProviderConnectionData,
    setProviderConnectionData,
    setShopsList,
    setTestingStatus,
    fetchShopsList,
    handleSaveProviderIntegration,
    handleDisconnectProviderIntegration,
  }
}
