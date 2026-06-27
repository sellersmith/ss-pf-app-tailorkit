import { useCallback, useContext, useEffect, useMemo, useState, type ComponentType } from 'react'
import { RemixQueryClientProvider } from '~/libs/remix-query/context-provider'
import objectToQueryString from '~/utils/objectToQueryString'
import type { TemporaryVariant } from '~/models/TemporaryFulfillmentProducts'
import type { ProviderDocument } from '~/models/Provider'
import { useStore } from '~/libs/external-store'
import {
  type IGroupProviderVariants,
  usePrintifyVariants,
} from '../components/VariantsConfig/hooks/usePrintifyVariants'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'

export interface VariantsDataWithPrintifyProps {
  blueprintId: string
  providerInfo: ProviderDocument
  savedVariants: TemporaryVariant[]
  printProviderSaved: string
}

const enhanceVariantsDataWithPrintify = <P extends VariantsDataWithPrintifyProps>(Component: ComponentType<P>) => {
  return (props: P) => {
    const {
      providerInfo: { _id: providerId },
      blueprintId,
      savedVariants,
      printProviderSaved,
    } = props

    const selectedPrintProvider = useStore(ProductProviderStore, state => state.productProviderId)
    const baseProfitMargin = useStore(ProductProviderStore, state => state.baseProfitMargin) || 0

    const {
      fetchProviderBlueprintVariants,
      groupBlueprintVariants,
      generateBlueprintVariantCombinations,
      mergedBlueprintWithSavedVariants,
    } = usePrintifyVariants()

    const [isFetching, setIsFetching] = useState(false)
    const [variants, setVariants] = useState<any[]>([])

    const { remixQueryClient } = useContext(RemixQueryClientProvider)

    const cachedKey = useMemo(
      () => objectToQueryString({ selectedPrintProvider, blueprintId, providerId }),
      [blueprintId, providerId, selectedPrintProvider]
    )

    const shouldUseSavedVariants = useMemo(
      () => printProviderSaved === selectedPrintProvider,
      [printProviderSaved, selectedPrintProvider]
    )

    const groupVariants = useMemo(
      () => groupBlueprintVariants(variants, shouldUseSavedVariants ? savedVariants : []),
      [groupBlueprintVariants, shouldUseSavedVariants, savedVariants, variants]
    )

    const getVariantsSelected = useCallback(
      (groupVariants: IGroupProviderVariants) => {
        const providerVariantsCombination = generateBlueprintVariantCombinations(variants, groupVariants)

        return mergedBlueprintWithSavedVariants(
          selectedPrintProvider,
          shouldUseSavedVariants ? savedVariants : [],
          providerVariantsCombination,
          baseProfitMargin
        )
      },
      [
        variants,
        selectedPrintProvider,
        shouldUseSavedVariants,
        savedVariants,
        baseProfitMargin,
        generateBlueprintVariantCombinations,
        mergedBlueprintWithSavedVariants,
      ]
    )

    useEffect(() => {
      let cancelled = false // Cancellation flag

      const fetchVariants = async () => {
        setIsFetching(true)
        try {
          const cachedData = remixQueryClient.getQueryData(cachedKey)

          if (cachedData === undefined) {
            const res = await fetchProviderBlueprintVariants({
              printProvider: selectedPrintProvider,
              providerId,
              blueprintId,
            })

            if (!cancelled && res.success && res.variants) {
              setVariants(res.variants)
              remixQueryClient.setQueryData(cachedKey, {
                variants: res.variants,
              })
            }
          } else if (!cancelled) {
            setVariants(cachedData.variants)
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Error fetching variants:', error)
          }
        } finally {
          if (!cancelled) {
            setIsFetching(false)
          }
        }
      }

      fetchVariants()

      return () => {
        cancelled = true // Cancel on cleanup
      }
      //  eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blueprintId, providerId, cachedKey, selectedPrintProvider])

    useEffect(() => {
      // Only dispatch if we have valid data
      if (!shouldUseSavedVariants && Object.keys(groupVariants).length > 0) {
        const selectedVariants = getVariantsSelected(groupVariants)

        // Final safety check: only dispatch if we have selections
        if (selectedVariants.length > 0) {
          ProductProviderStore.dispatch({
            type: 'SET_VARIANTS',
            payload: {
              variants: selectedVariants.map(variant => ({
                ...variant,
                profitMargin: variant.profitMargin || baseProfitMargin,
              })),
            },
          })
        }
      }
    }, [baseProfitMargin, getVariantsSelected, groupVariants, shouldUseSavedVariants])

    return (
      <Component
        {...props}
        groupVariants={groupVariants}
        getVariantsSelected={getVariantsSelected}
        isFetching={isFetching}
      />
    )
  }
}

export default enhanceVariantsDataWithPrintify
