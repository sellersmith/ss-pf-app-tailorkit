import type { TLayerIntegrationStore } from '../_external-types'
import type { Template } from './psd'
import type { VariantImage, IProductWithVariants } from './shopify-product'
import type { ViewPort } from './template'

export enum IntegrationStatus {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
  OUTDATED = 'outdated',
}

type Integration = {
  _id: string
  title: string
  variants: VariantIntegration[]
  publishedAt: Date | null
  viewport: ViewPort
  selectedTab: number
  config: {
    shouldNotShowModalConfirmPublishAgain: boolean
    shouldNotShowModalConfirmRePublishAgain: boolean
  }
  previewMode?: boolean
  allVariantsIntegrated?: any[]
  variantIdsPublished?: string[]
  hasUnpublishedChanges?: boolean
  lastSavedAt?: number | null
  /** Product image dimension mismatch alert — set by PRODUCTS_UPDATE webhook handler */
  dimensionAlert?: {
    detectedAt: string
    productImageDims: { width: number; height: number }
    setupImageDims: { width: number; height: number }
    productId: string
    mockupViewId: string
  } | null
}

type VariantIntegration = {
  _id: string
  productId: string
  id: string
  title?: string
  displayName?: string
  price?: string
  compareAtPrice?: string
  sku?: string
  product?: IProductWithVariants
  printAreas: PrintArea[]
  mockup: MockUp
  image?: VariantImage | null

  /** This props is serving for setting product is active if this is in DRAFT when publishing integration.
   * This props will be deleting after publishing integration and re-init if product is set to DRAFT again on Shopify
   */
  productActivated?: boolean
}

/**
 * Preview product image type matching TemplateEditor['previewProductImage']
 */
type PreviewProductImageType = {
  _id?: string
  src: string
  altText?: string
  left: number
  top: number
  width: number
  height: number
  rotation: number
  naturalWidth?: number
  naturalHeight?: number
  /** Controls visibility on canvas without removing the data */
  visible?: boolean
} | null

type PrintArea = {
  _id: string

  /** Identify which template will be printed on */
  name: string

  /** Template id is chosen for printed */
  template?: string | Template | null

  /**
   * Dimension of print area
   * These property exist for remaining the initial dimension of print area of imported product
   */
  width?: number
  height?: number

  /**
   * Preview product image for this print area.
   * Stored per print area (not in template) to prevent sharing between products using the same template.
   * Resolved from product/variant image or user-selected image.
   */
  previewProductImage?: PreviewProductImageType
}

type BaseImage = {
  url: string
  width: number
  height: number
  altText: string
}

type MockUp = {
  _id: string
  label: string
  variantLabel?: string
  storefrontLabel?: string
  baseImage?: BaseImage | null
  backgroundImage?: BaseImage | null
  enableClippingMask?: boolean
  layers: TLayerIntegrationStore[]
  createdAt?: Date | null
  updatedAt?: Date | null
  /** @deprecated */
  disintegratedAt?: Date | null
  // Frontend-only hydrated data for editor/renderer
  views?: MockupView[]
  selectedViewId?: string
  denormalizedData?: {
    variants: {
      _id: string
      productId: string
      id: string
    }[]
    templates: {
      _id: string
      name: string
    }[]
    integration: {
      _id: string
      name: string
    }
  }
  // Metadata for caching AI suggestions and future extensions
  // fontCombinationSuggestions is keyed by mockupId:productId (e.g., "mockup-123:product-456")
  // Canvas only renders with first variant, so all variants share the same cache
  metadata?: {
    fontCombinationSuggestions?: Record<
      string,
      {
        clipartIds: string[]
        generatedAt: number
        productId: string // Track productId for webhook invalidation
        variantHash: string // Track integrated variant set; invalidate cache when variant set changes
        reasoning?: string // Optional reasoning for why these suggestions were chosen
      }
    >
  }
}

type ViewLayerOverride = {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  visible?: boolean
  mask?: {
    x?: number
    y?: number
    width?: number
    height?: number
    rotation?: number
  }
}

// View data for saver and editor
type MockupView = {
  _id: string
  mockup: string
  title: string
  baseImage?: BaseImage | null
  backgroundImage?: BaseImage | null
  maskImage?: BaseImage | null
  enableClippingMask?: boolean
  layers: string[]
  overrides?: Record<string, ViewLayerOverride>
}

type LayerIntegration = {
  _id: string
  name: string
  /** Optional presentational view identifier (for multi-view mockups) */
  viewId?: string | null
  printAreaId: string | null
  layerId: string
  type: 'template' | 'image' | 'mask'
  width: number
  height: number
  x: number
  y: number
  rotation: number
  visible: boolean
  mask?: {
    width: number
    height: number
    x: number
    y: number
    rotation: number
  }
  data?: {
    src?: string
    alt?: string
    template?: Template | null
    metadata?: {
      mockedWith?: string
      duplicatedFrom?: string
      transparentRegions?: [{ top: number; left: number; right: number; bottom: number; width: number; height: number }]
    }
  }
}

type IntegrationListResult = {
  shopDomain: string
  _id: string
  title: string
  variants: string[]
  publishedAt: string
  createdAt: string
  updatedAt: string
  variantIntegration: (Omit<VariantIntegration, 'mockup'> & {
    mockup: string
  })[]
  status: IntegrationStatus
  mockupIntegration: (Omit<MockUp, 'updatedAt' | 'createdAt'> & {
    layersIntegration: LayerIntegration[]
    templatesIntegration: Template[]
    createdAtMockup: string
    updatedAtMockup: string
  })[]
}

type IntegrationDataSaver = {
  notInEditor?: boolean
  // Omit the variants for data saver
  integration: Omit<Integration, 'variants'> & { variants: string[] }

  printAreas: PrintArea[]

  // Omit the mockup, print areas, product data for data saver
  variants: (Omit<VariantIntegration, 'mockup' | 'productId' | 'printAreas'> & {
    mockup: string
    productId?: string
    printAreas: string[]
  })[]

  // Omit the layers, label,d isintegratedAt for data saver
  mockups: (Omit<MockUp, 'layers' | 'label'> & {
    layers: string[]
    label?: string
  })[]

  layers: LayerIntegration[]

  // Optional views payload for per-mockup presentational views
  mockupViews?: MockupView[]
}

type PrintAreaPlaceholder = {
  _id: string
  width: number
  height: number
  position: string
}

type ImportedProductMetaFieldValue = {
  product_id: string
  provider_id: string
  variant_id: string
  placeholders: PrintAreaPlaceholder[]
}

type ImportedProductMetaField = {
  id: string
  key: string
  namespace: string
  type: string
  value: string | ImportedProductMetaFieldValue
}

type TemporaryProductData = {
  id: string
  createdAt: number

  dummyProduct: {
    title: string
    description: string
    imageUrl: string
    clipartId?: string
  }

  templateId: string

  variant: {
    id: string
    title: string
    price: string
    product: {
      id: string
      title: string
      description: string
      featuredImage?: {
        url: string
        width: number
        height: number
      }
    }
  }

  printArea?: {
    _id: string
    name: string
    position: string
    width: number
    height: number
  }
}

export type {
  Integration,
  LayerIntegration,
  MockUp,
  MockupView,
  VariantIntegration,
  PrintArea,
  IntegrationDataSaver,
  BaseImage,
  IntegrationListResult,
  PrintAreaPlaceholder,
  ImportedProductMetaField,
  ImportedProductMetaFieldValue,
  ViewLayerOverride,
  TemporaryProductData,
}
