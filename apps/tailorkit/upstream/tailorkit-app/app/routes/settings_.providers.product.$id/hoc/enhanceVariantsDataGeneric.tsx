import { useCallback, useEffect, useMemo, type ComponentType } from 'react'
import type { TemporaryVariant } from '~/models/TemporaryFulfillmentProducts'
import type { ProviderDocument } from '~/models/Provider'
import { type IGroupProviderVariants } from '../components/VariantsConfig/hooks/usePrintifyVariants'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'
import { useStore } from '~/libs/external-store'
import { calculateFinalPrice } from '../components/VariantsConfig/fns'

export interface VariantsDataGenericProps {
  blueprintId: string
  providerInfo: ProviderDocument
  savedVariants: TemporaryVariant[]
  printProviderSaved: string
}

/**
 * Groups variants by their `options` keys (e.g., Color, Size).
 * Works for any provider that stores variants with options — no API fetch needed.
 */
function groupVariantsByOptions(
  variants: TemporaryVariant[],
  savedVariants: TemporaryVariant[]
): IGroupProviderVariants {
  const group: Record<string, Set<string>> = {}

  for (const variant of variants) {
    const options = variant.options || {}
    for (const [key, value] of Object.entries(options)) {
      if (!group[key]) {
        group[key] = new Set()
      }
      group[key].add(value as string)
    }
  }

  const result: IGroupProviderVariants = {}
  for (const [key, values] of Object.entries(group)) {
    result[key] = Array.from(values).map(value => {
      // Check if any saved variant includes this option value
      const isSelected
        = savedVariants.length === 0
        || savedVariants.some(sv => {
          const svOptions = sv.options || {}
          return svOptions[key] === value
        })
      return { [value]: isSelected }
    })
  }

  return result
}

/**
 * Generates variant combinations based on selected options in the group.
 * Filters existing variants to only include those matching all selected options.
 */
function getSelectedVariants(
  allVariants: TemporaryVariant[],
  groupVariants: IGroupProviderVariants,
  savedVariants: TemporaryVariant[],
  baseProfitMargin: number
): TemporaryVariant[] {
  // Build set of selected values per key
  const selectedOptions: Record<string, Set<string>> = {}
  for (const [key, options] of Object.entries(groupVariants)) {
    selectedOptions[key] = new Set(
      options
        .filter(opt => Object.values(opt)[0]) // only selected
        .map(opt => Object.keys(opt)[0])
    )
  }

  // Filter variants that match ALL selected options
  return allVariants
    .filter(variant => {
      const options = variant.options || {}
      return Object.entries(selectedOptions).every(([key, values]) => values.has(options[key] as string))
    })
    .map(variant => {
      // Merge with saved variant data if exists
      const saved = savedVariants.find(sv => sv.id === variant.id)
      const cost = saved?.cost || variant.cost || 0
      const price = saved?.price || variant.price || calculateFinalPrice(cost, baseProfitMargin)
      const profitMargin = saved?.profitMargin ?? baseProfitMargin

      return {
        ...variant,
        ...(saved || {}),
        cost,
        price,
        profitMargin,
        active: true,
      }
    })
}

/**
 * Generic variant enhancement HOC for providers without print provider selection.
 * Groups saved variants by their options keys and provides selection/deselection UI.
 * No API fetch — uses variants already stored in DB.
 */
const enhanceVariantsDataGeneric = <P extends VariantsDataGenericProps>(Component: ComponentType<P>) => {
  return (props: P) => {
    const { savedVariants } = props

    const baseProfitMargin = useStore(ProductProviderStore, state => state.baseProfitMargin) || 0

    // Always use savedVariants (immutable, complete list) for grouping and filtering.
    // The store's variants get overwritten by filtered selections — using them here
    // would cause deselected options to disappear from the UI entirely.
    const groupVariants = useMemo(() => groupVariantsByOptions(savedVariants, savedVariants), [savedVariants])

    const getVariantsSelected = useCallback(
      (groupVars: IGroupProviderVariants) => {
        return getSelectedVariants(savedVariants, groupVars, savedVariants, baseProfitMargin)
      },
      [savedVariants, baseProfitMargin]
    )

    // Initialize store with saved variants on mount
    useEffect(() => {
      if (savedVariants.length > 0) {
        ProductProviderStore.dispatch({
          type: 'SET_VARIANTS',
          payload: { variants: savedVariants },
        })
      }
    }, [savedVariants])

    return (
      <Component
        {...props}
        groupVariants={groupVariants}
        getVariantsSelected={getVariantsSelected}
        isFetching={false}
      />
    )
  }
}

export default enhanceVariantsDataGeneric
