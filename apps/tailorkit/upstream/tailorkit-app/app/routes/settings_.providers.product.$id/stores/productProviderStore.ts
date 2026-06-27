import { createStore } from '~/libs/external-store'
import type { TemporaryVariant, TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import { calculateFinalPrice, calculateProfitMargin } from '../components/VariantsConfig/fns'

type Trace = {
  skipTrace?: boolean
}

type Action =
  | { type: 'INIT_DATA'; payload: { state: any } }
  | { type: 'RESET_STATE'; payload: any }
  | { type: 'SET_PRODUCT_PROVIDER'; payload: { productProvider: string } }
  | { type: 'SET_PRODUCT_TITLE'; payload: { title: string } }
  | { type: 'SET_PRODUCT_DESCRIPTION'; payload: { description: string } }
  | { type: 'SET_VARIANTS'; payload: { variants: TemporaryVariant[] } }
  | { type: 'UPDATE_COST_VARIANT'; payload: { variantIds: string[]; cost: number } }
  | { type: 'UPDATE_PRICE_VARIANT'; payload: { variantIds: string[]; price: number } }
  | { type: 'UPDATE_PROFIT_MARGIN_VARIANT'; payload: { variantIds: string[]; profitMargin: number } }
  | { type: 'SET_SHINEON_MAPPING'; payload: { shineOnMapping: any } }

export const DEFAULT_PRODUCT_PROVIDER_STORE: TemporaryProduct = {
  shopDomain: '',
  providerId: '',
  productId: '',
  productProviderId: '',
  variants: [],
  baseProfitMargin: 0,
  description: '',
  title: '',
  images: [],
}

export const ProductProviderStore = createStore(productProviderReducer, DEFAULT_PRODUCT_PROVIDER_STORE)

function productProviderReducer(state: TemporaryProduct, action: Action & Trace) {
  switch (action.type) {
    case 'INIT_DATA': {
      const payload = action.payload

      return {
        ...state,
        ...payload.state,
      }
    }

    case 'SET_PRODUCT_PROVIDER': {
      const payload = action.payload

      return {
        ...state,
        productProviderId: payload.productProvider,
      }
    }

    case 'SET_PRODUCT_TITLE': {
      const payload = action.payload

      return {
        ...state,
        title: payload.title,
      }
    }

    case 'SET_PRODUCT_DESCRIPTION': {
      const payload = action.payload

      return {
        ...state,
        description: payload.description,
      }
    }

    case 'SET_VARIANTS': {
      const payload = action.payload

      return {
        ...state,
        variants: payload.variants,
      }
    }

    case 'UPDATE_COST_VARIANT': {
      const { variantIds, cost } = action.payload
      const { variants } = state
      const _variants = variants.map(variant => {
        const finalPrice = calculateFinalPrice(cost, variant.profitMargin || 0)
        return variantIds.includes(variant.id.toString()) ? { ...variant, cost, price: finalPrice } : variant
      })
      return {
        ...state,
        variants: _variants,
      }
    }

    case 'UPDATE_PRICE_VARIANT': {
      const { variantIds, price } = action.payload
      const { variants } = state
      const _variants = variants.map(variant => {
        const profitMargin = calculateProfitMargin(variant.cost || 0, price)
        return variantIds.includes(variant.id.toString()) ? { ...variant, profitMargin, price } : variant
      })

      return {
        ...state,
        variants: _variants,
      }
    }

    case 'UPDATE_PROFIT_MARGIN_VARIANT': {
      const { variantIds, profitMargin } = action.payload
      const { variants } = state
      const _variants = variants.map(variant => {
        const finalPrice = calculateFinalPrice(variant.cost || 0, profitMargin)
        return variantIds.includes(variant.id.toString()) ? { ...variant, profitMargin, price: finalPrice } : variant
      })
      return {
        ...state,
        variants: _variants,
      }
    }

    case 'SET_SHINEON_MAPPING': {
      return {
        ...state,
        shineOnMapping: action.payload.shineOnMapping,
      }
    }

    case 'RESET_STATE':
      return { ...DEFAULT_PRODUCT_PROVIDER_STORE }

    default:
      return state
  }
}
