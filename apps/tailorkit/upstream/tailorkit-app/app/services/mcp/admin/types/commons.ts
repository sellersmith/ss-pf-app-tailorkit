interface IReadCollectionDataArgs {
  collection: string
  shopDomain: string
  filters: Record<string, any>
  fields?: Record<string, any>
  options?: {
    limit?: number
    skip?: number
    sort?: Record<string, any>
    populate?: string[]
  }
}

export type { IReadCollectionDataArgs }
