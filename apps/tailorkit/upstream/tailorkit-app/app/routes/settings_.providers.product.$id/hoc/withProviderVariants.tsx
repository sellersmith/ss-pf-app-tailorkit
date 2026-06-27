import { type ComponentType, memo } from 'react'
import type { ProviderDocument } from '~/models/Provider'
import enhanceVariantsDataWithPrintify from './enhanceVariantsDataWithPrintify'
import enhanceVariantsDataGeneric from './enhanceVariantsDataGeneric'
import type { TemporaryVariant } from '~/models/TemporaryFulfillmentProducts'
import { type IGroupProviderVariants } from '../components/VariantsConfig/hooks/usePrintifyVariants'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

export interface IProviderWithVariantsProps {
  blueprintId: string
  providerInfo: ProviderDocument
  capabilities?: ProviderCapabilities
  savedVariants: TemporaryVariant[]
  groupVariants: IGroupProviderVariants
  getVariantsSelected: (groupProviderVariants: IGroupProviderVariants) => TemporaryVariant[]
  isFetching: boolean
  printProviderSaved: string
}

const withProviderVariants = <P extends IProviderWithVariantsProps>(Component: ComponentType<P>) => {
  // Hoist enhanced components outside render to prevent re-creation every render
  const PrintifyEnhanced = enhanceVariantsDataWithPrintify(
    Component as ComponentType<Omit<P, 'groupVariants' | 'getVariantsSelected' | 'isFetching'>>
  )
  const GenericEnhanced = enhanceVariantsDataGeneric(
    Component as ComponentType<Omit<P, 'groupVariants' | 'getVariantsSelected' | 'isFetching'>>
  )

  return memo((props: Omit<P, 'groupVariants' | 'getVariantsSelected' | 'isFetching'>) => {
    const { capabilities } = props

    if (capabilities?.hasPrintProviderSelection) {
      return <PrintifyEnhanced {...props} />
    }

    if (capabilities?.hasVariantSelection) {
      return <GenericEnhanced {...props} />
    }

    // Default: pass-through for read-only providers (ShineOn, etc.)
    return <Component {...(props as P)} groupVariants={{}} getVariantsSelected={() => []} isFetching={false} />
  })
}

export default withProviderVariants
