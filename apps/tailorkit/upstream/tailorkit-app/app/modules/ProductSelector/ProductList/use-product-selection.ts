import { useState, useCallback, useRef } from 'react'
import { getProductId } from '../fns'

export interface SelectorVariant {
  id: number | string
  title: string
  price?: string
  compareAtPrice?: string | null
  integrated?: boolean
  product?: {
    id: number | string
    title?: string
    featuredImage?: { url: string } | null
    variants?: SelectorVariant[]
  }
}

export interface SelectorProduct {
  id?: number | string
  title?: string
  featuredImage?: { url: string } | null
  variants?: SelectorVariant[]
  integrated?: boolean
  source?: string
  hasOnlyDefaultVariant?: boolean
  description?: string
  [key: string]: unknown
}

export interface ProductCategory {
  id: string
  name: string
}

interface UseProductSelectionOptions {
  multiple: boolean
  singleVariantSelection: boolean
  allowIntegratedProducts: boolean
  initialSelectedProductIds: (number | string)[]
  initialSelectedVariantIds: (number | string)[]
  onProductSelectionChange?: (products: SelectorProduct[]) => void
  onVariantSelectionChange?: (variants: SelectorVariant[]) => void
}

/**
 * Manages product and variant selection state + handlers for ProductList.
 * Extracted to keep ProductList under the 600-line limit.
 */
export function useProductSelection({
  multiple,
  singleVariantSelection,
  allowIntegratedProducts,
  initialSelectedProductIds,
  initialSelectedVariantIds,
  onProductSelectionChange,
  onVariantSelectionChange,
}: UseProductSelectionOptions) {
  const [selectedProducts, setSelectedProducts] = useState<(number | string)[]>(initialSelectedProductIds)
  const [selectedVariants, setSelectedVariants] = useState<(number | string)[]>(initialSelectedVariantIds)
  const allProductsMapRef = useRef<Map<number | string, SelectorProduct>>(new Map())

  const upsertProductsToMap = useCallback((items: SelectorProduct[]) => {
    items.forEach(p => {
      // getProductId expects ProductData; SelectorProduct is structurally compatible for id/blueprintId lookup
      const id = getProductId(p as Parameters<typeof getProductId>[0])
      allProductsMapRef.current.set(id, p)
      ;(p?.variants || []).forEach((v: SelectorVariant) => {
        if (!v.product) {
          v.product = { id, title: p?.title, featuredImage: p?.featuredImage }
        }
      })
    })
  }, [])

  const handleProductSelection = useCallback(
    (productId: number | string, checked: boolean) => {
      // Calculate new product selection
      const newProductSelection = multiple
        ? checked
          ? [...selectedProducts, productId]
          : selectedProducts.filter(id => id !== productId)
        : [productId]
      const dedupedProductSelection = Array.from(new Set(newProductSelection.filter(Boolean)))

      // Calculate new variant selection
      const product = allProductsMapRef.current.get(productId)
      const availableVariants
        = product?.variants?.filter((v: SelectorVariant) => allowIntegratedProducts || !v.integrated) || []

      let newVariantSelection: (number | string)[]
      if (multiple) {
        newVariantSelection = checked
          ? [...selectedVariants, ...availableVariants.map((item: SelectorVariant) => item.id)]
          : selectedVariants.filter(id => !product?.variants?.find((v: SelectorVariant) => v.id === id))
      } else if (singleVariantSelection) {
        const firstVariant = availableVariants[0]
        newVariantSelection = firstVariant ? [firstVariant.id] : []
      } else {
        newVariantSelection = availableVariants.map((item: SelectorVariant) => item.id)
      }
      const dedupedVariantSelection = Array.from(new Set(newVariantSelection.filter(Boolean)))

      // Update local state first
      setSelectedProducts(dedupedProductSelection)
      setSelectedVariants(dedupedVariantSelection)

      // Notify parent on next tick to avoid setState during render
      queueMicrotask(() => {
        const mappedProducts = dedupedProductSelection
          .map(id => allProductsMapRef.current.get(id))
          .filter(Boolean) as SelectorProduct[]
        const mappedVariants = dedupedVariantSelection
          .map((id: number | string) => {
            for (const product of allProductsMapRef.current.values()) {
              const variant = product?.variants?.find((v: SelectorVariant) => v.id === id && !v.integrated)
              if (variant) {
                return variant.product ? variant : { ...variant, product }
              }
            }
            return null
          })
          .filter(Boolean) as SelectorVariant[]

        onProductSelectionChange?.(mappedProducts)
        onVariantSelectionChange?.(mappedVariants)
      })
    },
    [
      multiple,
      singleVariantSelection,
      allowIntegratedProducts,
      onProductSelectionChange,
      onVariantSelectionChange,
      selectedProducts,
      selectedVariants,
    ]
  )

  const handleVariantSelection = useCallback(
    (variantIds: (number | string)[], checked: boolean) => {
      // Filter valid variant IDs
      const _variantIds = variantIds.filter(id => {
        const product = Array.from(allProductsMapRef.current.values()).find((p: SelectorProduct) =>
          p.variants?.find((v: SelectorVariant) => v.id === id && (allowIntegratedProducts || !v.integrated))
        )
        return product ? product.variants?.find((v: SelectorVariant) => v.id === id) : false
      })

      // Calculate new variant selection
      let newVariantSelection: (number | string)[]
      if (singleVariantSelection) {
        newVariantSelection = checked ? _variantIds : []
      } else {
        newVariantSelection = checked
          ? [...selectedVariants, ..._variantIds]
          : selectedVariants.filter(id => !_variantIds.includes(id))
      }

      // Calculate new product selection
      const product = Array.from(allProductsMapRef.current.values()).find((p: SelectorProduct) =>
        p.variants?.some((v: SelectorVariant) => _variantIds.includes(v.id))
      )
      const newProductSelection = multiple
        ? checked
          ? [...selectedProducts, product?.id]
          : selectedProducts.filter(id => id !== product?.id)
        : [product?.id]
      const dedupedProductSelection = Array.from(new Set(newProductSelection.filter(Boolean))) as (number | string)[]
      const dedupedVariantSelection = Array.from(new Set(newVariantSelection.filter(Boolean)))

      // Update local state first
      setSelectedVariants(dedupedVariantSelection)
      setSelectedProducts(dedupedProductSelection)

      // Notify parent on next tick to avoid setState during render
      queueMicrotask(() => {
        const mappedVariants = dedupedVariantSelection
          .map(id => {
            for (const p of allProductsMapRef.current.values()) {
              const variant = p?.variants?.find((v: SelectorVariant) => v.id === id)
              if (variant) {
                // Embed sanitized variant options for downstream previews
                const sanitizedVariants = (p?.variants || []).map((v: SelectorVariant) => ({
                  id: v.id,
                  title: v.title,
                  price: v.price,
                  compareAtPrice: v.compareAtPrice,
                }))
                const productWithVariants = { ...p, variants: sanitizedVariants }
                return { ...variant, product: productWithVariants }
              }
            }
            return null
          })
          .filter(Boolean) as SelectorVariant[]
        onVariantSelectionChange?.(mappedVariants)
      })
    },
    [
      multiple,
      singleVariantSelection,
      allowIntegratedProducts,
      onVariantSelectionChange,
      selectedProducts,
      selectedVariants,
    ]
  )

  return {
    selectedProducts,
    setSelectedProducts,
    selectedVariants,
    setSelectedVariants,
    upsertProductsToMap,
    handleProductSelection,
    handleVariantSelection,
  }
}
