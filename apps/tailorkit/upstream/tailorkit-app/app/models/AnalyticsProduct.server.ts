import mongoose, { type PipelineStage } from 'mongoose'
import Order from './Order.server'
import { type AnalyticsProductDocument } from './AnalyticsProduct'
import { getExchangeRatesToUSD } from '~/utils/exchange-rates'
import { getTotalRevenues, pipelineGetShopConfigAndAddCurrency } from './AnalyticsRevenue.server'
import { PROPERTY_PREFIX } from '~/routes/webhooks/fns.server'

const AnalyticsProductSchema = new mongoose.Schema<AnalyticsProductDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    populateDate: {
      type: Date,
      index: true,
    },
    numOrders: {
      type: Number,
      index: true,
    },
    products: [
      {
        productId: {
          type: String,
          index: true,
        },
        productTitle: {
          type: String,
          index: true,
        },
        quantity: {
          type: Number,
          index: true,
        },
        totalPrice: {
          type: Number,
          index: true,
        },
      },
    ],
  },
  { timestamps: true }
)

const AnalyticsProduct
  = mongoose.models.AnalyticsProduct
  || mongoose.model<AnalyticsProductDocument>('AnalyticsProduct', AnalyticsProductSchema)

export default AnalyticsProduct

/**
 * @author KhanhNT
 * Asynchronously aggregates and updates analytics product data for orders.
 *
 * @param {PipelineStage[]} [conditionAggregate] - Optional MongoDB aggregation pipeline stages for filtering.
 *
 * This function performs the following tasks:
 * 1. Aggregates product-related data from the `Order` collection.
 * 2. Unwinds the `line_items` array to process each product in the order separately.
 * 3. Groups the data by the order's `createdAt` field, collecting product details like ID, title, quantity, and price.
 * 4. Projects only the necessary fields such as `populateDate`, `products`, `numOrders`, `shopDomain`, and `currencyShop`.
 * 5. Converts product prices to USD using the current exchange rates from `getExchangeRatesToUSD`.
 * 6. Updates or inserts (`upsert`) the aggregated data into the `AnalyticsProduct` collection.
 * 7. Logs errors to the console if they occur during the aggregation or database operations.
 */
export async function populateAnalyticsProducts(conditionAggregate?: PipelineStage[]) {
  try {
    const analyticsProducts = await Order.aggregate([
      ...(conditionAggregate ? conditionAggregate : []),
      ...pipelineGetShopConfigAndAddCurrency(),
      { $unwind: '$line_items' },
      {
        $match: {
          'line_items.properties': {
            $elemMatch: {
              name: { $regex: `^_${PROPERTY_PREFIX}` },
            },
          },
        },
      },
      {
        $group: {
          _id: '$createdAt',
          populateDate: { $first: '$createdAt' },
          numOrders: { $sum: 1 },
          products: {
            $addToSet: {
              productId: '$line_items.product_id',
              productTitle: '$line_items.title',
              quantity: '$line_items.quantity',
              totalPrice: {
                $multiply: [{ $toDouble: '$line_items.price_set.shop_money.amount' }, '$line_items.quantity'],
              },
              currency: '$currency',
            },
          },
          shopDomain: { $first: '$shopDomain' },
          currencyShop: { $first: '$currencyShop' },
        },
      },
      {
        $project: {
          _id: 0,
          populateDate: 1,
          numOrders: 1,
          products: 1,
          shopDomain: 1,
          currencyShop: 1,
        },
      },
    ])

    const exchangeRates = await getExchangeRatesToUSD()

    await AnalyticsProduct.bulkWrite(
      analyticsProducts.map(
        (
          data: Omit<AnalyticsProductDocument, 'products'> & {
            currencyShop: string
            products: {
              productId: string
              productTitle: string
              quantity: number
              totalPrice: number
              currency: string
            }[]
          }
        ) => {
          const { products, currencyShop, shopDomain, populateDate, ...restData } = data

          const _products = products.map(product => ({
            ...product,
            totalPrice: getTotalRevenues({
              currencyShop,
              totalRevenues: {
                currency: product.currency,
                total_price: product.totalPrice,
              },
              exchangeRates,
            }),
          }))

          return {
            updateOne: {
              filter: { shopDomain, populateDate },
              update: {
                ...restData,
                products: _products,
                shopDomain,
                populateDate,
              },
              upsert: true,
            },
          }
        }
      )
    )
  } catch (error) {
    console.error('Error aggregating AnalyticsProduct data:', error)
  }
}
