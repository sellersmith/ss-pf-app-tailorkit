import { ALLOWED_FONT_EXTENSIONS } from '~/constants/dropzone'
import ShopifyFile, { ShopifyFileType } from '~/models/ShopifyFile.server'

const ITEMS_PER_LOAD = 25

/**
 * Query Shopify files by name with pagination support
 * @param queryValue - The search string to filter fonts
 * @param page - The page number (1-based) to fetch
 * @param shopifyFileType - The type of Shopify file to query
 * @returns Object containing Shopify files and pagination info
 */
export const queryShopifyFiles = async (
  queryValue: string,
  shopDomain: string,
  page: number = 1,
  fileType: ShopifyFileType.GENERIC_FILE | ShopifyFileType.MASK_IMAGE = ShopifyFileType.GENERIC_FILE
) => {
  const isQueryFont = fileType === ShopifyFileType.GENERIC_FILE
  const skip = (page - 1) * ITEMS_PER_LOAD

  // Build the query object
  const query = {
    // Check if file name ends with any of the font extensions
    name: {
      $regex: isQueryFont ? `(${ALLOWED_FONT_EXTENSIONS.join('|')})$` : '',
      $options: 'i',
    },
    shopDomain,
    type: fileType,
  }

  // Add name search if queryValue is not empty
  if (queryValue.trim()) {
    query.name = {
      $regex: `${queryValue}.*?(${isQueryFont ? ALLOWED_FONT_EXTENSIONS.join('|') : ''})$`,
      $options: 'i',
    }
  }

  const [files, total] = await Promise.all([
    ShopifyFile.find(query).sort({ createdAt: -1 }).skip(skip).limit(ITEMS_PER_LOAD).lean(),
    ShopifyFile.countDocuments(query),
  ])

  return {
    files,
    pageInfo: {
      hasNextPage: skip + files.length < total,
      total,
      currentPage: page,
    },
  }
}
