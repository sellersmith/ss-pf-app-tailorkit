// Utilities for converting data to CSV format
// Only dependency-free string conversion to keep bundle small

// Escape field for CSV: wrap in double quotes and escape existing quotes
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''

  // Convert objects/arrays to JSON string for safety
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

// Safely resolve nested value from object using dot notation path. Falls back to direct property access when path contains dots but exists literally.
function resolvePath(obj: Record<string, any>, path: string): unknown {
  if (!obj) return undefined

  // If the exact key exists (supports flattened objects with dots in key names)
  if (Object.prototype.hasOwnProperty.call(obj, path)) {
    return (obj as any)[path]
  }

  // Walk the object tree for nested paths
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined) return undefined
    // Cast to any to allow dynamic access
    return (acc as any)[segment]
  }, obj)
}

export interface ExportOrderRecord {
  id: number
  name: string
  order_number: number
  created_at: string

  // Customer
  email: string
  phone: string
  'shipping_address.first_name': string
  'shipping_address.last_name': string
  'shipping_address.country_code': string
  'shipping_address.city': string
  'shipping_address.province': string
  'shipping_address.zip': string
  'shipping_address.address1': string
  'shipping_address.address2': string

  // Line-item level (duplicated across variants)
  product_sku?: string
  product_name?: string
  variant_id?: number
  quantity?: number
  print_provider_id?: string
  print_area?: string
  design_file_url?: string
  shipping_method?: string

  // Financial
  appGeneratedRevenue?: number
  total_price: number | string
  currency: string

  financial_status: string
  fulfillment_status: string
  displayFulfillmentStatus?: string
}

// Default column header mapping (key order defines column order)
export const ORDER_CSV_COLUMNS: { key: keyof ExportOrderRecord; label: string }[] = [
  { key: 'id', label: 'Order ID' },
  { key: 'name', label: 'Order name' },
  { key: 'product_sku', label: 'Product SKU' },
  { key: 'product_name', label: 'Product name' },
  { key: 'variant_id', label: 'Variant ID' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'print_provider_id', label: 'Print provider ID' },
  { key: 'print_area', label: 'Print area' },
  { key: 'design_file_url', label: 'Design file URL' },
  { key: 'created_at', label: 'Date created' },
  { key: 'shipping_method', label: 'Shipping method' },
  { key: 'email', label: 'Customer email' },
  { key: 'shipping_address.first_name', label: 'First name' },
  { key: 'shipping_address.last_name', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'shipping_address.country_code', label: 'Country code' },
  { key: 'shipping_address.address1', label: 'Shipping address 1' },
  { key: 'shipping_address.address2', label: 'Shipping address 2' },
  { key: 'shipping_address.city', label: 'City' },
  { key: 'shipping_address.province', label: 'State/Region' },
  { key: 'shipping_address.zip', label: 'Postal code' },
  { key: 'currency', label: 'Currency' },
  { key: 'appGeneratedRevenue', label: 'App-generated revenue' },
  { key: 'total_price', label: 'Total' },
  // { key: 'displayFulfillmentStatus', label: 'Order status' },
  { key: 'financial_status', label: 'Financial status' },
  { key: 'fulfillment_status', label: 'Fulfillment status' },
]

/**
 * Convert array of orders to CSV string.
 * Only the fields defined in ORDER_CSV_COLUMNS are exported.
 */
export function ordersToCsv(
  records: ExportOrderRecord[],
  columns: (keyof ExportOrderRecord)[] = ORDER_CSV_COLUMNS.map(c => c.key)
): string {
  const selectedColumns = ORDER_CSV_COLUMNS.filter(col => columns.includes(col.key))

  const header = selectedColumns.map(col => col.label).join(',')
  const rows = records.map(rec =>
    selectedColumns
      .map(col => {
        const value = resolvePath(rec as unknown as Record<string, any>, col.key as string)
        return escapeCsvField(value)
      })
      .join(',')
  )

  return [header, ...rows].join('\n')
}
