export interface ProviderIntegrationDocument {
  _id: string
  shopDomain: string
  apiToken: string
  shopId: string
  autoFulfill: boolean
  providerId: string
  connectionStatus?: 'connected' | 'disconnected'
  createdAt: Date | string
  updatedAt: Date | string
}
