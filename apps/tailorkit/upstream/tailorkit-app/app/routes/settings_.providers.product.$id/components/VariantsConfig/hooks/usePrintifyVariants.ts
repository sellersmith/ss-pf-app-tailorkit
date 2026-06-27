import { type TemporaryVariant } from '~/models/TemporaryFulfillmentProducts'
import { PRODUCT_PROVIDER_ACTION } from '~/routes/api.providers-product.$id/constants'
import type { IPrintifyVariant } from '~/routes/api.providers-connection.$id/Printify/types'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useCallback } from 'react'
import { capitalizeFirstLetter } from '~/bootstrap/fns/misc'
import type { IBlueprintProviderByIdTrickUrl } from '~/routes/api.providers-connection.$id/Printify/fns.server'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'
import { useProviderVariants } from './useProviderVariants'
import { calculateFinalPrice } from '../fns'

// Interface to define the structure of grouped variants
export interface IGroupProviderVariants {
  [key: string]: { [key: string]: boolean }[]
}

// Variable to store information of blue print infor
export const BLUE_PRINTS_INFOR: { [key: string]: any } = {}

export const usePrintifyVariants = () => {
  const { combinedVariants } = useProviderVariants()

  /**
   * Fetches provider blueprint variants based on the given parameters.
   * @param blueprintId - The blueprint ID associated with the provider.
   * @param providerId - The ID of the provider.
   * @param printProvider - The print provider used for fulfillment.
   * @param providerName - The name of the provider (e.g., 'Printify').
   * @returns The response from the API call.
   */
  const fetchProviderBlueprintVariants = async (params: {
    blueprintId: string
    providerId: string
    printProvider: string
  }) => {
    const { printProvider, providerId, blueprintId } = params

    // Perform authenticated API call to fetch provider blueprint variants
    const res = await authenticatedFetch(`/api/providers-product/${blueprintId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: PRODUCT_PROVIDER_ACTION.Printify.FETCH_PROVIDER_BLUEPRINT_VARIANTS,
        printProvider,
        providerId,
      }),
    })

    return res
  }

  /**
   * Groups Printify provider blueprint variants by their option keys and values.
   * Converts the variants into an object format that can be used for UI rendering.
   * @param variants - The array of Printify variants.
   * @returns A grouped object containing the variant options with their respective values.
   */
  const groupBlueprintVariants = (
    variants: IPrintifyVariant[],
    savedVariants: TemporaryVariant[]
  ): IGroupProviderVariants => {
    const group = variants.reduce((acc: any, variant) => {
      const { options } = variant

      Object.entries(options).forEach(([vKey, vValue]) => {
        if (!acc[vKey]) {
          acc[vKey] = new Set()
        }
        acc[vKey].add(vValue)
      })

      return acc
    }, {})

    const checkSelecting = (value: string) => {
      return savedVariants.some(v => v.title.split(' / ').includes(value))
    }

    // Convert each Set back to an array of objects with the original structure
    Object.keys(group).forEach(key => {
      group[key] = Array.from(group[key]).map(value => ({
        [value as string]: savedVariants.length ? !!checkSelecting(value as string) : true,
      }))
    })

    return group
  }

  /**
   * Generates all possible combinations of valid options from a grouped set of provider variants.
   *
   * @param {IGroupProviderVariants} groupProviderVariants - An object where keys are category names
   * (e.g., "color", "size") and values are arrays of options. Each option is an object with a single
   * key-value pair, where the key is the option name and the value is a boolean indicating validity.
   *
   * @returns {string[]} - An array of strings, where each string is a unique combination of options
   * across all categories, formatted as "option1 / option2 / ...".
   */
  const generateBlueprintVariantCombinations = (
    variants: IPrintifyVariant[],
    groupPrintifyVariants: IGroupProviderVariants
  ): TemporaryVariant[] => {
    const categories = Object.keys(groupPrintifyVariants) // Get category names, e.g., ["color", "size"]
    const validOptions: any = {}

    // Filter valid options for each category
    categories.forEach(category => {
      validOptions[category] = groupPrintifyVariants[category]
        .filter(option => Object.values(option)[0]) // Only keep options where value is true
        .map(option => Object.keys(option)[0]) // Extract the option name (key)
    })
    const output: any[] = combinedVariants(categories, validOptions, variants)
    return output
  }

  const mergedBlueprintWithSavedVariants = (
    selectedPrintProvider: string,
    savedVariants: TemporaryVariant[],
    providerVariantCombined: any[],
    baseProfitMargin: number = 0
  ): TemporaryVariant[] => {
    const min_price = BLUE_PRINTS_INFOR[selectedPrintProvider]?.min_price / 100 || 0
    const variants = ProductProviderStore.getState().variants

    return providerVariantCombined.map((providerVariant: any) => {
      const variant = variants.find(variant => variant.id.toString() === providerVariant.id.toString())
      const baseCost = variant?.cost || min_price || 0
      const price = variant?.price || calculateFinalPrice(baseCost, baseProfitMargin)
      const savedVariant = savedVariants.find(variant => variant.id === providerVariant.id) || {}

      return {
        ...providerVariant,
        cost: baseCost,
        price,
        profitMargin: baseProfitMargin,
        active: true,
        ...savedVariant,
      }
    })
  }

  const getVariantsFromProvider = useCallback((args: { data: IBlueprintProviderByIdTrickUrl['data'] }) => {
    const { data } = args

    let minPrice = Infinity
    let rawVariants: any = {}
    const sizeTypes: any = {}

    for (const providerData of data) {
      const { min_price, options, id, name } = providerData

      minPrice = Math.min(minPrice, min_price)
      if (options.length > 0) {
        rawVariants = options.reduce((variants: any, option: { type: 'size' | 'color'; items: any[] }) => {
          if (['size', 'color'].includes(option.type)) {
            const sizeItems = option.items.length
            variants[option.type] = sizeItems
            sizeTypes[option.type] = sizeTypes[option.type] ? Math.max(sizeTypes[option.type], sizeItems) : sizeItems
          }
          return variants
        }, {})
      }

      BLUE_PRINTS_INFOR[id] = {
        name,
        variants: rawVariants,
        min_price,
      }
    }

    const _variants = Object.keys(sizeTypes).map(key => ({
      name: capitalizeFirstLetter(key),
      type: key,
      count: sizeTypes[key],
    }))

    return {
      variants: _variants,
      minPrice,
    }
  }, [])

  return {
    fetchProviderBlueprintVariants,
    groupBlueprintVariants,
    generateBlueprintVariantCombinations,
    mergedBlueprintWithSavedVariants,
    getVariantsFromProvider,
  }
}
