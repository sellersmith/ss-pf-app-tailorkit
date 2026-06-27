import { Divider, Icon, InlineStack, SkeletonBodyText, Text } from '@shopify/polaris'
import { ColorIcon, MeasurementSizeIcon, MoneyIcon, StoreManagedIcon } from '@shopify/polaris-icons'
import { useCallback, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type IBlueprintProviderByIdTrickUrl } from '~/routes/api.providers-connection.$id/Printify/fns.server'
import { usePrintifyVariants } from '~/routes/settings_.providers.product.$id/components/VariantsConfig/hooks/usePrintifyVariants'
import { uuid } from '~/utils/uuid'
import { fetchAdvancePrintifyBlueprintsByIds } from '../utilities/fetchAdvancePrintifyBlueprintsInfo'
import { RemixQueryClientProvider } from '~/libs/remix-query/context-provider'
import { ProviderLocation } from './ProviderLocation'

// Module-level singleton request tracker to prevent duplicate API calls
const inFlightRequests = new Map<string, Promise<any>>()

export const AdvancedBlueprintInfo = (props: { blueprintId: string; country?: string }) => {
  const { blueprintId, country } = props
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [advanceInfo, setAdvanceInfo] = useState<IBlueprintProviderByIdTrickUrl | null>(null)
  const { total, data } = advanceInfo || {}

  const [minPrice, setMinPrice] = useState(0)
  const [variants, setVariants] = useState<any[]>([])
  const { remixQueryClient } = useContext(RemixQueryClientProvider)
  const cachedKey = `advanced-${blueprintId}`

  const { getVariantsFromProvider } = usePrintifyVariants()

  const fetchAdvanceInfo = useCallback(async () => {
    try {
      setLoading(true)

      // Check cache first (fast path)
      let advancedDataCached = remixQueryClient.getQueryData(cachedKey)?.advancedData
      if (advancedDataCached) {
        setAdvanceInfo(advancedDataCached)
        return
      }

      // Check if request is already in-flight to avoid duplicate API calls
      if (inFlightRequests.has(blueprintId)) {
        // Wait for the existing request instead of creating a new one
        advancedDataCached = await inFlightRequests.get(blueprintId)
        setAdvanceInfo(advancedDataCached)
        return
      }

      // Create new request and track it
      const requestPromise = fetchAdvancePrintifyBlueprintsByIds({ blueprintId })
        .then(({ providerData }) => {
          if (providerData) {
            remixQueryClient.setQueryData(cachedKey, { advancedData: providerData })
          }
          return providerData
        })
        .finally(() => {
          // Clean up after 5 seconds to prevent memory leaks
          setTimeout(() => inFlightRequests.delete(blueprintId), 5000)
        })

      // Store the promise so other components can reuse it
      inFlightRequests.set(blueprintId, requestPromise)
      advancedDataCached = await requestPromise
      setAdvanceInfo(advancedDataCached)
    } catch (error) {
      console.error('Error fetching advance info:', error)
    } finally {
      setLoading(false)
    }
  }, [blueprintId, cachedKey, remixQueryClient])

  useEffect(() => {
    fetchAdvanceInfo()
  }, [fetchAdvanceInfo])

  useEffect(() => {
    if (advanceInfo && data) {
      // Get variants from provider
      const { variants: _variants, minPrice } = getVariantsFromProvider({ data })

      setVariants(_variants)
      setMinPrice(minPrice)
    }
  }, [getVariantsFromProvider, advanceInfo, data])

  if (loading) {
    return <SkeletonBodyText lines={1} />
  }

  if (!total || !data) {
    return <Divider borderColor="border" borderWidth="025" />
  }

  return (
    <InlineStack gap={'200'}>
      <ProviderLocation country={country} />
      <InlineStack gap={'100'}>
        <Icon source={MoneyIcon} />
        <Text as="span" variant="bodyMd">
          USD {minPrice / 100}
        </Text>
      </InlineStack>
      <InlineStack gap={'100'}>
        <Icon source={StoreManagedIcon} />
        <Text as="span" variant="bodyMd">
          {t('available-provider-total', { total })}
        </Text>
      </InlineStack>
      {variants.map(variant => {
        const { type, count, name } = variant || {}

        return (
          <InlineStack gap={'100'} key={uuid()}>
            <Icon source={type === 'color' ? ColorIcon : MeasurementSizeIcon} />
            <Text as="span" variant="bodyMd">
              {t('name-variants-count', { name, count })}
            </Text>
          </InlineStack>
        )
      })}
    </InlineStack>
  )
}
