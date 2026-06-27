/* eslint-disable react-hooks/exhaustive-deps */
import { useContext, useEffect, useMemo, useState } from 'react'
import { fetchPrintifyBlueprints } from '../utilities/fetchPrintfyProducts'
import { RemixQueryClientProvider } from '~/libs/remix-query/context-provider'
import objectToQueryString from '~/utils/objectToQueryString'
import unionBy from 'lodash/unionBy'
import type { IBlueprintWithAdvanceInfo } from '~/routes/api.providers-connection.$id/Printify/types'
import { type TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'

interface IFetchPrintifyProductsProps {
  queryString?: string
  providerId: string
  selectedProducts?: TemporaryProduct[]
  itemsPerLoad?: number
  brandSelected?: string[]
}

const ITEMS_PER_LOAD = 10

export const useFetchPrintifyProducts = ({
  queryString = '',
  providerId,
  selectedProducts = [],
  itemsPerLoad = ITEMS_PER_LOAD,
  brandSelected = [],
}: IFetchPrintifyProductsProps) => {
  const { remixQueryClient } = useContext(RemixQueryClientProvider)

  const cachedKey = useMemo(() => objectToQueryString({ providerId }), [providerId])
  const cachedData = remixQueryClient.getQueryData(cachedKey)
  const hasCache = cachedData !== undefined

  // Set initial isFetching to true if no cache exists to avoid empty state flash
  const [isFetching, setIsFetching] = useState(!hasCache)
  const [isSearching, setIsSearching] = useState(false)
  const [isFetchNextPage, setIsFetchNextPage] = useState(false)
  const [blueprints, setBlueprints] = useState<IBlueprintWithAdvanceInfo[]>([])

  // Memoize selectedProductsMap and create a stable hash for comparison
  const selectedProductsHash = useMemo(
    () =>
      selectedProducts
        .map(p => `${p.productId}:${p.productProviderId || ''}`)
        .sort()
        .join('|'),
    [selectedProducts]
  )

  const selectedProductsMap = useMemo(
    () => new Map(selectedProducts.map((product: TemporaryProduct) => [product.productId, product])),
    [selectedProducts]
  )

  const allBlueprints: IBlueprintWithAdvanceInfo[] = cachedData?.allBlueprints || []
  const allBrands = [...new Set(allBlueprints.map(blueprint => blueprint.brand).sort())]

  const getBlueprintsFormatted = async (blueprints: IBlueprintWithAdvanceInfo[], from: number) => {
    const slicedBlueprints
      = selectedProducts.length > 0
        ? blueprints.filter(blueprint => selectedProductsMap.has(blueprint.id.toString()))
        : blueprints.slice(from, from + itemsPerLoad)

    const blueprintsWithSelectedProducts = await Promise.all(
      slicedBlueprints.map(async (blueprint: IBlueprintWithAdvanceInfo & any) => {
        const blueprintId = blueprint.id.toString()
        const selectedProductData = selectedProductsMap.get(blueprintId)

        return {
          ...blueprint,
          ...(selectedProductData || {}),
        }
      })
    )

    return blueprintsWithSelectedProducts.sort((a, b) => {
      try {
        const aUpdatedAt = new Date(a.updatedAt).getTime()
        const bUpdatedAt = new Date(b.updatedAt).getTime()

        return bUpdatedAt - aUpdatedAt
      } catch (error) {
        return 0
      }
    })
  }

  const initData = async () => {
    setIsFetching(true)

    if (cachedData === undefined) {
      const { blueprintsList: fetchedBlueprints } = (await fetchPrintifyBlueprints(providerId)) || {
        blueprintsList: [],
      }
      const filteredBlueprints = applyFilter(fetchedBlueprints)
      const initialBlueprints = await getBlueprintsFormatted(filteredBlueprints, 0)
      setBlueprints(initialBlueprints)

      remixQueryClient.setQueryData(cachedKey, { providerId, allBlueprints: fetchedBlueprints })
    } else {
      const filteredBlueprints = applyFilter(allBlueprints)

      setBlueprints(filteredBlueprints.slice(0, itemsPerLoad))
    }

    setIsFetching(false)
  }

  const applyFilter = (allBlueprints: IBlueprintWithAdvanceInfo[]) => {
    const lowerCaseQuery = queryString.toLowerCase()
    const filteredByProductIds = (blueprint: IBlueprintWithAdvanceInfo) => {
      const product = selectedProductsMap.get(blueprint.id.toString())
      return selectedProducts.length > 0 ? !!product : true
    }

    const filteredByQueryString = (blueprint: IBlueprintWithAdvanceInfo) =>
      blueprint.title.toLowerCase().includes(lowerCaseQuery)
      && (brandSelected.length > 0 ? brandSelected.includes(blueprint.brand) : true)

    return allBlueprints.filter(blueprint => {
      return filteredByProductIds(blueprint) && filteredByQueryString(blueprint)
    })
  }

  const fetchNextPage = async () => {
    setIsFetchNextPage(true)
    const filteredBlueprints = applyFilter(allBlueprints)
    const nextPageBlueprints = await getBlueprintsFormatted(filteredBlueprints, blueprints.length)

    setBlueprints(prev => unionBy([...prev, ...nextPageBlueprints], 'id'))
    setIsFetchNextPage(false)
  }

  const filterData = async () => {
    setIsSearching(true)
    const filteredBlueprints = applyFilter(allBlueprints)
    const nextBlueprints = await getBlueprintsFormatted(filteredBlueprints, 0)

    setIsSearching(false)
    setBlueprints(nextBlueprints)
  }

  useEffect(() => {
    initData()
  }, [])

  // Re-format blueprints when selectedProducts change (e.g., after confirming Printify Choice)
  // Use hash for stable comparison to avoid unnecessary re-formats
  useEffect(() => {
    const reformatBlueprints = async () => {
      // Only reformat if we have cached data and selected products
      if (allBlueprints.length > 0 && selectedProducts.length > 0 && !isFetching) {
        const filteredBlueprints = applyFilter(allBlueprints)
        const reformattedBlueprints = await getBlueprintsFormatted(filteredBlueprints, 0)
        setBlueprints(reformattedBlueprints)
      }
    }
    reformatBlueprints()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductsHash])

  useEffect(() => {
    filterData()
  }, [queryString, JSON.stringify(brandSelected.sort())])

  return {
    isFetching,
    isSearching,
    blueprints,
    allBrands,
    allBlueprints,
    isFetchNextPage,
    fetchNextPage,
    filterData,
  }
}
