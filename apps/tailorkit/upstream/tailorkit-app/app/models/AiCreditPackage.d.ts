export interface AiCreditPackageDocument {
  _id: string
  packageId: string // Stable unique identifier (e.g., 'starter', 'small', 'popular')
  name: string
  credits: number
  price: number
  status: 'active' | 'inactive'
  popular?: boolean
  displayOrder: number
  description?: string
  createdAt: Date | string
  updatedAt: Date | string
}
