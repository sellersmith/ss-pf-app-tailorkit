import type { Money } from '../constants/shopify'

type NodeMedia = {
  originalSrc: string
  width: string
  height: string
}

type ProductMedia = {
  id: string
  altText: string
  width: number
  height: number
  originalSrc: string
}

type VariantImage = {
  id: string
  altText: string
  url: string
  width: number
  height: number
}

export type MetafieldPlaceholder = {
  position: string
  width: number
  height: number
  _id: string
}

export type MetafieldValue = {
  product_id: string
  provider_id: string
  variant_id: string
  placeholders: MetafieldPlaceholder[]
}

type NodeMetafield = {
  id: string
  key: string
  namespace: string
  type: 'json'
  value: string // Contains stringified MetafieldValue
}

type Metafield = {
  nodes: NodeMetafield[]
}

export enum EProductStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
  UNLISTED = 'UNLISTED',
}

type IPageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  endCursor?: string | null | undefined
  startCursor?: string | null | undefined
  page?: number
}

type IProduct = {
  handle: string
  featuredImage: {
    altText: string
    width: number
    height: number
    url: string
  }
  title: string
  id: string
  description?: string
  status?: EProductStatus
  publishedAt?: any
  hasOnlyDefaultVariant?: boolean
  totalVariants?: number
  variants: { nodes: Array<{ title: string; id: string; price: string; compareAtPrice: string; displayName: string }> }
  isDeleted?: boolean
  collections: string[]
  tags: string[]
  vendor: string
  productType: string
}

type IVariant = {
  id: string
  title: string
  displayName: string
  product: IProduct
  price: Money
  compareAtPrice: Money
  sku: string
  image?: VariantImage
  metafields: Metafield
  totalPrintArea?: number
  hasLargestDimension?: boolean
}

type IProductWithVariants = Omit<IProduct, 'variants'> & { variants: IVariant[] }

type IVariantsLoader = {
  variants: {
    nodes: IVariant[]
    pageInfo: IPageInfo
  }
}

export type {
  NodeMedia,
  ProductMedia,
  IVariantsLoader,
  IProduct,
  IVariant,
  IProductWithVariants,
  IPageInfo,
  VariantImage,
}
