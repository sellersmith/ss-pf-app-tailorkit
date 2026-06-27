import { INVALID_SHOP_ERROR } from '~/constants/errors'
import { DEFAULT_PRODUCT_AVAILABLE, EPROVIDER } from '~/constants/fulfillment-providers'
import { ONLINE_STORE } from '~/constants/shopify'
import { getShopData } from '~/models/Shop.server'
import type { TemporaryFulfillmentProductsDocument, TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import TemporaryFulfillmentProducts from '~/models/TemporaryFulfillmentProducts.server'
import TemporaryProductData from '~/models/TemporatyProductData'
import type Printify from '~/modules/Fulfillments/Printify'
import { appName } from '~/shopify/app.server'
import { getFulfillmentServiceName, subscribeTailorKitFulfillmentService } from '~/shopify/fns.server'
import { type ShopifyApiClient } from '~/shopify/graphql/api.server'
import { DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE } from '~/shopify/graphql/products/constants'
import type {
  ProductInputMutationSchema,
  ProductMediaInputSchema,
  ProductOptionsInputSchema,
  VariantInputSchema,
} from '~/shopify/graphql/types'
import { type IVariant } from '~/types/shopify-product'
import { getExchangeRatesToUSD } from '~/utils/exchange-rates'
import { formatPrintifyCurrency } from '~/utils/fulfillment-providers'
import { sleep } from '~/utils/sleep'
import { uuid } from '~/utils/uuid'
import { PRINTIFY_CHOICE_NAME_ID, type TProductToImport } from './constants'
import { getProviderOrNull } from '~/services/fulfillment/registry.server'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import type { RestResources } from '@shopify/shopify-api/rest/admin/2025-07'
import { chunkArray } from '~/utils/chunkArray'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { getProviderBluePrintVariants } from '../api.providers-product.$id/utilities/Printify/getProviderBlueprintVariants'
import { getAdvanceBlueprintsProvider } from '../api.providers-connection.$id/Printify/fns.server'
import { getShopifyRegionName, isValidShopifyCountryCode } from '~/utils/shopify'
import { REST_OF_WORLD_CODES } from '~/modules/Fulfillments/Printify/constants'
import { fetchProviderDetailsByProviderId } from '../api.providers-product.$id/utilities/Printify/getBlueprintProviders'
import type { IPrintifyProvider } from '../api.providers-connection.$id/Printify/types'

// Prepare variant data for Shopify
export const preparedVariantsDataToShopify = async (
  product: TemporaryProduct,
  shopDomain: string,
  vendor?: EPROVIDER
): Promise<VariantInputSchema[]> => {
  const { variants, productId, productProviderId } = product
  const shopData = await getShopData(shopDomain)

  if (!shopData) {
    throw new Error(INVALID_SHOP_ERROR)
  }

  const exchangeRates = await getExchangeRatesToUSD()
  const currencyShop = shopData?.shopConfig?.currency
  const currency = 'USD'

  return variants.map(variant => {
    const { options, cost, price, profitMargin, placeholders = [], id } = variant
    const exchangeRatePrice = 1 - profitMargin / 100
    let finalPrice = price || cost / (exchangeRatePrice || 1)
    let finalCost = cost

    if (exchangeRates && currency && currencyShop) {
      const exchangeRateCurrency = exchangeRates[currency].value
      const exchangeRateCurrencyShop = exchangeRates[currencyShop].value

      const exchangeRate = exchangeRateCurrencyShop / exchangeRateCurrency
      finalPrice = exchangeRate * finalPrice
      finalCost = exchangeRate * cost
    }

    const optionValues = Object.entries(options).map(([optionName, optionValue]) => ({
      name: optionValue,
      optionName,
    }))

    // Use adapter for provider-specific metafield, fallback to Printify format
    const adapter = vendor ? getProviderOrNull(vendor) : null
    let metafieldValue: Record<string, unknown>

    if (adapter?.prepareVariantMetafield) {
      metafieldValue = adapter.prepareVariantMetafield({
        productId,
        productProviderId: productProviderId || '',
        variant: { id: String(id), title: variant.title || '', options, placeholders },
      })
    } else {
      // Default: Printify-shaped metafield (backward compat)
      metafieldValue = {
        product_id: productId,
        provider_id: productProviderId,
        variant_id: id,
        placeholders,
      }
    }

    const metafields = [
      {
        namespace: DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE,
        key: `${id}`,
        value: JSON.stringify(metafieldValue),
        type: 'json',
      },
    ]

    // Create a SKU id for each variant,
    const sku = `tlk-${uuid().split('-')[0]}-${id}`

    return {
      optionValues,
      price: finalPrice,
      inventoryItem: {
        // Set tracked quantity to false because we don't know what exactly quantity of variant from fulfillment providers
        tracked: false,
        sku,
        cost: finalCost,
      },
      metafields,
    }
  })
}

// Prepare main product data for Shopify
export const preparedProductsDataToShopify = (
  product: TemporaryProduct,
  vendor: EPROVIDER = EPROVIDER.PRINTIFY
): ProductInputMutationSchema => {
  const { title, description, variants } = product
  const groupVariants = variants.reduce((acc: Record<string, Map<string, { name: string }>>, variant) => {
    const { options } = variant

    Object.entries(options).forEach(([vKey, vValue]) => {
      if (!acc[vKey]) {
        acc[vKey] = new Map()
      }
      // Use Map to store unique values by `name`
      acc[vKey].set(vValue, { name: vValue })
    })

    return acc
  }, {})

  const productOptions: ProductOptionsInputSchema[] = Object.entries(groupVariants).map(([vKey, vMap]) => ({
    name: vKey,
    values: Array.from(vMap.values()),
  }))

  return {
    title,
    descriptionHtml: description,
    vendor,
    status: 'DRAFT',
    productOptions,
  }
}

// Prepare media data (images) for Shopify
export const preparedMediaDataToShopify = (product: TemporaryProduct): ProductMediaInputSchema[] => {
  const { images } = product
  return images.map(imageSrc => ({
    mediaContentType: 'IMAGE',
    originalSource: imageSrc,
  }))
}

/**
 * Updates or creates temporary fulfillment products data for a specific shop and provider
 * @param {Object} args - The input parameters
 * @param {string} args.shopDomain - The shop's domain
 * @param {string} args.providerId - The provider's ID
 * @param {TemporaryFulfillmentProductsDocument['data']} args.data - The data to update
 * @returns {Promise<TemporaryFulfillmentProductsDocument | null>}
 */
export const setTemporaryFulfillmentProducts = async (args: {
  shopDomain: string
  providerId: string
  data: Omit<TemporaryFulfillmentProductsDocument['data'], 'products'> & { products?: string[] }
}): Promise<TemporaryFulfillmentProductsDocument | null> => {
  const { shopDomain, providerId, data } = args

  try {
    const updateData = Object.entries(data).reduce(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[`data.${key}`] = value
        }
        return acc
      },
      {} as Record<string, unknown>
    )

    const result = await TemporaryFulfillmentProducts.findOneAndUpdate(
      { shopDomain, providerId },
      { $set: updateData },
      { upsert: true, new: true }
    )

    return result?.toObject() ?? null
  } catch (error) {
    console.error('Failed to update temporary fulfillment products', error)
    return null
  }
}

// Import product data into a temporary database
export const importProductsToDataBase = async (shopDomain: string, providerId: string, data: any) => {
  try {
    const { products = [], ...restData } = data || {}
    const productIds = products.map((product: TProductToImport) => product.productId)

    const temporaryFulfillmentProductsData = await setTemporaryFulfillmentProducts({
      shopDomain,
      providerId,
      data: {
        ...restData,
        products: productIds,
      },
    })

    const {
      // .... ///
      confirmChoosePrintifyChoice = false,
      showUnderstandAboutProviderModal = true,
    } = temporaryFulfillmentProductsData?.data || {}

    const defaultData = {
      providerId,
      productProviderId: '',
      variants: [],
    }

    const importedData = await Promise.all(
      products.map(async (product: TProductToImport & { variants?: any[] }) => {
        const { productId, title, description, images, baseProfitMargin, variants: productVariants } = product
        const productData = await TemporaryProductData.findOneAndUpdate(
          { productId, shopDomain },
          {
            ...defaultData,
            description,
            title,
            images,
            baseProfitMargin,
            // Use product variants if provided (PrintWay), otherwise default to empty
            ...(productVariants?.length ? { variants: productVariants } : {}),
          },
          { upsert: true, new: true }
        )

        return productData
      })
    )

    return { importedData, showUnderstandAboutProviderModal, confirmChoosePrintifyChoice }
  } catch (err) {
    console.error('Failed to import products to data base', err)
    return { importedData: [], showUnderstandAboutProviderModal: true, confirmChoosePrintifyChoice: false }
  }
}

interface IImportProductToShopifyProps {
  formattedProducts: {
    productId: string
    productProviderId: string
    product: ProductInputMutationSchema
    media: ProductMediaInputSchema[]
    variants: VariantInputSchema[]
  }[]
  printify?: Printify
  api: ShopifyApiClient
  admin: AdminApiContext<RestResources>
  providerName: string
  shouldCreateDeliveryProfile?: boolean
}

/**
 * @author LongPC & KhanhNT
 * Imports a list of formatted products into Shopify from a provider.
 *
 * This function takes an array of formatted product data, retrieves necessary shipping profiles,
 * creates delivery profiles, adds the products to Shopify, publishes them, and associates them
 * with the appropriate delivery profile. It also handles error reporting for failed imports.
 *
 * @param {IImportProductToShopifyProps} props - An object containing:
 *  - formattedProducts: Array of products to import with their associated data (product, media, variants, ...).
 *  - printify: An instance of the Printify service used for retrieving shipping profiles.
 *  - api: An instance of Shopify API client for interacting with Shopify resources.
 *  - providerName: The name of the provider for the products being imported.
 *
 * @returns {Promise<{ productsImported: any[]; productsFailed: any[] }>}
 * A summary of the import operation including imported and failed products.
 */
export const importProductToShopify = async (args: IImportProductToShopifyProps) => {
  const { formattedProducts, printify, api, admin, providerName, shouldCreateDeliveryProfile = true } = args
  const productsImported: any[] = []
  const productsFailed: any[] = []

  const storePublications = await api.getStorePublications()

  const onlineStorePublication = storePublications.find(
    (storePublication: any) => storePublication.node.name === ONLINE_STORE
  )

  const successFunction = (data: any) => {
    productsImported.push(data)
  }
  const failedFunction = (data: any) => {
    productsFailed.push(data)
  }

  for (const fProduct of formattedProducts) {
    const { productId, productProviderId, product, media, variants } = fProduct

    try {
      let tailorkitFulfillmentLocationId = ''
      let deliveryProfile: any | null = null

      if (shouldCreateDeliveryProfile && printify) {
        // Get shipping profile
        const blue_print_shipping = printify
          ? await printify.catalog.getVariantShipping(productId, productProviderId)
          : null
        const profiles = blue_print_shipping?.profiles || []

        const _zones: { [key: string]: any } = {}

        const zones = profiles
          .map(profile => {
            const { countries } = profile

            // Find one country code from countries array
            const country = countries.find(country => isValidShopifyCountryCode(country))
            if (!country) return null

            const profileByCountry = _zones[country]

            if (profileByCountry) return null

            const zoneName = getShopifyRegionName(country)

            const methodDefinitionsToCreate = [
              {
                name: `${zoneName} Standard`,
                rateDefinition: {
                  price: {
                    amount: formatPrintifyCurrency(profile.first_item.cost),
                    currencyCode: profile.first_item.currency,
                  },
                },
              },
            ]

            const zone = {
              name: `${zoneName}`,
              country,
              methodDefinitionsToCreate,
            }

            _zones[country] = zone

            return zone
          })
          .filter(p => !!p)

        const fulfillmentServiceName = getFulfillmentServiceName(appName, providerName)
        let tailorkitFulfillmentLocation = await findTailorkitFulfillmentLocation(api, fulfillmentServiceName)

        if (!tailorkitFulfillmentLocation) {
          // Subscribe Tailorkit x X (fulfillment provider name) location on Shopify if missing
          await subscribeTailorKitFulfillmentService(admin as AdminApiContext, providerName as EPROVIDER)

          // Attempt to find the fulfillment location again after subscription
          tailorkitFulfillmentLocation = await findTailorkitFulfillmentLocation(api, fulfillmentServiceName)
        }

        if (!tailorkitFulfillmentLocation) {
          throw new Error(`Failed to find ${providerName} fulfillment service`)
        }

        tailorkitFulfillmentLocationId = tailorkitFulfillmentLocation.location.id

        const allDeliveryProfiles = await api.getAllDeliveryProfiles()

        const deliveryProfileName = `${getFulfillmentServiceName(appName, providerName)} - ${productProviderId}`
        deliveryProfile = allDeliveryProfiles.find(profile => profile.name === deliveryProfileName)

        if (tailorkitFulfillmentLocation && !deliveryProfile) {
          const zonesToCreate: any = zones.map(zone => ({
            name: zone.name,
            countries: {
              ...(REST_OF_WORLD_CODES.includes(zone.country)
                ? { restOfWorld: true }
                : { code: zone.country, includeAllProvinces: true }),
            },
            methodDefinitionsToCreate: zone.methodDefinitionsToCreate,
          }))

          try {
            deliveryProfile = (
              await api.createDeliveryProfile({
                name: deliveryProfileName,
                locationGroupsToCreate: {
                  locations: [tailorkitFulfillmentLocationId],
                  zonesToCreate,
                },
              })
            )?.profile
          } catch (e) {
            console.error('Failed to create delivery profile', e)
          }
        }
      }

      const shopifyProduct = await api.createProduct(product, media)

      const shopifyProductId = shopifyProduct.productCreate.product?.id

      if (shopifyProductId) {
        const insertedInventoryLocationVariants = variants.map(variant => ({
          ...variant,
          ...(shouldCreateDeliveryProfile
            ? {
                inventoryQuantities: [
                  {
                    availableQuantity: DEFAULT_PRODUCT_AVAILABLE,
                    locationId: tailorkitFulfillmentLocationId,
                  },
                ],
              }
            : {}),
        }))

        const productVariants = await api.createBulkProductVariants(shopifyProductId, insertedInventoryLocationVariants)

        const onlineStorePublicationId = onlineStorePublication?.node?.id
        if (onlineStorePublicationId) {
          await api.publishablePublish(shopifyProductId, onlineStorePublicationId)
        }

        if (shouldCreateDeliveryProfile && deliveryProfile) {
          await api.updateDeliveryProfile(
            deliveryProfile.id,
            productVariants.productVariantsBulkCreate.productVariants.map((variant: IVariant) => variant.id)
          )
        }

        successFunction({ shopifyProduct, productVariants, productId })
      } else {
        failedFunction({ fProduct, shopifyProduct })
      }
    } catch (error) {
      console.error(`Failed to import product ${productId}:`, error)
      failedFunction({ fProduct, error, productId })
    }

    await sleep(50)
  }

  return { productsImported, productsFailed }
}

// New helper function to find the fulfillment location
const findTailorkitFulfillmentLocation = async (api: any, fulfillmentServiceName: string) => {
  const listOfAllFulfillmentService = await api.receiveAListOfAllFulfillmentService()
  return listOfAllFulfillmentService.find((service: any) => service.serviceName === fulfillmentServiceName)
}

export async function importProviderProductsToShopify(params: {
  shopDomain: string
  providerId: string
  productIds: string[]
  providerName: string
  productImportedIds: string[]
  isShopifyTrial: boolean
  api: ShopifyApiClient
  admin: AdminApiContext<RestResources>
}) {
  const { shopDomain, providerId, productIds, providerName, productImportedIds, isShopifyTrial, api, admin } = params

  const productsData = await TemporaryProductData.find({
    shopDomain,
    providerId,
    productId: { $in: productIds },
  })

  const formattedProducts = await Promise.all(
    productsData.map(async product => ({
      productId: product.productId,
      productProviderId: '',
      product: preparedProductsDataToShopify(product, providerName as EPROVIDER),
      media: isShopifyTrial ? [] : preparedMediaDataToShopify(product),
      variants: await preparedVariantsDataToShopify(product, shopDomain, providerName as EPROVIDER),
    }))
  )

  const formattedProductsChunks = chunkArray(formattedProducts, 10)
  const failedResults: Record<string, unknown> = {}
  const importedResults: Record<string, unknown> = {}

  for (const chunk of formattedProductsChunks) {
    const { productsImported, productsFailed } = await importProductToShopify({
      formattedProducts: chunk,
      api,
      admin,
      providerName,
      shouldCreateDeliveryProfile: false,
    })

    productsImported.forEach((product: { productId: string }) => {
      importedResults[product.productId] = product
    })

    productsFailed.forEach((product: { productId: string }) => {
      failedResults[product.productId] = product
    })

    await sleep(100)
  }

  const productIdsToRemove = Object.keys(importedResults)
  await TemporaryProductData.deleteMany({ shopDomain, providerId, productId: { $in: productIdsToRemove } })
  const remainingIds = productImportedIds.filter(id => !productIdsToRemove.includes(id))
  await setTemporaryFulfillmentProducts({
    shopDomain,
    providerId,
    data: { products: remainingIds },
  })

  return {
    productsImported: Object.values(importedResults),
    productsFailed: Object.values(failedResults),
    productIdsToRemove,
  }
}

interface AutoSelectProductArgs {
  shopDomain: string
  providerId: string
  printifyProductIds: string[]
  confirmChoosePrintifyChoice: boolean
}

/**
 * Automatically selects and updates product data for Printify products
 * @param args Input parameters for product selection
 * @returns Object containing success status and updated product data
 */
export const autoSelectedProductDataForPrintifyProducts = async (args: AutoSelectProductArgs) => {
  const { shopDomain, providerId, printifyProductIds, confirmChoosePrintifyChoice } = args

  try {
    // Validate input
    if (!printifyProductIds.length) {
      return {
        success: false,
        message: 'No product IDs provided',
      }
    }

    // Get provider integration and existing products in parallel
    const [providerIntegration, existingProducts] = await Promise.all([
      ProviderIntegration.findOne({ providerId, shopDomain }),
      TemporaryProductData.find(
        {
          shopDomain,
          providerId,
          productId: { $in: printifyProductIds },
        },
        { productId: 1, baseProfitMargin: 1 }
      ).lean(),
    ])

    if (!providerIntegration?.apiToken) {
      return {
        success: false,
        message: 'Provider integration not found or invalid API token',
      }
    }

    // Process products in chunks to avoid overwhelming the API
    const productDataMap = new Map(existingProducts.map(product => [product.productId, product.baseProfitMargin || 0]))
    const chunks = chunkArray(printifyProductIds, 10)
    const results: Record<string, any> = {}
    const productProviderId = PRINTIFY_CHOICE_NAME_ID.id.toString()
    let providerDetails: IPrintifyProvider | null = null

    if (confirmChoosePrintifyChoice && productProviderId) {
      providerDetails = await fetchProviderDetailsByProviderId(productProviderId, providerIntegration.apiToken)
    }

    // Process each chunk in parallel
    await Promise.all(
      chunks.map(async chunk => {
        try {
          // Process all products in the chunk concurrently
          const printifyProductData = await Promise.all(
            chunk.map(async productId => {
              if (!confirmChoosePrintifyChoice) {
                return {
                  productId,
                  variants: [],
                  productProviderId: '',
                }
              }

              // Fetch variants and advance info in parallel
              const [variants, advanceInfo] = await Promise.all([
                getProviderBluePrintVariants(productId, productProviderId, providerIntegration.apiToken),
                getAdvanceBlueprintsProvider(productId, productProviderId),
              ])

              const baseCost = (advanceInfo?.min_price || 0) / 100
              const profitMargin = productDataMap.get(productId) || 0
              const exchangeRatePrice = 1 - profitMargin / 100
              const price = Math.round((baseCost / (exchangeRatePrice || 1)) * 100) / 100

              return {
                productId,
                variants:
                  variants?.map(variant => ({
                    ...variant,
                    cost: baseCost,
                    price,
                    profitMargin,
                  })) || [],
                productProviderId,
              }
            })
          )

          // Bulk update all products in the chunk
          const bulkOps = printifyProductData.map(({ productId, variants, productProviderId }) => ({
            updateOne: {
              filter: { shopDomain, providerId, productId },
              update: { $set: { variants, productProviderId } },
              upsert: true,
            },
          }))

          const updatedProducts = await TemporaryProductData.bulkWrite(bulkOps).then(() =>
            TemporaryProductData.find({ shopDomain, providerId, productId: { $in: chunk } }).lean()
          )

          // Update results
          updatedProducts.forEach(product => {
            results[product.productId] = { ...product, providerDetails }
          })
        } catch (error) {
          console.error(`Failed to process chunk: ${chunk.join(', ')}`, error)
          // Continue processing other chunks even if one fails
        }
      })
    )

    return {
      success: true,
      printifyProductWithVariants: results,
    }
  } catch (error) {
    console.error('Failed to select product data for Printify products:', error)
    return {
      success: false,
      message: 'Failed to select product data for Printify products automatically',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
