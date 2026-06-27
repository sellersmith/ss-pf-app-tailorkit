export interface ProviderDocument {
  _id: string
  name: string
  description: string
  detailsUrl: string
  logoUrl: string
  baseUrl: string
  status?: 'active' | 'inactive'
  recommended?: number
  createdAt: Date | string
  updatedAt: Date | string
}
