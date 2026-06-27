import mongoose, { type PipelineStage } from 'mongoose'
import Order from './Order.server'
import { type AnalyticsTemplateDocument } from './AnalyticsTemplate'
import Integration from './Integration.server'
import VariantIntegration from './VariantIntegration.server'
import PrintArea from './PrintArea.server'
import { PREFIX_VARIANT_ID } from '~/constants/shopify'
import { getExchangeRatesToUSD } from '~/utils/exchange-rates'
import { getTotalRevenues, pipelineGetShopConfigAndAddCurrency } from './AnalyticsRevenue.server'

const AnalyticsTemplateSchema = new mongoose.Schema<AnalyticsTemplateDocument>(
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
    templates: [
      {
        templateId: {
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

const AnalyticsTemplate
  = mongoose.models.AnalyticsTemplate
  || mongoose.model<AnalyticsTemplateDocument>('AnalyticsTemplate', AnalyticsTemplateSchema)

export default AnalyticsTemplate

/**
 * @author KhanhNT
 * Asynchronously aggregates and updates analytics data for templates in orders.
 *
 * @param {PipelineStage[]} [conditionAggregate] - Optional MongoDB aggregation pipeline stages for filtering.
 *
 * This function performs the following tasks:
 * 1. Aggregates template-related data from the `Order` collection, including line item information.
 * 2. Adds shop configuration and currency data through `pipelineGetShopConfigAndAddCurrency`.
 * 3. Unwinds `line_items` to process each line item individually.
 * 4. Sets a `variantId` for each line item by concatenating a prefix with the string version of `variant_id`.
 * 5. Looks up the integration details for each line item variant from the `Integration` collection.
 * 6. Looks up the variant integration details (including print areas) from the `VariantIntegration` collection.
 * 7. Looks up print area templates from the `PrintArea` collection.
 * 8. Groups data by the `createdAt` field, calculates total revenues, the number of orders, and aggregates templates used.
 * 9. Projects specific fields such as `populateDate`, `totalRevenues`, `numOrders`, `templates`, `shopDomain`, and `currencyShop`.
 * 10. Fetches the current exchange rates to USD from `getExchangeRatesToUSD`.
 * 11. Converts the total revenues into a standard currency format using `getTotalRevenues`.
 * 12. Performs bulk updates or inserts (`upsert`) in the `AnalyticsTemplate` collection.
 *
 * If any errors occur during the aggregation or database operations, they are logged to the console.
 */
export async function populateAnalyticsTemplates(conditionAggregate?: PipelineStage[]) {
  try {
    const analyticsTemplates = await Order.aggregate([
      ...(conditionAggregate ? conditionAggregate : []),
      ...pipelineGetShopConfigAndAddCurrency(),
      { $unwind: '$line_items' },
      {
        $set: {
          'line_items.variantId': {
            $concat: [PREFIX_VARIANT_ID, { $toString: { $toLong: '$line_items.variant_id' } }],
          },
        },
      },
      {
        $lookup: {
          from: Integration.collection.collectionName,
          let: { variantId: '$line_items.variantId' },
          pipeline: [{ $match: { $expr: { $in: ['$$variantId', '$variants'] } } }, { $project: { _id: 1 } }],
          as: 'line_items.integration',
        },
      },
      { $set: { 'line_items.integration': { $arrayElemAt: ['$line_items.integration', 0] } } },
      {
        $lookup: {
          from: VariantIntegration.collection.collectionName,
          let: { variantId: '$line_items.variantId' },
          pipeline: [{ $match: { $expr: { $eq: ['$$variantId', '$id'] } } }, { $project: { _id: 1, printAreas: 1 } }],
          as: 'line_items.variantIntegration',
        },
      },
      { $unwind: { path: '$line_items.variantIntegration', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: PrintArea.collection.collectionName,
          let: { printAreaIds: { $ifNull: ['$line_items.variantIntegration.printAreas', []] } },
          pipeline: [
            {
              $match: {
                $and: [{ $expr: { $in: ['$_id', '$$printAreaIds'] } }, { template: { $ne: null } }],
              },
            },
            {
              $project: { template: 1 },
            },
          ],
          as: 'line_items.printAreas',
        },
      },
      {
        $group: {
          _id: '$createdAt',
          populateDate: { $first: '$createdAt' },
          allTemplates: {
            $push: {
              $map: {
                input: '$line_items.printAreas.template',
                as: 'templateId',
                in: {
                  templateId: '$$templateId',
                  quantity: '$line_items.quantity',
                  totalPrice: {
                    $multiply: [
                      { $toDouble: '$line_items.price_set.shop_money.amount' },
                      { $toDouble: '$line_items.quantity' },
                    ],
                  },
                  currency: '$currency',
                },
              },
            },
          },
          shopDomain: { $first: '$shopDomain' },
          currencyShop: { $first: '$currencyShop' },
        },
      },
      {
        $set: {
          templates: {
            $reduce: {
              input: '$allTemplates',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          populateDate: 1,
          numOrders: 1,
          templates: 1,
          shopDomain: 1,
          currencyShop: 1,
        },
      },
    ])
    const exchangeRates = await getExchangeRatesToUSD()

    await AnalyticsTemplate.bulkWrite(
      analyticsTemplates.map(
        (
          data: Omit<AnalyticsTemplateDocument, 'templates'> & {
            currencyShop: string
            templates: { currency: string; totalPrice: number; quantity: number; templateId: string }[]
          }
        ) => {
          const { templates, currencyShop, shopDomain, populateDate, ...restData } = data
          const _templates = templates.map(template => ({
            ...template,
            totalPrice: getTotalRevenues({
              currencyShop,
              totalRevenues: {
                currency: template.currency,
                total_price: template.totalPrice,
              },
              exchangeRates,
            }),
          }))

          return {
            updateOne: {
              filter: { shopDomain, populateDate },
              update: {
                ...restData,
                templates: _templates,
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
    console.error('Error aggregating AnalyticsTemplate data:', error)
  }
}
