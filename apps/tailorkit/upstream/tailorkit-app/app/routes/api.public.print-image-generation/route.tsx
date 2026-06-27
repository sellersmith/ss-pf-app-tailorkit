import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { useCallback, useEffect, useRef } from 'react'
import { fetchItem, json } from '~/bootstrap/fns/fetch.server'
import Order from '~/models/Order.server'
import { catchAsync } from '~/utils/catchAsync'
import { adjustLineItemToGetPrintAreaInfo, orderListFinalPipeline, orderListPipeline } from '../api.orders/fns.server'
import { drawPrintImageOnCanvas, type PrintImageResult } from '../orders.$id/fns.client'
import { PROPERTY_PREFIX } from '../webhooks/fns.server'
import { getOptionPropertiesForPrintArea } from './fns'
import { sleep } from '~/utils/sleep'
import { FIVE_SECONDS_IN_MILLISECONDS } from '~/constants'

const CONTAINER_ID = 'canvas-container'
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = FIVE_SECONDS_IN_MILLISECONDS

/**
 * Print images result structure
 * Contains both PNG and SVG data URLs for each print area
 */
interface PrintImagesOutput {
  png: { [key: string]: string }
  svg: { [key: string]: string }
}

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url)

  const orderId = searchParams.get('orderId') || ''
  const shopDomain = searchParams.get('shopDomain')
  const secretToken = searchParams.get('secretToken')

  if (!shopDomain) {
    return json({
      success: false,
      message: 'Missing shop domain',
    })
  }

  // Validate secret token
  if (secretToken !== process.env.IMAGE_GENERATION_TOKEN) {
    return json({
      success: false,
      message: 'Invalid secret token',
    })
  }

  // Get order item
  const _order = await fetchItem(
    request,
    Order,
    [
      ...orderListPipeline,
      {
        $match: {
          id: +orderId,
          shopDomain,
        },
      },
    ],
    orderListFinalPipeline
  )

  if (!_order) {
    return json({
      success: false,
      message: 'Order is not found',
    })
  }

  // Get api to null because we don't need to get product information while extracting print images
  const api: any = null

  const _orders = _order ? [_order] : []

  const order = (await adjustLineItemToGetPrintAreaInfo(_orders, shopDomain, api))[0]

  if (!order) {
    return json({
      success: false,
      message: 'Order is not found',
    })
  }

  return json({ success: true, order, shopDomain, PROPERTY_PREFIX })
})

export default function Index() {
  const loaderData = useLoaderData<typeof loader>()
  const containerRef = useRef<HTMLDivElement>(null)

  const { order, shopDomain, PROPERTY_PREFIX } = loaderData

  const generatePrintImages = useCallback(
    async (order: any): Promise<PrintImagesOutput> => {
      const pngImages: { [key: string]: string } = {}
      const svgImages: { [key: string]: string } = {}

      for (const item of order.line_items) {
        const { properties, variant_id, integration, fulfillment_order_data, id: itemId } = item
        // Get template data
        const { variants } = integration || {}
        const { print_areas } = fulfillment_order_data || {}
        const variantTemplate = variants?.find((variant: any) => variant.id.indexOf(variant_id) > -1)

        // Group print options by print area and option set
        const { printAreaIds, groupedOptions } = getOptionPropertiesForPrintArea({
          integration,
          PROPERTY_PREFIX,
          properties,
          variantId: variant_id,
        })

        // Draw all print image of each print area
        await Promise.all(
          Object.keys(groupedOptions).map(async (printAreaLabel: string, index: number) => {
            const printArea = variantTemplate?.printAreas?.find(
              (printArea: any) => printArea._id === printAreaIds[index]
            )

            const printAreaVariant = print_areas?.[index]?.[printAreaLabel]
            const { _id, template } = printArea || {}
            const templateId = template?._id

            if (!templateId) return

            const result: PrintImageResult = await drawPrintImageOnCanvas({
              _id,
              containerId: CONTAINER_ID,
              properties,
              templateConfig: template,
              PROPERTY_PREFIX,
              printAreaDimension: printAreaVariant?.placeholder || printArea.template.dimension,
              generateSvg: true, // Enable SVG generation
            })

            const key = `${itemId}.${_id}`

            if (result.png) {
              pngImages[key] = result.png
            }

            if (result.svg) {
              svgImages[key] = result.svg
            }
          })
        )
      }

      return { png: pngImages, svg: svgImages }
    },
    [PROPERTY_PREFIX]
  )

  const generatePrintImagesWithRetry = useCallback(
    async (order: any) => {
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const printImages = await generatePrintImages(order)
          // Set print images to global variable for accessing from waitForFunction in server side
          // Now contains both png and svg objects
          window.printImages = printImages
          return
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          console.error(`Print image generation attempt ${attempt}/${MAX_RETRIES} failed:`, error)

          if (attempt < MAX_RETRIES) {
            const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
            console.log(`Retrying in ${delayMs}ms...`)
            await sleep(delayMs)
          }
        }
      }

      // All retries failed - signal error to server
      window.printImages = {
        error: true,
        message: lastError?.message || 'Print image generation failed after all retries',
      }
    },
    [generatePrintImages]
  )

  useEffect(() => {
    if (!containerRef.current) return

    if (!order) return

    generatePrintImagesWithRetry(order)
  }, [order, generatePrintImagesWithRetry])

  const isValidPrintContainer = order && shopDomain

  return <div id={CONTAINER_ID} ref={containerRef} data-validation={isValidPrintContainer}></div>
}
