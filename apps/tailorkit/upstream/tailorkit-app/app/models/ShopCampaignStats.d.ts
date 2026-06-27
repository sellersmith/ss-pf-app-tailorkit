export interface ShopCampaignStatsDocument {
  _id: string
  shopDomain: string
  campaignId: string
  currentPublishedCount: number // Current count (decreases on unpublish)
  peakPublishedCount: number // Peak count (never decreases, for persistent badges)
  firstPublishedAt?: Date
  lastPublishedAt?: Date
  createdAt: Date
  updatedAt: Date
}
