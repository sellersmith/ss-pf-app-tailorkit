import mongoose, { type PipelineStage } from 'mongoose'
import { type AnalyticsRevenuesDocument } from './AnalyticsRevenue'
import Order from './Order.server'
import Shop from './Shop.server'
import { getExchangeRatesToUSD } from '~/utils/exchange-rates'

const AnalyticsRevenueSchema = new mongoose.Schema<AnalyticsRevenuesDocument>(
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
    totalRevenues: {
      type: Number,
      index: true,
    },
    numOrders: {
      type: Number,
      index: true,
    },
  },
  { timestamps: true }
)

const AnalyticsRevenue
  = mongoose.models.AnalyticsRevenue
  || mongoose.model<AnalyticsRevenuesDocument>('AnalyticsRevenue', AnalyticsRevenueSchema)

export default AnalyticsRevenue

// Define the pipeline as a function instead of a constant to ensure Shop is initialized
export const pipelineGetShopConfigAndAddCurrency = () => [
  {
    $project: {
      createdAt: 1,
      currency: 1,
      line_items: 1,
      total_price: {
        $cond: {
          if: { $isNumber: '$appGeneratedRevenueInShopCurrency' },
          then: '$appGeneratedRevenueInShopCurrency',
          else: { $toDouble: '$appGeneratedRevenueInShopCurrency' },
        },
      },
      shopDomain: 1,
    },
  },
  {
    $lookup: {
      from: Shop.collection.collectionName,
      let: { shopDomain: '$shopDomain' },
      pipeline: [
        { $match: { $expr: { $eq: ['$$shopDomain', '$shopDomain'] } } },
        { $project: { shopConfig: 1 } },
        { $set: { currencyShop: '$shopConfig.currency' } },
      ],
      as: 'shopConfig',
    },
  },
  { $unwind: '$shopConfig' },
  {
    $set: {
      currencyShop: '$shopConfig.currencyShop',
    },
  },
]

export const getTotalRevenues = (args: {
  currencyShop: string
  totalRevenues: { currency: string; total_price: number }
  exchangeRates: IExchangeRates | null
}) => {
  const { currencyShop, exchangeRates, totalRevenues } = args
  const { currency, total_price } = totalRevenues || {}

  if (exchangeRates && currency && total_price && currencyShop) {
    const exchangeRateCurrency = exchangeRates[currency].value
    const exchangeRateCurrencyShop = exchangeRates[currencyShop].value

    return (exchangeRateCurrencyShop / exchangeRateCurrency) * total_price
  }

  return total_price
}

/**
 * @author KhanhNT
 * Asynchronously aggregates and updates analytics revenue data for orders.
 *
 * @param {PipelineStage[]} [conditionAggregate] - Optional MongoDB aggregation pipeline stages for filtering.
 *
 * This function performs the following tasks:
 * 1. Retrieves aggregated revenue data from the `Order` collection.
 * 2. Adds shop configuration and currency data through `pipelineGetShopConfigAndAddCurrency`.
 * 3. Groups data by the `createdAt` field and calculates total revenues and order count.
 * 4. Projects specific fields such as `populateDate`, `totalRevenues`, `numOrders`, `shopDomain`, and `currencyShop`.
 * 5. Fetches the current exchange rates to USD from `getExchangeRatesToUSD`.
 * 6. Converts the total revenues into a standard currency format using `getTotalRevenues`.
 * 7. Performs bulk updates or inserts (`upsert`) in the `AnalyticsRevenue` collection.
 *
 * If any errors occur during the aggregation or database operations, they are logged to the console.
 */
export async function populateAnalyticsRevenues(conditionAggregate?: PipelineStage[]) {
  try {
    const revenues = await Order.aggregate([
      ...(conditionAggregate ? conditionAggregate : []),
      ...pipelineGetShopConfigAndAddCurrency(),
      {
        $group: {
          _id: '$createdAt',
          populateDate: { $first: '$createdAt' },
          totalRevenues: { $first: { currency: '$currency', total_price: '$total_price' } },
          numOrders: { $sum: 1 },
          shopDomain: { $first: '$shopDomain' },
          currencyShop: { $first: '$currencyShop' },
        },
      },
      {
        $project: {
          _id: 0,
          populateDate: 1,
          totalRevenues: 1,
          numOrders: 1,
          shopDomain: 1,
          currencyShop: 1,
        },
      },
    ])

    const exchangeRates = await getExchangeRatesToUSD()

    await AnalyticsRevenue.bulkWrite(
      revenues.map(
        (
          data: Omit<AnalyticsRevenuesDocument, 'totalRevenues'> & {
            currencyShop: string
            totalRevenues: { currency: string; total_price: number }
          }
        ) => {
          const { totalRevenues, currencyShop, shopDomain, populateDate, ...restData } = data
          const _totalRevenues = getTotalRevenues({
            currencyShop,
            totalRevenues,
            exchangeRates,
          })

          return {
            updateOne: {
              filter: { shopDomain, populateDate },
              update: {
                ...restData,
                shopDomain,
                populateDate,
                totalRevenues: _totalRevenues,
              },
              upsert: true,
            },
          }
        }
      )
    )
  } catch (error) {
    console.error('Error aggregating AnalyticsRevenue data:', error)
  }
}
