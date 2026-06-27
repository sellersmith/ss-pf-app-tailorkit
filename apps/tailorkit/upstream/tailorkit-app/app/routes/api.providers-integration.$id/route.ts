import { type LoaderFunctionArgs } from '@remix-run/node'
import Provider from '~/models/Provider.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { PRINTIFY_CHOICE_NAME_ID, PROVIDER_INTEGRATION_ACTION, type TProductToImport } from './constants'
import TemporaryFulfillmentProducts from '~/models/TemporaryFulfillmentProducts.server'
import TemporaryProductData from '~/models/TemporatyProductData'
import {
  autoSelectedProductDataForPrintifyProducts,
  importProductsToDataBase,
  importProductToShopify,
  importProviderProductsToShopify,
  preparedMediaDataToShopify,
  preparedProductsDataToShopify,
  preparedVariantsDataToShopify,
  setTemporaryFulfillmentProducts,
} from './fns.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { Printify } from '~/modules/Fulfillments'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { type TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import {
  fetchProviderDetailsByProviderId,
  getBlueprintProviders,
} from '../api.providers-product.$id/utilities/Printify/getBlueprintProviders'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { chunkArray } from '~/utils/chunkArray'
import { json } from '~/bootstrap/fns/fetch.server'
import { getCapabilitiesForProvider } from '~/services/fulfillment/capabilities.server'
import type { RestResources } from '@shopify/shopify-api/rest/admin/2025-07'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import { sleep } from '~/utils/sleep'
import { getShopData } from '~/models/Shop.server'
import { isShopifyTrialPlan } from '~/bootstrap/fns/misc'
import { DEFAULT_API_TOKEN, DEFAULT_SHOP_ID } from '../api.user-journey/constants'

export const loader = catchAsync(async ({ params, request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const providerId = params.id || ''

  const temporaryFulfillmentProducts = (
    await TemporaryFulfillmentProducts.findOne({
      shopDomain,
      providerId,
    }).populate({
      path: 'providerId',
      model: Provider,
    })
  )?.toObject()

  const { data, providerId: providerInfo } = temporaryFulfillmentProducts || {
    data: { products: [] },
    providerId: null,
  }
  const capabilities = getCapabilitiesForProvider(providerInfo?.name || '')
  const providerIntegration = await ProviderIntegration.findOne({ providerId, shopDomain })
  const apiToken = providerIntegration?.apiToken

  // Explicit query instead of populate for products — more reliable for string-based foreign keys
  const productIds: string[] = data?.products || []

  const productDocs
    = productIds.length > 0 ? await TemporaryProductData.find({ shopDomain, productId: { $in: productIds } }) : []

  let products = productDocs.map(d => d.toObject())
  if (providerInfo?.name === EPROVIDER.PRINTIFY) {
    try {
      // Increase chunk size for faster processing while still avoiding overwhelming the API
      const productChunks = chunkArray(products, 10) // Process 10 products at a time
      const processedProducts: any[] = []

      // Use Promise.all to process all chunks concurrently with controlled delays
      await Promise.all(
        productChunks.map(async (chunk, index) => {
          // Add staggered delay to distribute API load
          if (index > 0) {
            await sleep(100 * index) // Staggered delay between chunk starts
          }

          // Process all products in the current chunk concurrently
          const chunkResults = await Promise.all(
            chunk.map(async (product: TemporaryProduct) => {
              const { productId, productProviderId } = product

              // Only make API calls if we have the necessary IDs
              if (!productId) return product

              // Prepare functions for API calls
              const getProviderDetails = productProviderId
                ? fetchProviderDetailsByProviderId(productProviderId, apiToken)
                : Promise.resolve(null)

              const getProviderList = getBlueprintProviders(productId, apiToken, false) // Set containsLocation to false for speed if possible

              // Execute API calls concurrently
              const [providerDetails, providerList] = await Promise.all([getProviderDetails, getProviderList])

              if (providerDetails) {
                Object.assign(product, { providerDetails })
              }

              return {
                ...product,
                providerList: providerList || [],
              }
            })
          )

          // Add results to the processed array using a closure to maintain order
          processedProducts.push(...chunkResults)
        })
      )

      products = processedProducts
    } catch (err) {
      console.error('Failed to get blueprint providers list', err)
    }
  }

  const importedProducts = {
    providerInfo,
    capabilities,
    data: { ...data, products },
  }
  return json({ success: true, importedProducts })
})

export const action = catchAsync(async ({ params, request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
    admin,
  } = await authenticate.admin(request)

  const api = new ShopifyApiClient(admin)

  const payload = (await request.json()) || {}
  const providerId = params.id || ''
  const { action } = payload

  switch (action) {
    case PROVIDER_INTEGRATION_ACTION.IMPORT_PRODUCT: {
      const { data } = payload
      const { importedData, showUnderstandAboutProviderModal } = await importProductsToDataBase(
        shopDomain,
        providerId,
        data
      )

      return json({ success: !!importedData, importedData, showUnderstandAboutProviderModal })
    }

    case PROVIDER_INTEGRATION_ACTION.UPDATE_BASE_PROFIT_MARGIN: {
      const { profitMargin, productIds } = payload

      // Update profitMargin for variants in bulk
      await TemporaryProductData.updateMany({ shopDomain, providerId, productId: { $in: productIds } }, [
        {
          $set: {
            baseProfitMargin: profitMargin,
            variants: {
              $map: {
                input: '$variants',
                as: 'variant',
                in: {
                  $mergeObjects: [
                    '$$variant',
                    {
                      profitMargin: profitMargin,
                      price: {
                        $round: [
                          {
                            $divide: [
                              '$$variant.cost',
                              {
                                $cond: [
                                  { $eq: [{ $subtract: [1, { $divide: [profitMargin, 100] }] }, 0] },
                                  1,
                                  { $subtract: [1, { $divide: [profitMargin, 100] }] },
                                ],
                              },
                            ],
                          },
                          2,
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ])

      return json({
        success: true,
        profitMargin,
      })
    }

    case PROVIDER_INTEGRATION_ACTION.UPDATE_PRODUCTS_SELECTED: {
      const { selectedProducts, providerName } = payload
      // Fetch the current products data first
      const importedData = await TemporaryFulfillmentProducts.findOne({ shopDomain, providerId })
      if (!importedData) {
        await importProductsToDataBase(shopDomain, providerId, {
          products: selectedProducts,
        })

        return json({
          success: true,
          products: selectedProducts,
        })
      }

      const currentProductIds: string[] = importedData.data.products || []
      const showUnderstandAboutProviderModal = importedData.data.showUnderstandAboutProviderModal ?? true
      const confirmChoosePrintifyChoice = importedData.data.confirmChoosePrintifyChoice ?? false

      // Filter products to check if they need to be added
      const productsToAdd = selectedProducts.filter(
        (product: TProductToImport) => !currentProductIds.includes(product.productId)
      )
      const productIdsToRemove = currentProductIds.filter(
        productId => !selectedProducts.find((product: TProductToImport) => product.productId === productId)
      )

      // Remove products with productIds in productIdsToRemove
      if (productIdsToRemove.length > 0) {
        await TemporaryProductData.deleteMany({ shopDomain, providerId, productId: { $in: productIdsToRemove } })
      }

      let productAdded = []
      // Add new products from productsToAdd
      if (productsToAdd.length > 0) {
        let defaultData: any = {
          providerId,
          productProviderId: '',
          variants: [],
        }

        const providerIntegration = await ProviderIntegration.findOne({ providerId, shopDomain })
        const apiToken = providerIntegration?.apiToken
        productAdded = await Promise.all(
          productsToAdd.map(async (product: TProductToImport) => {
            let providerList: any[] = []

            if (providerName === EPROVIDER.PRINTIFY) {
              const { productId } = product
              providerList = (await getBlueprintProviders(productId, apiToken)) || []
              const hasPrintifyChoice = providerList?.find(provider => provider.id === PRINTIFY_CHOICE_NAME_ID.id)

              if (confirmChoosePrintifyChoice && hasPrintifyChoice) {
                const result = await autoSelectedProductDataForPrintifyProducts({
                  shopDomain,
                  providerId,
                  printifyProductIds: [productId],
                  confirmChoosePrintifyChoice,
                })

                if (result.success && result.printifyProductWithVariants) {
                  defaultData = result.printifyProductWithVariants[productId]
                }
              }
            }

            const query = { productId: product.productId, shopDomain }
            const updatedData = {
              ...defaultData,
              ...product,
            }

            // Delete _id from updatedData to make sure it's not duplicated or mutated when modifying the product
            delete updatedData._id

            const productData = (
              await TemporaryProductData.findOneAndUpdate(query, updatedData, { upsert: true, new: true })
            )?.toObject()

            return {
              ...productData,
              providerList,
            }
          })
        )
      }

      await TemporaryFulfillmentProducts.updateOne(
        { shopDomain, providerId },
        {
          data: {
            ...(importedData?.data || {}),
            products: selectedProducts.map((product: TProductToImport) => product.productId),
          },
        }
      )

      return json({
        success: true,
        productAdded,
        showUnderstandAboutProviderModal,
      })
    }

    case PROVIDER_INTEGRATION_ACTION.IMPORT_PRODUCTS_TO_SHOPIFY: {
      const { productIds } = payload
      const temporaryProducts = (
        await TemporaryFulfillmentProducts.findOne({ shopDomain, providerId }).populate({
          path: 'providerId',
          model: Provider,
        })
      ).toObject()

      if (temporaryProducts) {
        const shopData = await getShopData(shopDomain)
        const isShopifyTrial = isShopifyTrialPlan(shopData?.shopConfig)

        // Get provider information
        const provider = temporaryProducts.providerId
        const providerName = provider.name
        const productImportedIds: string[] = temporaryProducts.data.products

        // Handle ShineOn and PrintWay providers (no Printify SDK needed)
        if (providerName === EPROVIDER.SHINEON || providerName === EPROVIDER.PRINTWAY) {
          const result = await importProviderProductsToShopify({
            shopDomain,
            providerId,
            productIds,
            providerName,
            productImportedIds,
            isShopifyTrial,
            api,
            admin: admin as AdminApiContext<RestResources>,
          })

          return json({ success: true, ...result })
        }

        // Handle Printify provider
        if (providerName === EPROVIDER.PRINTIFY) {
          const providerIntegration = await ProviderIntegration.findOne({
            shopDomain,
            providerId,
          })

          const { apiToken, shopId } = providerIntegration || { apiToken: DEFAULT_API_TOKEN, shopId: DEFAULT_SHOP_ID }

          const printify = new Printify({
            accessToken: apiToken,
            shopId,
          })

          const productsData = await TemporaryProductData.find({
            shopDomain,
            providerId,
            productId: { $in: productIds },
          })

          const formattedProducts = await Promise.all(
            productsData.map(async product => {
              // Prepare variants data
              const variants = await preparedVariantsDataToShopify(product, shopDomain, EPROVIDER.PRINTIFY)

              return {
                productId: product.productId,
                productProviderId: product.productProviderId,
                product: preparedProductsDataToShopify(product),
                media: isShopifyTrial ? [] : preparedMediaDataToShopify(product),
                variants,
              }
            })
          )

          const formattedProductsChunks = chunkArray(formattedProducts, 10)
          const failedResults: Record<string, any> = {}
          const importedResults: Record<string, any> = {}

          for (const formattedProducts of formattedProductsChunks) {
            const { productsImported, productsFailed } = await importProductToShopify({
              formattedProducts,
              printify,
              api,
              admin: admin as AdminApiContext<RestResources>,
              providerName,
            })

            productsImported.forEach(product => {
              importedResults[product.productId] = product
            })

            productsFailed.forEach(product => {
              failedResults[product.productId] = product
            })

            await sleep(100)
          }

          const productIdsToRemove = Object.keys(importedResults)
          await TemporaryProductData.deleteMany({ shopDomain, providerId, productId: { $in: productIdsToRemove } })

          const _productIds = productImportedIds.filter(productId => !productIdsToRemove.includes(productId))

          await setTemporaryFulfillmentProducts({
            shopDomain,
            providerId,
            data: {
              products: _productIds,
              confirmChoosePrintifyChoice: false,
            },
          })

          return json({
            success: true,
            productsImported: Object.values(importedResults),
            productsFailed: Object.values(failedResults),
            productIdsToRemove,
          })
        }
      }

      return json({
        success: true,
      })
    }

    case PROVIDER_INTEGRATION_ACTION.IMPORT_DUMMY_PRODUCTS_TO_SHOPIFY: {
      const { products } = payload
      const shopData = await getShopData(shopDomain)
      const isShopifyTrial = isShopifyTrialPlan(shopData?.shopConfig)

      const formattedProducts = await Promise.all(
        products.map(async (product: TProductToImport) => {
          // Prepare variants data
          const temporaryProduct: TemporaryProduct = {
            ...product,
            providerId,
            productProviderId: '',
            variants: [],
          }
          const variants = await preparedVariantsDataToShopify(temporaryProduct, shopDomain)

          return {
            productId: product.productId,
            product: preparedProductsDataToShopify(temporaryProduct, EPROVIDER.TAILORKIT_DEMO_PRODUCT),
            media: isShopifyTrial ? [] : preparedMediaDataToShopify(temporaryProduct),
            variants,
          }
        })
      )

      const formattedProductsChunks = chunkArray(formattedProducts, 10)
      const failedResults: Record<string, any> = {}
      const importedResults: Record<string, any> = {}

      for (const formattedProducts of formattedProductsChunks) {
        const { productsImported, productsFailed } = await importProductToShopify({
          formattedProducts,
          api,
          admin: admin as AdminApiContext<RestResources>,
          providerName: EPROVIDER.TAILORKIT_DEMO_PRODUCT,
          shouldCreateDeliveryProfile: false,
        })

        productsImported.forEach(product => {
          importedResults[product.productId] = product
        })

        productsFailed.forEach(product => {
          failedResults[product.productId] = product
        })

        await sleep(100)
      }

      // Poll for media readiness for all successfully imported products with media
      const productIdsWithMedia = Object.values(importedResults)
        .filter((product: any) => product.shopifyProduct?.productCreate?.product?.id)
        .map((product: any) => product.shopifyProduct.productCreate.product.id)

      if (productIdsWithMedia.length > 0) {
        // Poll all products in parallel
        await Promise.all(
          productIdsWithMedia.map(async productId => {
            try {
              const result = await api.pollProductMediaStatus(productId, 10, 500)
              if (!result.isReady) {
                console.warn(`Media not ready for product ${productId} after polling`)
              }
            } catch (error) {
              console.error(`Failed to poll media status for product ${productId}:`, error)
            }
          })
        )
      }

      return json({
        success: true,
        productsImported: Object.values(importedResults),
        productsFailed: Object.values(failedResults),
      })
    }

    case PROVIDER_INTEGRATION_ACTION.CONFIRM_CHOOSE_PRINTIFY_CHOICE: {
      const { printifyProductIds, confirm } = payload
      const result = await autoSelectedProductDataForPrintifyProducts({
        shopDomain,
        providerId,
        printifyProductIds,
        confirmChoosePrintifyChoice: confirm,
      })

      if (!result.success) {
        return json({
          success: false,
          message: result.message,
        })
      }

      // Update confirmation status
      await TemporaryFulfillmentProducts.updateOne(
        { shopDomain, providerId },
        { $set: { 'data.confirmChoosePrintifyChoice': confirm } }
      )

      return json({
        success: true,
        printifyProductWithVariants: result.printifyProductWithVariants,
      })
    }

    case PROVIDER_INTEGRATION_ACTION.DELETE_SELECTED_PRODUCTS: {
      const { selectedProductIds } = payload
      const importedData = await TemporaryFulfillmentProducts.findOne({ shopDomain, providerId })
      const importedProductIds: string[] = importedData?.data?.products || []
      const _productIds = importedProductIds.filter(productId => !selectedProductIds.includes(productId))

      await setTemporaryFulfillmentProducts({
        shopDomain,
        providerId,
        data: {
          products: _productIds,
        },
      })
      await TemporaryProductData.deleteMany({ shopDomain, providerId, productId: { $in: selectedProductIds } })

      return json({
        success: true,
        selectedProductIds,
      })
    }

    case PROVIDER_INTEGRATION_ACTION.HIDE_UNDERSTAND_ABOUT_PROVIDER_MODAL: {
      const { dontShowAgain } = payload
      await setTemporaryFulfillmentProducts({
        shopDomain,
        providerId,
        data: {
          showUnderstandAboutProviderModal: !dontShowAgain,
        },
      })

      return json({
        success: true,
      })
    }

    case PROVIDER_INTEGRATION_ACTION.CHECK_UNFINISHED_IMPORTED_PRODUCTS: {
      const productsImportedData = await TemporaryFulfillmentProducts.findOne({ shopDomain, providerId }).select(
        'data.products'
      )

      return json({ success: true, isUnfinishedImported: productsImportedData?.data?.products?.length > 0 })
    }
  }

  return json({ success: true })
})
