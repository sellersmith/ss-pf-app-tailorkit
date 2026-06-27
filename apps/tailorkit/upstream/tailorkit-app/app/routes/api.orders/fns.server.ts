import type { LoaderFunctionArgs } from '@remix-run/node'
import type { PipelineStage } from 'mongoose'
import { fetchList } from '~/bootstrap/fns/fetch.server'
import Customer from '~/models/Customer.server'
import Integration, { getDetailIntegration } from '~/models/Integration.server'
import Order from '~/models/Order.server'
import { canUseFreeResources } from '~/models/PricingPlan.fns'
import Shop, { getShopData } from '~/models/Shop.server'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { fulfillFulfillmentServiceLineItems } from '../webhooks/fns/fulfillFulfillmentServiceLineItems.server'
import { FULFILLED } from '~/constants/fulfillment-providers'

export const orderListPipeline = [
  {
    $project: {
      id: 1,
      name: 1,
      currency: 1,
      customer: 1,
      created_at: 1,
      line_items: 1,
      shopDomain: 1,
      total_price: 1,
      order_number: 1,
      billing_address: 1,
      shipping_address: 1,
      shipping_lines: 1,
      financial_status: 1,
      fulfillment_status: 1,
      displayFulfillmentStatus: 1,
      fulfillmentOrders: 1,
      appGeneratedRevenue: 1,
      appGeneratedRevenueInOrderCurrency: 1,
      appGeneratedRevenueInShopCurrency: 1,
    },
  },
  {
    $set: {
      total_price: {
        $toDouble: {
          $ifNull: ['$total_price', 0],
        },
      },
      fulfillment_status: {
        $ifNull: ['$displayFulfillmentStatus', '$fulfillment_status'],
      },
      appGeneratedRevenue: {
        $ifNull: ['$appGeneratedRevenue', 0],
      },
      appGeneratedRevenueInOrderCurrency: {
        $ifNull: ['$appGeneratedRevenueInOrderCurrency', 0],
      },
      appGeneratedRevenueInShopCurrency: {
        $ifNull: ['$appGeneratedRevenueInShopCurrency', 0],
      },
    },
  },
]

export const orderListFinalPipeline = [
  {
    $unwind: '$line_items',
  },
  {
    $lookup: {
      from: Customer.collection.collectionName,
      localField: 'customer',
      foreignField: '_id',
      as: 'customer',
    },
  },
  {
    $unwind: '$customer',
  },
  {
    $lookup: {
      from: Integration.collection.collectionName,
      let: {
        variantId: {
          $concat: [
            'gid://shopify/ProductVariant/',
            {
              $toString: { $toLong: '$line_items.variant_id' },
            },
          ],
        },
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $in: ['$$variantId', '$variants'],
            },
          },
        },
        {
          $project: {
            _id: 1,
          },
        },
      ],
      as: 'line_items.integration',
    },
  },
  {
    $set: {
      'line_items.integration': {
        $arrayElemAt: ['$line_items.integration', 0],
      },
    },
  },
  {
    $group: {
      _id: '$_id',
      id: {
        $last: '$id',
      },
      name: {
        $last: '$name',
      },
      currency: {
        $last: '$currency',
      },
      customer: {
        $last: '$customer',
      },
      created_at: {
        $last: '$created_at',
      },
      total_price: {
        $last: '$total_price',
      },
      appGeneratedRevenue: {
        $last: '$appGeneratedRevenue',
      },
      appGeneratedRevenueInOrderCurrency: {
        $last: '$appGeneratedRevenueInOrderCurrency',
      },
      appGeneratedRevenueInShopCurrency: {
        $last: '$appGeneratedRevenueInShopCurrency',
      },
      order_number: {
        $last: '$order_number',
      },
      billing_address: {
        $last: '$billing_address',
      },
      shipping_address: {
        $last: '$shipping_address',
      },
      shipping_lines: {
        $last: '$shipping_lines',
      },
      financial_status: {
        $last: '$financial_status',
      },
      fulfillment_status: {
        $last: '$fulfillment_status',
      },
      fulfillmentOrders: {
        $last: '$fulfillmentOrders',
      },
      line_items: {
        $addToSet: '$line_items',
      },
    },
  },
]

/**
 * Count paid orders by shop domain
 *
 * @param shopDomain
 * @returns
 */
export async function countPaidOrdersByShopDomain(shopDomain: string) {
  const numPaidOrders = await Order.countDocuments({
    shopDomain,
    financial_status: 'paid',
    fulfillment_status: { $ne: FULFILLED },
  })

  return numPaidOrders
}

export async function adjustLineItemToGetPrintAreaInfo(items: any[] | null, shop: string, api?: any) {
  if (!items?.length) return []

  // We only enrich when exactly one order is returned (detail view)
  if (items.length === 1) {
    const order = items[0]
    const lineItems = order.line_items || []

    // 1. Collect unique integration and product ids
    const integrationIds = Array.from(
      new Set<string>(lineItems.filter((li: any) => li?.integration?._id).map((li: any) => String(li.integration._id)))
    )

    const productIds = api
      ? Array.from(
          new Set<string>(lineItems.filter((li: any) => li?.product_id).map((li: any) => String(li.product_id)))
        )
      : []

    // 2. Fetch integrations + products in parallel
    const [integrations, products] = await Promise.all([
      Promise.all(
        integrationIds.map(_id =>
          getDetailIntegration({
            shopDomain: shop,
            populateTemplate: true,
            _id,
          })
        )
      ),
      api ? api.getProductsByIds(productIds) : Promise.resolve([]),
    ])

    // 3. Build lookup maps for quick assignment
    const integrationMap = new Map(integrations.map((int: any) => [String(int._id), int]))
    const productMap = new Map(products.map((p: any) => [String(p.id).replace(/gid:\/\/shopify\/Product\//, ''), p]))

    // 4. Assign enriched data to each line item
    for (const li of lineItems) {
      if (li?.integration?._id) {
        li.integration = integrationMap.get(String(li.integration._id)) || li.integration
      }

      if (api && li?.product_id) {
        li.product = productMap.get(String(li.product_id)) || null
      }
    }
  }

  return items
}

/**
 * Fetch order list utility
 * @param {LoaderFunctionArgs['request']} request
 * @param {string} shop
 * @param {ShopifyAPI} api
 * @returns
 */
export async function fetchOrderList(request: LoaderFunctionArgs['request'], shop: string, api?: any) {
  // Get sort option
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort')
  const [sortBy, sortDir] = sort?.split('__') || []

  const t1 = performance.now()
  const { page, items, total } = await fetchList(request, Order, orderListPipeline, [
    ...orderListFinalPipeline,
    ...(sortBy
      ? ([
          {
            $sort: {
              [sortBy as string]: sortDir?.toLowerCase() === 'desc' ? -1 : 1,
            },
          },
        ] as PipelineStage[])
      : []),
  ])

  const _items = await adjustLineItemToGetPrintAreaInfo(items, shop, api)
  const t2 = performance.now()

  return { page, items: _items, total, totalExecutionTimeInMs: t2 - t1 }
}

/**
 * Request fulfill order to fulfillment service
 *
 * @param args { shopDomain, api, selectedResources, vendor }
 */
export async function requestFulfillOrder(args: {
  shopDomain: string
  api: ShopifyApiClient
  selectedResources: string[]
  vendor: string
  /**
   * Condition for checking if we should fulfill order to fulfillment service or not
   * We only fulfill via "Request fulfillment" webhook or auto fullfil
   */
  shouldFulfill?: boolean
}) {
  const { shopDomain, api, ...rest } = args
  try {
    // Get shop data
    const shopData = await getShopData(shopDomain)

    if (shopData) {
      const numProcessedOrders = shopData.usages?.orders || 0
      const monthlyFreeOrders = canUseFreeResources({ shopData }) as number
      const subscription = shopData?.subscription as SubscriptionDocument

      // TODO: Fulfill the selected orders if the following conditions match:
      // - Merchants still have monthly free orders remaining.
      // - Merchants haven't reached their manual-set capped amount.
      // - The `financial_status` of the order is `paid`.
      // - The `fulfillment_status` of the order is `pending`.
      // - Ordered products are imported from a fulfillment provider.
      if (
        // Check monthly free orders
        monthlyFreeOrders
        // Check user capped amount
        && !subscription.reachedUserCappedAmount
      ) {
        // Get data for the selected orders
        const orders = await Order.find({ shopDomain, id: { $in: rest.selectedResources } })

        for (let i = 0; i < orders.length; i++) {
          const order = orders[i].toObject()

          // Bulk action for fulfilling line_items in order
          await fulfillFulfillmentServiceLineItems({
            order,
            shopDomain,
            shopData: null,
            api,
            specificOrder: rest.vendor,
            shouldFulfill: rest.shouldFulfill,
          }).catch(console.error)

          // Count order usage
          // if (++numProcessedOrders >= monthlyFreeOrders) {
          //   break
          // }
        }

        // Update shop usages
        await Shop.updateOne({ shopDomain }, { usages: { ...shopData.usages, orders: numProcessedOrders } })
      }
    }
  } catch (e) {
    console.error('Failed to request fulfill order')

    throw new Error(formatErrorMessage(e))
  }
}
