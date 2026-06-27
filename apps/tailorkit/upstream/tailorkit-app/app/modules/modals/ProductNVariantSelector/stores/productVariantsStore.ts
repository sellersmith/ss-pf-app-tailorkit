import { createStore } from '~/libs/external-store'
import type { IProductWithVariants, IVariant } from '~/types/shopify-product'

/**
 * Interface for the product variants state
 */
interface IShopifyProductsState {
  [key: string]: IProductWithVariants & { isLoading: boolean; isExpanded: boolean }
}

/**
 * Interface for the actions that can be performed on the product variants state
 */
type ShopifyProductsAction =
  | { type: 'INITIALIZE_PRODUCT'; payload: { product: IProductWithVariants } }
  | { type: 'SET_PRODUCT_VARIANTS'; payload: { productId: string; variants: IVariant[] } }
  | { type: 'SET_LOADING_PRODUCT'; payload: { productId: string; isLoading: boolean } }
  | { type: 'SET_EXPANDED_PRODUCT'; payload: { productId: string; isExpanded: boolean } }
  | { type: 'RESET' }

/**
 * Initial state for the product variants state
 */
const initialState: IShopifyProductsState = {}

/**
 * Reducer function for the product variants state
 */
function ShopifyProductsReducer(state: IShopifyProductsState, action: ShopifyProductsAction): IShopifyProductsState {
  switch (action.type) {
    case 'INITIALIZE_PRODUCT': {
      const { product } = action.payload

      if (product.id) {
        const existingProduct = state[product.id] || { isLoading: false, isExpanded: false }
        const updatedProduct = { ...existingProduct, ...product }

        return {
          ...state,
          [product.id]: updatedProduct,
        }
      }

      return state
    }
    case 'SET_PRODUCT_VARIANTS': {
      const { productId, variants = [] } = action.payload

      return {
        ...state,
        [productId]: {
          ...state[productId],
          variants: variants.map(variant => ({ ...variant, product: state[productId] }) as any),
        },
      }
    }
    case 'SET_LOADING_PRODUCT': {
      const { productId, isLoading } = action.payload
      return {
        ...state,
        [productId]: { ...state[productId], isLoading },
      }
    }
    case 'SET_EXPANDED_PRODUCT': {
      const { productId, isExpanded } = action.payload
      return {
        ...state,
        [productId]: { ...state[productId], isExpanded },
      }
    }
    case 'RESET': {
      return initialState
    }
    default:
      return state
  }
}

/**
 * Store for the product variants state
 */
export const shopifyProductsStore = createStore(ShopifyProductsReducer, initialState)

/**
 * Actions for the product variants state
 */
export const shopifyProductsActions = {
  initializeProduct: (product: IProductWithVariants) => {
    shopifyProductsStore.dispatch({
      type: 'INITIALIZE_PRODUCT',
      payload: { product },
    })
  },
  setProductVariants: (productId: string, variants: IVariant[]) => {
    shopifyProductsStore.dispatch({
      type: 'SET_PRODUCT_VARIANTS',
      payload: { productId, variants },
    })
  },
  setLoadingProduct: (productId: string, isLoading: boolean) => {
    shopifyProductsStore.dispatch({
      type: 'SET_LOADING_PRODUCT',
      payload: { productId, isLoading },
    })
  },
  setExpandedProduct: (productId: string, isExpanded: boolean) => {
    shopifyProductsStore.dispatch({
      type: 'SET_EXPANDED_PRODUCT',
      payload: { productId, isExpanded },
    })
  },
  reset: () => {
    shopifyProductsStore.dispatch({ type: 'RESET' })
  },
}
