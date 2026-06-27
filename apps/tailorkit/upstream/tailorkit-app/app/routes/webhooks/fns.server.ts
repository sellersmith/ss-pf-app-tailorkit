import { isJSON } from 'extensions/tailorkit-src/src/assets/fns/is-json'
import { groupCharmLineItems } from '~/utils/charm-line-item-grouping'
import { buildFeatureAttributionProps } from '~/bootstrap/constants/feature-registry'
import { trackFeatureEvent } from '~/bootstrap/fns/feature-tracking.server'
import { FULFILLED, FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'
import { PREFIX_VARIANT_ID } from '~/constants/shopify'
import { THIRTY_SECONDS } from '~/constants/time'
import Customer from '~/models/Customer.server'
import Order, { updateOrderUsage } from '~/models/Order.server'
import PrintArea from '~/models/PrintArea.server'
import Shop, { getShopData } from '~/models/Shop.server'
import ShopifySession from '~/models/ShopifySession.server'
import { getOriginalSrc } from '~/shopify/fns'
import { getProviderOrNull } from '~/services/fulfillment/registry.server'
import type { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { convertIdsToQuery, verifyResponse } from '~/shopify/graphql/api.server'
import { uploadFilesWithAccessToken } from '~/shopify/graphql/files/fns.server'
import { uploadPrintImagesToS3 } from '~/utils/amazon-s3'
import { requestGraphqlApi } from '~/shopify/graphql/fns.server'
import { queryForProductVariantMetafields } from '~/shopify/graphql/products/query.server'
import { dataURLtoFile } from '~/utils/file-types'
import type { Browser } from 'puppeteer'
import { acquireBrowser, releaseBrowser } from '~/utils/puppeteer/browserPool'
import { DUMMY_VALID_SHIPPING_ADDRESS } from '~/constants/order'
import { isBraveBitsEmployee, isDevelopmentStore } from '~/bootstrap/fns/misc'
import { populateAnalyticsRevenues } from '~/models/AnalyticsRevenue.server'
import { populateAnalyticsTemplates } from '~/models/AnalyticsTemplate.server'
import { populateAnalyticsProducts } from '~/models/AnalyticsProduct.server'
import type { PipelineStage } from 'mongoose'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import {
  formatFulfillmentOrders,
  fulfillFulfillmentServiceLineItems,
} from './fns/fulfillFulfillmentServiceLineItems.server'
import { applyPromotionIfQualified } from '~/models/Promotion.server'
import { getFulfillmentServiceName, hasRequiredScopes } from '~/shopify/fns.server'
import { updateUserMilestoneIfShopHasAchievedFirstSale } from '../api.user-journey/journeys/achieve-first-sale/fns.server'
import {
  adjustLineItemToGetPrintAreaInfo,
  countPaidOrdersByShopDomain,
  orderListFinalPipeline,
  orderListPipeline,
} from '../api.orders/fns.server'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { convertCurrencyToDollar, convertDollarToCurrency } from '~/utils/exchange-rates'
import { isInTrial } from '../api.pricing/utils/fns'
import type { SubscriptionDocument } from '~/models/Subscription'
import { getValidPropertyNamePrefix, isOneTickProperty } from '../orders._index/fns'
import Provider from '~/models/Provider.server'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { postSlackMessage } from '~/bootstrap/fns/slack.server'

const APP_URL = process.env.SHOPIFY_APP_URL || process.env.HOST
const PRINT_IMAGE_FAILURE_SLACK_CHANNEL = 'U03TPREDM1S'
export const PROPERTY_PREFIX = APP_URL?.split('//')[1]?.split('.')?.[0].toUpperCase()

/**
 * Timeout multiplier for print image generation.
 * Value of 120 accounts for orders with multiple personalized products,
 * each potentially containing multiple print areas that need to be generated.
 * This ensures sufficient time for all template images to load and render.
 */
const PRINT_IMAGE_TIMEOUT_MULTIPLIER = 120

/**
 * Import data from the payload of Shopify order webhooks to app database.
 *
 * @param {any}    payload    The Shopify order webhook payload
 * @param {string} shopDomain The shop domain that webhooks are triggered
 *
 * @returns {Promise<void>}
 */
export async function importOrderAndCustomer(
  api: ShopifyApiClient,
  payload: any,
  shopDomain: string,
  webhook?: string
): Promise<void> {
  try {
    const { admin_graphql_api_id } = payload || {}

    // Check if the shop has the required scopes
    const shopHasRequiredScopes = await hasRequiredScopes(shopDomain)

    // Fallback if the shop does not have the required scopes
    if (!shopHasRequiredScopes) {
      console.error('Shop does not have the required scopes with shopDomain: ', shopDomain)
      return
    }

    const shopData = await getShopData(shopDomain)

    // Stop if not shop found
    if (!shopData) {
      return
    }

    // Get more detail of the order
    const orderDetail = await api.getOrderById(admin_graphql_api_id)
    const { fulfillmentOrders: _fulfillmentOrders, displayFulfillmentStatus } = orderDetail

    // Get fulfillment orders
    const fulfillmentOrders = formatFulfillmentOrders(_fulfillmentOrders)

    // Merge the payload and order detail
    const {
      id: orderId = '',
      customer = {},
      ...orderData
    } = { ...(payload || {}), fulfillmentOrders: fulfillmentOrders, displayFulfillmentStatus }

    if (orderData?.line_items) {
      // Check if this order contains TailorKit items
      const tailorKitLineItems = orderData.line_items.filter((lineItem: any) => {
        const hasTailorKitPrefix = lineItem.properties?.find(
          (prop: { name: string; value: string }) =>
            PROPERTY_PREFIX && getValidPropertyNamePrefix(prop.name, PROPERTY_PREFIX)
        )

        const hasOneTickProperties = lineItem.properties?.find((prop: { name: string; value: string }) =>
          isOneTickProperty(prop.name)
        )

        return hasTailorKitPrefix || hasOneTickProperties
      })

      if (tailorKitLineItems.length) {
        // Mark this order as TailorKit-attributed regardless of price
        orderData.isTailorKitOrder = true

        // Calculate app-generated revenue for this order
        const appGeneratedRevenueInOrderCurrency = tailorKitLineItems.reduce(
          (revenue: number, lineItem: any) => revenue + parseFloat(lineItem.price) * lineItem.quantity,
          0
        )

        // Grant the app-generated revenue for the order in the original currency
        orderData.appGeneratedRevenueInOrderCurrency = appGeneratedRevenueInOrderCurrency
        orderData.appGeneratedRevenueInShopCurrency = appGeneratedRevenueInOrderCurrency
        orderData.appGeneratedRevenue = appGeneratedRevenueInOrderCurrency

        const orderCurrency = orderData.currency
        const shopCurrency = shopData?.shopConfig?.currency

        // Convert app-generated revenue to US dollar
        if (orderCurrency) {
          orderData.appGeneratedRevenue = await convertCurrencyToDollar(orderCurrency, orderData.appGeneratedRevenue)
        }

        // Convert app-generated revenue to shop currency
        if (shopCurrency) {
          orderData.appGeneratedRevenueInShopCurrency = await convertDollarToCurrency(
            shopCurrency,
            orderData.appGeneratedRevenue
          )
        }
      }

      // Clear all line items in order data and not continue the process
      else {
        orderData.line_items = []
      }
    }

    if (orderData.line_items.length) {
      const { shopConfig } = shopData

      // Create or update the customer in app database
      const { id: customerId, ...customerData } = customer

      const c = (
        (await Customer.updateOne({ shopDomain, id: customerId }, customerData, { upsert: true })).upsertedId
        || (await Customer.findOne({ shopDomain, id: customerId }, 'id'))._id
      )?.toString()

      // Create or update the order in app database
      const _order = await Order.findOne({ shopDomain, id: orderId })

      // Parse the order to object
      const order = _order ? _order.toObject() : null

      if (order) {
        // Never update line item properties of existing order
        orderData.line_items = orderData.line_items.map((lineItem: any) => {
          // Find line item in the existing order
          const _lineItem = order.line_items.find((item: any) => item.id === lineItem.id)

          if (_lineItem) {
            lineItem.properties = _lineItem.properties
          }

          return lineItem
        })

        // Evaluate the fulfilledAt time
        const preFulfillmentStatus = order.fulfillment_status
        const currentFulfillmentStatus = orderData.fulfillment_status

        // Only evaluate if pre-save order is not fulfilled and currentFulfillmentStatus is fulfilled
        if (preFulfillmentStatus !== FULFILLED && currentFulfillmentStatus === FULFILLED) {
          // Set fulfilledAt equal to current time
          orderData.fulfilledAt = new Date().toISOString()
        }
      } else {
        // Set order data fulfilledAt if this order is automatically fulfilled.
        // Shopify has a option that merchant can automatically set order is fulfilled
        // This functionality is often served for dropshipping stores and the product is fulfilled by fulfillment services.
        if (orderData.fulfillment_status === FULFILLED) {
          orderData.fulfilledAt = new Date().toISOString()
        }
      }

      // For subsequent updates, preserve existing print_images
      const existingLineItems = order?.line_items || []

      const updatedLineItems = orderData.line_items.map((line_item: any) => {
        const { id } = line_item

        const existingLineItem = existingLineItems.find((existingItem: any) => existingItem.id === id)

        // Preserve existing print_images if they exist
        const existingPrintImages = existingLineItem?.print_images || []

        // TODO: Debug this step
        const fulfillment_order_submitted = existingLineItem?.fulfillment_order_submitted || {
          shop_id: '',
          status: 'unfulfilled',
          orderId: '',
        }

        const fulfillment_order_data = existingLineItem?.fulfillment_order_data

        return {
          ...line_item,
          print_images: existingPrintImages, // Keep existing print_images
          fulfillment_order_submitted,
          fulfillment_order_data,
        }
      })

      const isDevStore = isDevelopmentStore(shopConfig) && isBraveBitsEmployee(shopConfig)

      // Grant a valid shipping_address if this store is development plan
      if (isDevStore) {
        orderData.shipping_address = DUMMY_VALID_SHIPPING_ADDRESS
      }

      // Update the order without overwriting print_images
      // Capture the result to check if order was newly inserted (upserted)
      const orderUpdateResult = await Order.updateOne(
        { shopDomain, id: orderId },
        { ...orderData, customer: c, line_items: updatedLineItems },
        { upsert: true }
      )

      // Track if this order was newly created (inserted) vs updated
      // matchedCount === 0 means no existing document was matched → new order was inserted
      const isNewlyInsertedOrder = orderUpdateResult.matchedCount === 0

      // Update order usage count immediately for fast UI feedback
      // Moved here (before heavy processing) to reduce latency from ~5s to <1s
      if (isNewlyInsertedOrder) {
        await updateOrderUsage(shopDomain, shopData)
      }

      const conditionAggregate = [{ $match: { shopDomain, id: orderId } }]
      await populateAnalytics(conditionAggregate)

      // Only generate order image one time to prevent re-draw multiple time each order updates
      if (!order && orderData) {
        const session = await ShopifySession.findOne({ shop: shopDomain })

        // Generate print image (now returns both PNG and SVG)
        const printImagesResult = await generatePrintImage({ shopDomain, id: orderId }).catch(console.error)

        // TODO: Instead of returning immediately and preventing order fulfillment, find another way to handle this case.
        if (!printImagesResult) return

        const { accessToken, shop } = session

        // Create files for both PNG and SVG
        // Handle both old format (direct key-value) and new format (with png/svg objects)
        const pngImages = printImagesResult.png || printImagesResult
        const svgImages = printImagesResult.svg || {}

        const pngFiles = Object.keys(pngImages)
          .filter(key => pngImages[key] && pngImages[key].startsWith('data:'))
          .map(key => dataURLtoFile(pngImages[key], `${key}.png`))
        const svgFiles = Object.keys(svgImages)
          .filter(key => svgImages[key] && svgImages[key].startsWith('data:'))
          .map(key => dataURLtoFile(svgImages[key], `${key}.svg`))
        const filesToUpload = [...pngFiles, ...svgFiles]

        // Upload print image files to S3, fallback to Shopify if S3 fails
        let result = await uploadPrintImagesToS3(filesToUpload, shopDomain).catch(console.error)

        // Fallback to Shopify upload if S3 upload fails or returns no files
        if (!result?.uploadedFiles?.length) {
          console.log('S3 upload failed, falling back to Shopify upload')
          result = await uploadFilesWithAccessToken(accessToken, filesToUpload, shop).catch(console.error)
        }

        const uploadedFiles = result?.uploadedFiles || []

        // Loop through upload file to update line item
        const providerConnections: any = {}

        for (let i = 0; i < orderData.line_items.length; i++) {
          const { id, variant_id, vendor, fulfillment_service } = orderData.line_items[i]

          // alt includes "line_item_id.print_area_id.ext" (e.g., "123.456.png" or "123.456.svg")
          const files = uploadedFiles.filter(file => {
            const parts = file.alt.split('.')
            return parts[0] === id.toString()
          })

          // Group files by print area to combine PNG and SVG
          const printAreaFilesMap: Map<string, { printAreaId: string; pngFile?: any; svgFile?: any }> = new Map()

          for (const file of files) {
            const parts = file.alt.split('.')
            const printAreaId = parts[1]
            const ext = parts[2] || 'png' // Default to png for backward compatibility

            if (!printAreaFilesMap.has(printAreaId)) {
              printAreaFilesMap.set(printAreaId, { printAreaId })
            }

            const entry = printAreaFilesMap.get(printAreaId)!
            if (ext === 'svg') {
              entry.svgFile = file
            } else {
              entry.pngFile = file
            }
          }

          const print_images: { printAreaId: string; printAreaName: string; image: any; svg?: any }[] = []

          for (const [printAreaId, fileData] of printAreaFilesMap) {
            const printArea = await PrintArea.findOne({ _id: printAreaId })

            const print_image: { printAreaId: string; printAreaName: string; image: any; svg?: any } = {
              printAreaId,
              printAreaName: printArea?.name,
              image: fileData.pngFile?.image,
            }

            // Add SVG if available
            if (fileData.svgFile?.image) {
              print_image.svg = {
                originalSrc: fileData.svgFile.image.originalSrc,
              }
            }

            print_images.push(print_image)
          }

          if (
            FULFILLMENT_PROVIDERS.includes(vendor)
            && fulfillment_service === getFulfillmentServiceName(process.env.APP_NAME as string, vendor, true)
          ) {
            const variantMetafields = await verifyResponse(
              await requestGraphqlApi({
                query: queryForProductVariantMetafields({
                  query: convertIdsToQuery([`${PREFIX_VARIANT_ID}${variant_id}`]),
                }),
                shopDomain: shop,
                accessToken,
              }),
              'productVariants.nodes'
            )

            const metafield = variantMetafields[0]?.metafields?.nodes?.[0]

            if (metafield) {
              const { type } = metafield

              if (type === 'json') {
                const _value = metafield.value

                if (isJSON(_value)) {
                  const metafieldValue = JSON.parse(_value)

                  const adapter = getProviderOrNull(vendor)
                  if (adapter?.prepareFulfillmentData) {
                    // Extract customer properties from Shopify line item properties array
                    const lineItemProperties = orderData.line_items[i].properties || []
                    const customerProperties: Record<string, string> = {}
                    if (Array.isArray(lineItemProperties)) {
                      for (const prop of lineItemProperties) {
                        if (prop.name && prop.value) customerProperties[prop.name] = prop.value
                      }
                    }

                    const fulfillmentData = adapter.prepareFulfillmentData({
                      variantMeta: metafieldValue,
                      printImages: print_images
                        .map((pi: any) => ({
                          printAreaName: pi.printAreaName,
                          image: pi.image
                            ? { src: getOriginalSrc(pi.image), width: pi.image.width, height: pi.image.height }
                            : null,
                        }))
                        .filter((pi: any) => pi.image),
                      customerProperties,
                    })

                    orderData.line_items[i] = {
                      ...orderData.line_items[i],
                      fulfillment_order_data: fulfillmentData,
                      print_images,
                    }
                  }
                }
              }
            }

            // Check if the required fulfimment provider is connected to TailorKit?
            const providerConnection
              = providerConnections[vendor]
              || (await ProviderIntegration.findOne({
                shopDomain,
                providerId: (await Provider.findOne({ name: vendor }))?._id,
              }))

            // Set a flag to prevent order fulfillment
            await Shop.updateOne(
              { shopDomain },
              {
                'appConfig.requiredFulfillmentServices': {
                  ...(shopData?.appConfig?.requiredFulfillmentServices || {}),
                  [vendor]: providerConnection?.apiToken
                    ? 0
                    : (shopData?.appConfig?.requiredFulfillmentServices?.[vendor] || 0) + 1,
                },
              }
            )
          }

          orderData.line_items[i] = {
            ...orderData.line_items[i],
            print_images,
          }
        }

        // Update new line_items
        const updatedOrder = await Order.findOneAndUpdate(
          { shopDomain, id: orderId },
          { line_items: orderData.line_items },
          // Upsert and return the updated document
          { new: true, upsert: true }
        )

        // Fulfill line items automatically if needed
        await fulfillFulfillmentServiceLineItems({
          order: updatedOrder,
          shopDomain,
          shopData,
          shouldFulfill: false,
          requestedFromOrderCreate: true,
        })
      } else if (order && orderData) {
        // Check if the order is cancelled?
        const cancelledStatuses = ['cancelled', 'refunded', 'partially_refunded']

        if (
          (!cancelledStatuses.includes(order.financial_status)
            && cancelledStatuses.includes(orderData.financial_status))
          || (order.fulfillment_status !== FULFILLED && orderData.fulfillment_status === FULFILLED)
        ) {
          for (let i = 0; i < orderData.line_items.length; i++) {
            const { vendor, fulfillable_quantity, fulfillment_service } = orderData.line_items[i]

            if (
              FULFILLMENT_PROVIDERS.includes(vendor)
              && shopData?.appConfig?.requiredFulfillmentServices?.[vendor] > 0
              && fulfillment_service === getFulfillmentServiceName(process.env.APP_NAME as string, vendor, true)
            ) {
              if (
                !fulfillable_quantity
                || (order.fulfillment_status !== FULFILLED && orderData.fulfillment_status === FULFILLED)
              ) {
                // Update the flag for preventing order fulfillment
                await Shop.updateOne(
                  { shopDomain },
                  {
                    'appConfig.requiredFulfillmentServices': {
                      ...(shopData?.appConfig?.requiredFulfillmentServices || {}),
                      [vendor]: (shopData?.appConfig?.requiredFulfillmentServices?.[vendor] || 0) - 1,
                    },
                  }
                )

                if (shopData?.appConfig?.requiredFulfillmentServices?.[vendor]) {
                  shopData.appConfig.requiredFulfillmentServices[vendor]--
                }
              }
            }
          }
        }
      }

      // Send event to MixPanel
      const occurredEvents = shopData?.appConfig?.occurredEvents || {}
      const numPaidOrders = await countPaidOrdersByShopDomain(shopDomain)

      // Order usage count already updated above (right after order upsert)

      if (webhook === 'ORDERS_CREATE') {
        // Check if any storefront features was used in this order
        const usages = updatedLineItems.reduce((acc: any, lineItem: any) => {
          const { properties } = lineItem

          properties.forEach((prop: { name: string; value: string }) => {
            if (prop.name.startsWith(`_${PROPERTY_PREFIX}_USE_`)) {
              const feature = prop.name.replace(`_${PROPERTY_PREFIX}_`, '')
              acc[feature] = acc[feature] ? acc[feature] + 1 : 1
            }
          })

          return acc
        }, {})

        // Check if order contains AI product
        const _orders = await Order.aggregate([
          ...orderListPipeline,
          {
            $match: {
              id: orderId,
            },
          },
          ...orderListFinalPipeline,
        ]).exec()

        const order = (await adjustLineItemToGetPrintAreaInfo(_orders, shopDomain))[0]

        // Detect active features on this order for revenue attribution
        const featureAttribution = buildFeatureAttributionProps(order)

        // Send event to MixPanel
        const {
          currency: orderCurrency,
          appGeneratedRevenueInOrderCurrency,
          appGeneratedRevenue: appGeneratedRevenueInDollar,
          appGeneratedRevenueInShopCurrency,
        } = orderData

        order?.line_items?.forEach(async (lineItem: any) => {
          await trackEvent(shopData, EVENTS_TRACKING.STOREFRONT_ORDER, {
            ...usages,
            orderId,
            orderCurrency,
            ...featureAttribution,
            appGeneratedRevenueInDollar,
            appGeneratedRevenueInShopCurrency,
            appGeneratedRevenueInOrderCurrency,
            productId: lineItem.product_id,
            productTitle: lineItem.title,
            lineItemId: lineItem.id,
            variantId: lineItem.variant_id,
            shopCurrency: shopData?.shopConfig?.currency,
          }).catch(console.error)
        })

        // Send achieve_sale event to customer.io
        let eventName = EVENTS_TRACKING.ACHIEVE_SALE

        let eventData = {
          [EVENTS_PARAMETERS_NAME.APP_GENERATED_REVENUE]: orderData.appGeneratedRevenue || 0,
        }

        postEventToCustomerIo({ eventData, eventName, shopDomain }).catch(console.error)

        // Check if this is the first order
        eventName = CUSTOMERIO_EVENTS.ACHIEVED_FIRST_ORDER
        const createdAt = new Date(order?.created_at || orderData.created_at)

        try {
          if (numPaidOrders === 1 || !occurredEvents[eventName]) {
            // Prepare event data
            eventData = {
              createdAt,
              daysToFirstSale: (
                (createdAt.getTime() - (shopData.createdAt as Date).getTime())
                / ONE_DAY_IN_MILLISECONDS
              ).toFixed(2),
            }

            // Send event to MixPanel
            trackEvent(shopData, eventName, eventData, { noDuplicate: true }).catch(console.error)

            // Send achieved_first_order event to customer.io
            postEventToCustomerIo({ eventData, eventName, shopDomain, noDuplicate: true }).catch(console.error)

            // Update user milestone
            updateUserMilestoneIfShopHasAchievedFirstSale(shopDomain).catch(console.error)

            // Update shop usage
            await Shop.updateOne({ shopDomain }, { 'usages.achievedFirstSale': true })
          }
        } catch (e) {
          console.error('Failed to send achieved_first_order event to customer.io', e)
        }

        // Detect charm orders → track business value delivered to merchant
        const charmResult = groupCharmLineItems(updatedLineItems, PROPERTY_PREFIX ?? '')
        if (charmResult.totalCharmCount > 0) {
          const isFirstCharmOrder = !shopData?.usages?.achievedFirstCharmOrder
          trackFeatureEvent(shopData, 'charm_builder', 'order_with_charms', {
            charm_count: charmResult.totalCharmCount,
            is_first_charm_order: isFirstCharmOrder,
          }).catch(console.error)
          if (isFirstCharmOrder) {
            await Shop.updateOne({ shopDomain }, { 'usages.achievedFirstCharmOrder': true })
          }
        }

        // Detect orders where buyer used text movement zone
        if (usages.USE_MOVEMENT_ZONE) {
          trackFeatureEvent(shopData, 'buyer_text_movement_zone', 'order_with_moved_text', {
            movement_count: usages.USE_MOVEMENT_ZONE,
          }).catch(console.error)
        }
      }

      // Send fulfilled_first_order event to customer.io
      const numFulfilledOrders = await Order.countDocuments({
        shopDomain,
        financial_status: 'paid',
        fulfillment_status: FULFILLED,
      })

      if (numFulfilledOrders === 1 || !occurredEvents[CUSTOMERIO_EVENTS.FULFILLED_FIRST_ORDER]) {
        postEventToCustomerIo({
          shopDomain,
          noDuplicate: true,
          eventData: { createdAt: order?.fulfilledAt || new Date(orderData.updated_at) },
          eventName: CUSTOMERIO_EVENTS.FULFILLED_FIRST_ORDER,
        }).catch(console.error)

        // Update shop usage
        await Shop.updateOne({ shopDomain }, { 'usages.fulfilledFirstSale': true })
      }

      if (
        (numPaidOrders === 1 || numFulfilledOrders === 1)
        && isInTrial(shopData.subscription as SubscriptionDocument)
      ) {
        await applyPromotionIfQualified(shopDomain)
      }
    }
  } catch (e) {
    console.error('Failed to import order and customer', e)
  }
}

/**
 * Generate print image for an order
 * Uses a browser pool to limit concurrent Chrome instances and prevent resource exhaustion
 * @param args - The arguments for generating print image
 * @param args.id - The id of the order
 * @param args.shopDomain - The shop domain
 * @returns The print images
 */
async function generatePrintImage(args: { id: string; shopDomain: string }) {
  const { id: orderId, shopDomain } = args

  if (!orderId || !shopDomain) return null

  let browser: Browser | null = null

  try {
    // Acquire browser from pool (will wait if at capacity)
    browser = await acquireBrowser()
    const page = await browser.newPage()

    // eslint-disable-next-line max-len
    const url = `${APP_URL}/api/public/print-image-generation?orderId=${orderId}&secretToken=${process.env.IMAGE_GENERATION_TOKEN}&shopDomain=${shopDomain}`

    // Because 1 order might contains multiple personalized products and each personalized
    // product might contains multiple print areas, we need a navigation timeout that is
    // long enough to be able to load all template images.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PRINT_IMAGE_TIMEOUT_MULTIPLIER * THIRTY_SECONDS })

    // Wait for `data-print-images` or `window.printImages` to be set
    await page.waitForFunction(
      () => {
        // Check if the global variable is set
        return window.printImages && window.printImages !== ''
      },
      // Because 1 order might contains multiple personalized products and each
      // personalized product might contains multiple print areas, we need a
      // timeout that is long enough to be able to generate all images.
      { timeout: PRINT_IMAGE_TIMEOUT_MULTIPLIER * THIRTY_SECONDS }
    )

    // Extract the value of `window.printImages`
    const printImagesValue = await page.evaluate(() => window.printImages)

    // Close page (browser stays in pool for reuse)
    await page.close()

    // Check if print image generation failed (client-side error with retries exhausted)
    if (printImagesValue && typeof printImagesValue === 'object' && 'error' in printImagesValue) {
      const errorMessage = printImagesValue.message || 'Unknown error'
      await notifyPrintImageFailure({ orderId, shopDomain, errorMessage })
      return null
    }

    return printImagesValue
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    await notifyPrintImageFailure({ orderId, shopDomain, errorMessage })
    throw new Error(`Error while generating image: ${errorMessage}`)
  } finally {
    // Always release browser back to pool, even on error
    if (browser) {
      await releaseBrowser(browser)
    }
  }
}

async function notifyPrintImageFailure(args: { orderId: string; shopDomain: string; errorMessage: string }) {
  const { orderId, shopDomain, errorMessage } = args
  const message = [
    ':warning: *Print Image Generation Failed*',
    `• Order ID: ${orderId}`,
    `• Shop: ${shopDomain}`,
    `• Error: ${errorMessage}`,
    `• Time: ${new Date().toISOString()}`,
  ].join('\n')

  await postSlackMessage(message, PRINT_IMAGE_FAILURE_SLACK_CHANNEL)
}

export async function populateAnalytics(conditionAggregate: PipelineStage[]) {
  try {
    await populateAnalyticsRevenues(conditionAggregate)
    await populateAnalyticsTemplates(conditionAggregate)
    await populateAnalyticsProducts(conditionAggregate)
  } catch (err) {
    console.error('Can not populate data for analytics the new order ', err)
  }
}
