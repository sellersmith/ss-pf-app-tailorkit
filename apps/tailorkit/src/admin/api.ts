import type { AdminAppHost } from '../../../../web/core/src/app-platform/admin'
import type {
  TailorKitCreateIntegrationInput,
  TailorKitIntegrationRecord,
  TailorKitIntegrationStatus,
  TailorKitUpdateIntegrationInput,
} from '../domain/product-personalizer'
import type { TailorKitProductEditorSaveRequest } from '../domain/product-editor-save-payload'
import type { TailorKitProductEditorLoaderData } from '../domain/product-editor-loader-adapter'
import type { TailorKitRouteHostReadiness } from '../domain/product-personalizer-route-host-readiness'

export interface TailorKitProductOption {
  id: string
  title: string
  handle?: string
  imageUrl?: string
  variants?: Array<{ id: string; title: string; price?: string; compareAtPrice?: string }>
}

export interface TailorKitVariantOption {
  id: string
  title: string
  productId: string
  productTitle: string
  productHandle?: string
  imageUrl?: string
  price?: string
  compareAtPrice?: string
}

export interface TailorKitListResponse {
  success: true
  items: TailorKitIntegrationRecord[]
  nextCursor?: string
}

export interface TailorKitMutationResponse {
  success: boolean
  item?: TailorKitIntegrationRecord
  editorLoader?: TailorKitProductEditorLoaderData
  message?: string
}

export interface TailorKitProductOptionsResponse {
  success: true
  products: TailorKitProductOption[]
  variants: TailorKitVariantOption[]
}

export interface TailorKitThemeConfig {
  isOS2Theme: boolean
  productThemeLink: string
  enabledAppEmbed: boolean
  enabledAppBlock: boolean
  themeEditCodeLink: string
  appEmbedLink: string
  customizerLink: string
}

export interface TailorKitThemeConfigResponse {
  success: true
  appConfig: TailorKitThemeConfig
}

export interface TailorKitStatusResponse {
  appId: 'tailorkit'
  status: 'copy-first-recovery'
  routeHostReadiness: TailorKitRouteHostReadiness
}

export type TailorKitAdminSaveRequest = TailorKitUpdateIntegrationInput | TailorKitProductEditorSaveRequest

export function createTailorKitAdminApi(host: AdminAppHost) {
  return {
    async loadStatus() {
      return host.api.get<TailorKitStatusResponse>('/status')
    },
    async loadThemeConfig() {
      return host.api.get<TailorKitThemeConfigResponse>('/theme-config')
    },
    async loadProducts(query?: string) {
      const keyword = query?.trim()
      const path = keyword ? `/product-options?q=${encodeURIComponent(keyword)}` : '/product-options'
      return host.api.get<TailorKitProductOptionsResponse>(path)
    },
    async loadPersonalizedProducts(query?: string, status?: TailorKitIntegrationStatus | 'all', cursor?: string) {
      const keyword = query?.trim()
      const params = new URLSearchParams()
      if (keyword) params.set('q', keyword)
      if (status && status !== 'all') params.set('status', status)
      if (cursor) params.set('cursor', cursor)
      const search = params.toString()
      const path = search ? `/personalized-products?${search}` : '/personalized-products'
      return host.api.get<TailorKitListResponse>(path)
    },
    async createPersonalizedProduct(input: TailorKitCreateIntegrationInput) {
      return host.api.post<TailorKitMutationResponse>('/personalized-products', input)
    },
    async loadPersonalizedProductDetail(id: string, search?: string) {
      const query = search?.replace(/^\?/, '').trim()
      const path = query ? `/personalized-products/${id}?${query}` : `/personalized-products/${id}`
      return host.api.get<TailorKitMutationResponse>(path)
    },
    async loadPersonalizedProduct(id: string, search?: string) {
      const query = search?.replace(/^\?/, '').trim()
      const path = query ? `/personalized-products/${id}?${query}` : `/personalized-products/${id}`
      const response = await host.api.get<TailorKitMutationResponse>(path)
      return response.item || null
    },
    async savePersonalizedProduct(id: string, input: TailorKitAdminSaveRequest) {
      return host.api.put<TailorKitMutationResponse>(`/personalized-products/${id}`, input)
    },
    async publishPersonalizedProduct(id: string) {
      return host.api.post<TailorKitMutationResponse>(`/personalized-products/${id}/publish`)
    },
    async unpublishPersonalizedProduct(id: string) {
      return host.api.post<TailorKitMutationResponse>(`/personalized-products/${id}/unpublish`)
    },
  }
}
