export interface AssetDocument {
  _id: string
  name: string
  type: string
  alias?: string
  model?: string
  refId?: string
  metadata?: any
  width?: number
  height?: number
  tags?: string[]
  shopDomain: string
  previewUrl?: string
  numberOfUses?: number
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string
}
