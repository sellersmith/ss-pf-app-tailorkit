// GRAFT: verbatim copy of upstream importOrderAndCustomer (fns.server.ts L76-738) for diff-guard. Body MUST stay byte-identical to upstream; only the shim bindings change I/O. Source: apps/tailorkit/upstream/tailorkit-app/app/routes/webhooks/fns.server.ts

type ShopifyApiClient = Record<string, never>

type Browser = {
  newPage(): Promise<{
    goto(url: string, options: { waitUntil: string; timeout: number }): Promise<void>
    waitForFunction(fn: () => boolean, options: { timeout: number }): Promise<void>
    evaluate<T>(fn: () => T): Promise<T>
    close(): Promise<void>
  }>
}

declare const window: { printImages: any }

export interface OrderCaptureGraftDeps {
  Order: any
  Customer: any
  Shop: any
  PrintArea: any
  ShopifySession: any
  ProviderIntegration: any
  Provider: any
  hasRequiredScopes(shopDomain: string): Promise<boolean> | boolean
  getShopData(shopDomain: string): Promise<any> | any
  getValidPropertyNamePrefix(propertyName: string, propertyPrefix: string): boolean
  isOneTickProperty(propertyName: string): boolean
  convertCurrencyToDollar(currency: string, amount: number): Promise<number> | number
  convertDollarToCurrency(currency: string, amount: number): Promise<number> | number
  generatePrintImage(args: { id: string; shopDomain: string }): Promise<any>
  dataURLtoFile(dataUrl: string, fileName: string): any
  uploadPrintImagesToS3(files: any[], shopDomain: string): Promise<any>
  uploadFilesWithAccessToken(accessToken: string, files: any[], shop: string): Promise<any>
  getFulfillmentServiceName(appName: string, vendor: string, privateService?: boolean): string
  verifyResponse(response: any, path: string): Promise<any> | any
  requestGraphqlApi(args: any): Promise<any> | any
  queryForProductVariantMetafields(args: any): any
  convertIdsToQuery(ids: string[]): string
  isJSON(value: string): boolean
  getProviderOrNull(vendor: string): any
  getOriginalSrc(image: any): string
  fulfillFulfillmentServiceLineItems(args: any): Promise<void> | void
  FULFILLED: string
  FULFILLMENT_PROVIDERS: any
  PREFIX_VARIANT_ID: string
  PROPERTY_PREFIX: string
}

export interface PrintImageGraftDeps {
  acquireBrowser(): Promise<Browser>
  releaseBrowser(browser: Browser): Promise<void> | void
  postSlackMessage(message: string, channel: string): Promise<void> | void
  APP_URL: string | undefined
  PRINT_IMAGE_TIMEOUT_MULTIPLIER: number
  THIRTY_SECONDS: number
  PRINT_IMAGE_FAILURE_SLACK_CHANNEL: string
}

export function createImportOrderAndCustomer(deps: OrderCaptureGraftDeps) {
const {
  Order,
  Customer,
  Shop,
  PrintArea,
  ShopifySession,
  ProviderIntegration,
  Provider,
  hasRequiredScopes,
  getShopData,
  getValidPropertyNamePrefix,
  isOneTickProperty,
  convertCurrencyToDollar,
  convertDollarToCurrency,
  generatePrintImage,
  dataURLtoFile,
  uploadPrintImagesToS3,
  uploadFilesWithAccessToken,
  getFulfillmentServiceName,
  verifyResponse,
  requestGraphqlApi,
  queryForProductVariantMetafields,
  convertIdsToQuery,
  isJSON,
  getProviderOrNull,
  getOriginalSrc,
  fulfillFulfillmentServiceLineItems,
  FULFILLED,
  FULFILLMENT_PROVIDERS,
  PREFIX_VARIANT_ID,
  PROPERTY_PREFIX,
} = deps

async function importOrderAndCustomer(
  _api: ShopifyApiClient,
  payload: any,
  shopDomain: string,
  _webhook?: string
): Promise<void> {
  try {
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

    // Merge the payload
    const {
      id: orderId = '',
      customer = {},
      ...orderData
    } = { ...(payload || {}) }

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

      }

      // For subsequent updates, preserve existing print_images
      const existingLineItems = order?.line_items || []

      const updatedLineItems = orderData.line_items.map((line_item: any) => {
        const { id } = line_item

        const existingLineItem = existingLineItems.find((existingItem: any) => existingItem.id === id)

        // Preserve existing print_images if they exist
        const existingPrintImages = existingLineItem?.print_images || []

        return {
          ...line_item,
          print_images: existingPrintImages, // Keep existing print_images
        }
      })

      // Update the order without overwriting print_images
      await Order.updateOne(
        { shopDomain, id: orderId },
        { ...orderData, customer: c, line_items: updatedLineItems },
        { upsert: true }
      )

      // Only generate order image one time to prevent re-draw multiple time each order updates
      if (!order && orderData) {
        // Generate print image (now returns both PNG and SVG)
        const printImagesResult = await generatePrintImage({ shopDomain, id: orderId }).catch(console.error)

        // TODO: Instead of returning immediately and preventing order fulfillment, find another way to handle this case.
        if (!printImagesResult) return

        const session = await ShopifySession.findOne({ shop: shopDomain })
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
    }
  } catch (e) {
    console.error('Failed to import order and customer', e)
  }
}


return importOrderAndCustomer
}

export function createGraftedGeneratePrintImage(deps: PrintImageGraftDeps) {
const {
  acquireBrowser,
  releaseBrowser,
  postSlackMessage,
  APP_URL,
  PRINT_IMAGE_TIMEOUT_MULTIPLIER,
  THIRTY_SECONDS,
  PRINT_IMAGE_FAILURE_SLACK_CHANNEL,
} = deps

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


return generatePrintImage
}
