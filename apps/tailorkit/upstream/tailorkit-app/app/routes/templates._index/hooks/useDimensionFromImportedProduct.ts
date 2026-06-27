import { type OptionListProps } from '@shopify/polaris'
import { useCallback, useEffect, useState } from 'react'
import { getVariantMetafields } from '~/modules/ProductEditor/utilities/getVariantMetafields'
import type { PrintAreaPlaceholder, ImportedProductMetaFieldValue } from '~/types/integration'

export const useDimensionFromImportedProduct = (props: { variantId: string }) => {
  const { variantId } = props

  const [loading, setLoading] = useState(false)
  const [dimensions, setDimensions] = useState<{
    dimensionsList: ImportedProductMetaFieldValue['placeholders']
    options: OptionListProps['options']
  }>({ dimensionsList: [], options: [] })

  const getDimensionLabel = useCallback((placeholder?: Omit<PrintAreaPlaceholder, '_id'>) => {
    if (placeholder) {
      const { position, width, height } = placeholder
      return `${position}: ${width} x ${height} px`
    }
    return ''
  }, [])

  const fetchDimensionsFromVariantIds = useCallback(async () => {
    if (!variantId) return

    try {
      setLoading(true)
      const groupVariantMetafields = await getVariantMetafields({ variantIds: [variantId] })
      const metafield = groupVariantMetafields?.[variantId]
      const hasMetafields = metafield?.type === 'json'

      if (hasMetafields) {
        const metafieldValue = metafield?.value
        const parsedValue = typeof metafieldValue === 'string' ? JSON.parse(metafieldValue) : metafieldValue
        const placeholders = (parsedValue['placeholders'] || []) as ImportedProductMetaFieldValue['placeholders']
        const dimensionOptions = placeholders.map(placeholder => ({
          label: getDimensionLabel(placeholder),
          value: placeholder.position,
        }))

        setDimensions({
          dimensionsList: placeholders,
          options: dimensionOptions,
        })
      }
    } catch (error) {
      console.error('Error fetching dimensions:', error)
    } finally {
      setLoading(false)
    }
  }, [getDimensionLabel, variantId])

  useEffect(() => {
    fetchDimensionsFromVariantIds()
  }, [fetchDimensionsFromVariantIds])

  return {
    loading,
    dimensions,
    getDimensionLabel,
  }
}
