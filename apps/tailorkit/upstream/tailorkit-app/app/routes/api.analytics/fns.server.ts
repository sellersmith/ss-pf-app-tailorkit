import AnalyticsProduct from '~/models/AnalyticsProduct.server'
import AnalyticsRevenue from '~/models/AnalyticsRevenue.server'
import AnalyticsTemplate from '~/models/AnalyticsTemplate.server'
import Order from '~/models/Order.server'
import Template from '~/models/Template.server'

const sumValues = (array: any[]) => {
  const sum = array.reduce((sum, revenue) => sum + revenue.value, 0)

  return Math.round(sum * 100) / 100
}

// Helper function to create the template aggregation pipeline for revenue/analytics data
const createTemplateAggregationPipeline = (
  fieldName: string,
  shopDomain: string,
  dateRange: { startDate: string; endDate: string }
) => {
  return [
    {
      $project: {
        populateDate: { $dateToString: { date: '$populateDate' } },
        shopDomain: 1,
        templates: 1,
        numOrders: 1,
      },
    },
    {
      $match: {
        shopDomain,
        populateDate: {
          $gte: new Date(dateRange.startDate).toISOString(),
          $lte: new Date(dateRange.endDate).toISOString(),
        },
      },
    },
    {
      $unwind: '$templates',
    },
    {
      $lookup: {
        from: Template.collection.collectionName,
        let: { templateId: '$templates.templateId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$$templateId', '$_id'],
              },
            },
          },
          { $project: { _id: 1, name: 1 } },
        ],
        as: fieldName, // Include template information in the result
      },
    },
    // Check if the template is not existing, add name and _id for it
    {
      $addFields: {
        [fieldName]: {
          $cond: {
            if: { $eq: [{ $size: `$${fieldName}` }, 0] },
            then: { _id: '$templates.templateId', name: '' },
            else: { $arrayElemAt: [`$${fieldName}`, 0] },
          },
        },
      },
    },
  ]
}

const getGroupTemplateProperties = (fieldName: string) => ({
  _id: { templateId: `$${fieldName}._id`, templateName: `$${fieldName}.name` },
  populateDate: { $first: '$populateDate' },
})

// Helper function to create the product aggregation pipeline for revenue/analytics data
const createProductAggregationPipeline = (
  shopDomain: string,
  dateRange: { startDate: string; endDate: string },
  populateRevenue = false
) => {
  return [
    {
      $project: {
        populateDate: { $dateToString: { date: '$populateDate' } },
        shopDomain: 1,
        products: 1,
        ...(populateRevenue
          ? {
              totalRevenues: {
                $cond: {
                  if: { $isNumber: '$totalRevenues' },
                  then: '$totalRevenues',
                  else: { $toDouble: '$totalRevenues' }, // Ensure totalRevenues is a number
                },
              },
            }
          : {}),
      },
    },
    {
      $match: {
        shopDomain,
        populateDate: {
          $gte: new Date(dateRange.startDate).toISOString(),
          $lte: new Date(dateRange.endDate).toISOString(),
        },
      },
    },
  ]
}

const getGroupProductProperties = (fieldName: string) => ({
  _id: { productId: `$${fieldName}.productId`, productTitle: `$${fieldName}.productTitle` },
  populateDate: { $first: '$populateDate' },
})

// Function to get the number of orders in a date range
export const getNumberOfOrdersData = async (
  shopDomain: string,
  { startDate, endDate }: { startDate: string; endDate: string }
) => {
  try {
    const orders = await Order.aggregate([
      { $project: { createdAt: { $dateToString: { date: '$createdAt' } }, shopDomain: 1 } },
      {
        $match: {
          shopDomain,
          createdAt: { $gte: new Date(startDate).toISOString(), $lte: new Date(endDate).toISOString() },
        },
      },
      { $group: { _id: '$createdAt', createdAt: { $first: '$createdAt' }, value: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    const totalOrders = sumValues(orders)

    return { total: totalOrders, items: orders }
  } catch (error) {
    console.error('Error fetching orders data:', error)
    return { total: 0, items: [] }
  }
}

// Function to get total revenue data for a shop in a date range
export const getRevenueData = async (
  shopDomain: string,
  { startDate, endDate }: { startDate: string; endDate: string }
) => {
  try {
    const revenues = await AnalyticsRevenue.aggregate([
      {
        $project: {
          populateDate: { $dateToString: { date: '$populateDate' } },
          shopDomain: 1,
          totalRevenues: {
            $cond: {
              if: { $isNumber: '$totalRevenues' },
              then: '$totalRevenues',
              else: { $toDouble: '$totalRevenues' },
            },
          },
        },
      },
      {
        $match: {
          shopDomain,
          populateDate: { $gte: new Date(startDate).toISOString(), $lte: new Date(endDate).toISOString() },
        },
      },
      { $group: { _id: '$populateDate', createdAt: { $first: '$populateDate' }, value: { $sum: '$totalRevenues' } } },
      { $sort: { _id: 1 } },
    ])
    const totalRevenue = sumValues(revenues)
    return { total: totalRevenue, items: revenues }
  } catch (error) {
    console.error('Error fetching revenue data:', error)
    return { total: 0, items: [] }
  }
}

const templateNameFormatPipeline = {
  $cond: {
    if: { $eq: ['$_id.templateName', ''] },
    then: { $concat: ['$_id.templateId', ' (template deleted)'] },
    else: { $concat: ['$_id.templateName', ' (', '$_id.templateId', ')'] },
  },
}

// Function to get templates ordered by number of orders
export const getTemplatesByOrders = async (
  shopDomain: string,
  { startDate, endDate }: { startDate: string; endDate: string }
) => {
  const fieldName = 'templateInfo'

  try {
    const templatesByOrders = await AnalyticsTemplate.aggregate([
      ...createTemplateAggregationPipeline(fieldName, shopDomain, { startDate, endDate }),
      {
        $group: {
          ...getGroupTemplateProperties(fieldName),
          totalQuantity: { $sum: { $toDouble: '$templates.quantity' } },
          data: { $addToSet: { createdAt: '$populateDate', value: { $sum: { $toDouble: '$templates.quantity' } } } },
        },
      },
      { $sort: { totalQuantity: -1 } },
      {
        $project: {
          _id: 0,
          name: {
            ...templateNameFormatPipeline,
          },
          value: '$totalQuantity',
          data: 1,
        },
      },
      { $sort: { value: 1 } },
    ])

    const totalTemplatesByOrders = sumValues(templatesByOrders)
    return { total: totalTemplatesByOrders, items: templatesByOrders }
  } catch (error) {
    console.error('Error fetching templates by orders:', error)
    return { total: 0, items: [] }
  }
}

// Function to get templates ordered by revenue
export const getTemplatesByRevenues = async (
  shopDomain: string,
  { startDate, endDate }: { startDate: string; endDate: string }
) => {
  const fieldName = 'templateInfo'

  try {
    const templatesByRevenues = await AnalyticsTemplate.aggregate([
      ...createTemplateAggregationPipeline(fieldName, shopDomain, { startDate, endDate }),
      {
        $group: {
          ...getGroupTemplateProperties(fieldName),
          totalRevenues: { $sum: '$templates.totalPrice' },
          data: { $addToSet: { createdAt: '$populateDate', value: { $sum: '$templates.totalPrice' } } },
        },
      },
      { $sort: { totalRevenues: -1 } },
      {
        $project: {
          _id: 0,
          name: {
            ...templateNameFormatPipeline,
          },
          value: '$totalRevenues',
          data: 1,
        },
      },
      { $sort: { value: 1 } },
    ])
    const totalTemplatesByRevenues = sumValues(templatesByRevenues)
    return { total: totalTemplatesByRevenues, items: templatesByRevenues }
  } catch (error) {
    console.error('Error fetching templates by revenues:', error)
    return { total: 0, items: [] }
  }
}

const productNameFormatPipeline = {
  $concat: ['$_id.productTitle', ' (', '$_id.productId', ')'],
}

// Function to get products ordered by orders
export const getProductsByOrders = async (
  shopDomain: string,
  { startDate, endDate }: { startDate: string; endDate: string }
) => {
  const fieldName = 'products'

  try {
    const productsByOrders = await AnalyticsProduct.aggregate([
      ...createProductAggregationPipeline(shopDomain, { startDate, endDate }),
      { $unwind: `$${fieldName}` },
      {
        $group: {
          ...getGroupProductProperties(fieldName),
          totalOrders: { $sum: `$${fieldName}.quantity` },
          data: { $addToSet: { createdAt: '$populateDate', value: { $sum: `$${fieldName}.quantity` } } },
        },
      },
      { $sort: { totalOrders: -1 } },
      {
        $project: {
          _id: 0,
          name: {
            ...productNameFormatPipeline,
          },
          value: '$totalOrders',
          data: 1,
        },
      },
      { $sort: { value: 1 } },
    ])

    const totalProductByOrders = sumValues(productsByOrders)
    return { total: totalProductByOrders || 0, items: productsByOrders }
  } catch (error) {
    console.error('Error fetching product by orders:', error)
    return { total: 0, items: [] }
  }
}

// Function to get products revenues by orders
export const getProductsByRevenues = async (
  shopDomain: string,
  { startDate, endDate }: { startDate: string; endDate: string }
) => {
  try {
    const fieldName = 'products'

    const productsByRevenues = await AnalyticsProduct.aggregate([
      ...createProductAggregationPipeline(shopDomain, { startDate, endDate }, true),
      { $unwind: `$${fieldName}` },
      {
        $group: {
          ...getGroupProductProperties(fieldName),
          totalRevenues: { $sum: `$${fieldName}.totalPrice` },
          data: { $addToSet: { createdAt: '$populateDate', value: { $sum: `$${fieldName}.totalPrice` } } },
        },
      },
      { $sort: { totalRevenues: -1 } },
      {
        $project: {
          _id: 0,
          name: {
            ...productNameFormatPipeline,
          },
          value: '$totalRevenues',
          data: 1,
        },
      },
      { $sort: { value: 1 } },
    ])

    const totalProductsByRevenues = sumValues(productsByRevenues)
    return { total: totalProductsByRevenues, items: productsByRevenues }
  } catch (error) {
    console.error('Error fetching product by orders:', error)
    return { total: 0, items: [] }
  }
}
