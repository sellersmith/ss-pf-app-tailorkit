import type { ReactNode } from 'react'

export interface ProductData {
  id?: string
  name?: string
  model?: string
  price?: string
  title?: string
  images?: any[]
  variants?: any[]
  providers?: any[]
  minPrice?: number
  maxPrice?: number
  min_price?: number
  max_price?: number
  selected?: boolean
  brandName?: string
  featuredImage?: any
  blueprintId?: number
  description?: string
  provider?: number | string
  printProviderCount?: number
  selectedOptions?: { [key: string]: string[] }
}

export interface RawVariantData {
  id: number
  title: string
  options: number[]
  costs?: { result: string }[]
  placeholders: {
    position: string
    width: number
    height: number
  }[]
}

export interface VariantData extends RawVariantData {
  cost?: number
  price?: number
  margin?: number
  profit?: number
  [key: string]: unknown
}

export interface ProductCardProps {
  source?: string
  product: Product
  multiple: boolean
  /** Allow selecting products that are already integrated (personalized). Default: false */
  allowIntegratedProducts?: boolean
  selectedProducts: (number | string)[]
  handleProductSelection: (productId: number | string, checked: boolean) => void
}

export interface ProductItemProps {
  source?: string
  product: Product
  multiple?: boolean
  selectable?: boolean
  showProductStatus?: boolean
  autoSelectAllVariants?: boolean
  hideVariants?: boolean
  singleVariantSelection?: boolean
  /** Allow selecting products/variants that are already integrated (personalized). Default: false */
  allowIntegratedProducts?: boolean
  selectedProducts?: (number | string)[]
  selectedVariants?: (number | string)[]
  getProductStatus?: (product: Product) => boolean
  handleProductSelection?: (productId: number | string, checked: boolean) => void
  handleVariantSelection?: (variantId: number | string, checked: boolean) => void
  actions?: {
    icon: any
    label: string
    onAction: () => void
  }[]
}

export interface ProductGridProps {
  source?: string
  multiple?: boolean
  /** Allow selecting products that are already integrated (personalized). Default: false */
  allowIntegratedProducts?: boolean
  onBack?: () => void
  onSelectionChange?: (selectedProducts: any[]) => void
  hasAutoSelectedCategory?: boolean
  setHasAutoSelectedCategory?: (value: boolean) => void
  description?: ReactNode
  initialSearchValue?: string
  /** Override the Scrollable maxHeight (e.g. '400px'). Default: 'calc(100vh - 277px)' */
  scrollableHeight?: string
  /** Extra content rendered inside the Filters bar (e.g. view toggle buttons) */
  headerActions?: ReactNode
  /** Increment to force a product list refresh */
  refreshKey?: number
  /** Auto-select the first selectable (non-integrated) product on load. Default: false */
  autoSelectFirst?: boolean
  /** When true, replaces infinite scroll with cursor-based Polaris Pagination. Default: false */
  paginationMode?: boolean
  /** Callback with pagination state for external rendering (e.g. in footer) */
  onPaginationChange?: (pagination: {
    hasNext: boolean
    hasPrevious: boolean
    onNext: () => void
    onPrevious: () => void
  }) => void
}

export interface IDummyProductsSuggestion {
  productTitle: string
  productCDNLink: string
  productDescription: string
  tailorkitClipart: string
}

export interface IDummyProductsData {
  priority: string
  clipartCategory: string
  products: IDummyProductsSuggestion[]
}

export interface ProductListProps {
  source?: string
  multiple?: boolean
  productId?: string
  initialSearchValue?: string
  dummyProductsSuggestion?: IDummyProductsSuggestion[]
  autoSelectAllVariants?: boolean
  hideVariants?: boolean
  singleVariantSelection?: boolean
  /** Allow selecting products/variants that are already integrated (personalized). Default: false */
  allowIntegratedProducts?: boolean
  /** Hide the built-in "Add product" button (when parent provides its own via headerActions). Default: false */
  hideAddProductButton?: boolean
  /** Hide the info banner. Default: false */
  hideBanner?: boolean
  /** Auto-select the first selectable (non-integrated) product on load. Default: false */
  autoSelectFirst?: boolean
  /** Initial selected product IDs to pre-check */
  initialSelectedProductIds?: (number | string)[]
  /** Initial selected variant IDs to pre-check */
  initialSelectedVariantIds?: (number | string)[]
  onBack?: () => void
  onProductSelectionChange?: (selectedProducts: any[]) => void
  onVariantSelectionChange?: (selectedVariants: any[]) => void
  /** Callback to open mockup editor with selected variants */
  onOpenMockupEditor?: (variants: any[]) => Promise<void>
  /** Clipart selection from showcase for auto-application */
  clipartSelection?: ClipartItem | null
  /** Callback to navigate back in modal */
  handleBack?: () => void
  /** Callback to close modal */
  handleClose?: () => void
  /** Override the Scrollable maxHeight (e.g. '400px'). Default: 'calc(100vh - 277px)' */
  scrollableHeight?: string
  /** Extra content rendered inside the Filters bar (e.g. view toggle buttons) */
  headerActions?: ReactNode
  /** Increment to force a product list refresh */
  refreshKey?: number
  /** When true, replaces infinite scroll with cursor-based Polaris Pagination. Default: false */
  paginationMode?: boolean
  /** Callback with pagination state for external rendering (e.g. in footer) */
  onPaginationChange?: (pagination: {
    hasNext: boolean
    hasPrevious: boolean
    onNext: () => void
    onPrevious: () => void
  }) => void
}

export interface ProductEditorProps {
  source?: string
  product: Product
  disabled?: boolean
  sourceName?: string
  autoSelectAllVariants?: boolean
  onBack?: () => void
  onEditProduct?: (selectedProducts: ProductData) => void
}

export interface ProviderSelectorProps {
  providers: any[]
  selected?: string
  disabled?: boolean
  onSelect: (provider: string) => void
}

export interface VariantProfitTableProps {
  disabled?: boolean
  variants: VariantData[]
  options: { [key: string]: string[] }
  onUpdateVariants?: (variants: any[]) => void
}

export interface PrintAreaTableProps {
  variants: VariantData[]
}

export interface ProductSelectorProps {
  open: boolean
  multiple?: boolean
  productId?: string
  initialSearchValue?: string
  defaultSource?: string
  clipartSelection?: any
  autoSelectAllVariants?: boolean
  hideVariants?: boolean
  singleVariantSelection?: boolean
  /** Allow selecting products/variants that are already integrated (personalized). Default: false */
  allowIntegratedProducts?: boolean
  nonExistingProductData?: ProductData
  /** Hide the "Duplicate product" checkbox in footer. Default: true */
  showDuplicateOption?: boolean
  /** Embed full product object in each variant for callback. Default: false */
  embedProductInVariants?: boolean
  /** Initial selected product IDs to pre-check when modal opens */
  initialSelectedProductIds?: (number | string)[]
  /** Initial selected variant IDs to pre-check when modal opens */
  initialSelectedVariantIds?: (number | string)[]
  onClose: () => void
  onSelect: (products: any[], variants: any[]) => void | Promise<void>
  onClearModalData?: () => void
}
