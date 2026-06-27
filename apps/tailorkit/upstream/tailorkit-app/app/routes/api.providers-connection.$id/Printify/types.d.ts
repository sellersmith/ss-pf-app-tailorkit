export interface IPrintifyShop {
  id: number
  title: string
  sales_channel: string
}

export interface IPrintifyBlueprint {
  id: number
  title: string
  description: string
  brand: string
  model: string
  images: string[]
}

export interface IBlueprintWithAdvanceInfo extends IPrintifyBlueprint {
  advanceInfo?: any
  baseProfitMargin: number
  productProviderId?: string
  providerList?: {
    id: string
    title: string
  }[]
  providerDetails?: IPrintifyProvider
}

export interface IPrintifyPrintProvider {
  id: number
  title: string
  location: {
    address1: string
    address2: string | null
    city: string
    country: string
    region: string
    zip: string
    [key: string]: any
  }
  blueprints?: IPrintifyBlueprint[]
}

export interface IPrintifyPlaceholder {
  position: string
  width: number
  height: number
}

export interface IPrintifyVariant {
  id: number
  title: string
  options: {
    [key: string]: any
  }
  placeholders: IPrintifyPlaceholder[]
}

export interface IPrintifyProvider {
  id: number
  title: string
  location?: {
    country: string
  }
}
