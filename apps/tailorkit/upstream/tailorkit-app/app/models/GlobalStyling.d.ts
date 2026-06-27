import type { GlobalStyling as GlobalStylingConfig } from '~/types/global-styling'

export interface GlobalStylingDocument {
  _id?: string
  shopDomain: string
  styling: GlobalStylingConfig
  createdAt?: Date | string
  updatedAt?: Date | string
}
