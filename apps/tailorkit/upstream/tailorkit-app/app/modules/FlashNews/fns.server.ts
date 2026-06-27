import Integration from '~/models/Integration.server'
import Mockup from '~/models/Mockup.server'
import Shop from '~/models/Shop.server'
import ShopifySession from '~/models/ShopifySession.server'
import { requestGraphqlApi } from '~/shopify/graphql/fns.server'

export async function getFlashNews() {
  const isProductionEnv = (process.env.HOST || process.env.SHOPIFY_APP_URL)?.match(/^https?:\/\/tailorkit\.ecomate\.co/)

  // Query for personalized product created in the last 24-hour
  const news = await Integration.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: isProductionEnv ? 100 : 10 },
    {
      $lookup: {
        from: Shop.collection.collectionName,
        localField: 'shopDomain',
        foreignField: 'shopDomain',
        as: 'shop',
      },
    },
    { $unwind: '$shop' },
    ...(isProductionEnv
      ? [
          {
            $match: {
              'shop.shopConfig.plan_display_name': {
                $in: ['Advanced', 'Basic', 'Grow', 'Shopify', 'Shopify Plus', 'Trial', 'Plus Trial'],
              },
            },
          },
        ]
      : []),
    {
      $lookup: {
        from: ShopifySession.collection.collectionName,
        localField: 'shopDomain',
        foreignField: 'shop',
        as: 'session',
      },
    },
    { $unwind: '$session' },
    {
      $lookup: {
        from: Mockup.collection.collectionName,
        localField: '_id',
        foreignField: 'denormalizedData.integration._id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        shopDomain: 1,
        publishedAt: 1,
        accessToken: '$session.accessToken',
        name: '$shop.shopConfig.shop_owner',
        city: '$shop.shopConfig.city',
        country: '$shop.shopConfig.country_name',
        template: '$product.denormalizedData.templates.name',
        product: '$product.denormalizedData.variants.productId',
      },
    },
    { $limit: 10 },
  ])

  // Reduce results
  for (let i = 0; i < news.length; i++) {
    // Get product info
    const res = await requestGraphqlApi({
      shopDomain: news[i].shopDomain,
      accessToken: news[i].accessToken,
      query: `query {
        products(first: 1, query:"(id:${news[i].product[0].split('/').pop()})") {
          nodes {
            title
            productType
            category {
              name
            }
          }
        }
      }`,
    }).catch(console.error)

    news[i].product = res.data?.products?.nodes?.[0]
    news[i].productType = news[i].product?.productType

    // Detect product type
    if (!news[i].productType) {
      const title = news[i].product?.title?.toLowerCase() || ''
      const category = news[i].product?.category?.name?.toLowerCase() || ''
      const combinedText = `${title} ${category}`.toLowerCase()

      if (
        combinedText.includes('t-shirt')
        || combinedText.includes('tshirt')
        || combinedText.includes('shirt')
        || combinedText.includes('tee')
      ) {
        news[i].productType = 't-shirt'
      } else if (
        combinedText.includes('tumbler')
        || combinedText.includes('travel mug')
        || combinedText.includes('insulated cup')
      ) {
        news[i].productType = 'tumbler'
      } else if (combinedText.includes('cup') || combinedText.includes('mug') || combinedText.includes('coffee')) {
        news[i].productType = 'cup'
      } else if (combinedText.includes('ring') || combinedText.includes('jewelry')) {
        news[i].productType = 'ring'
      } else if (
        combinedText.includes('wall art')
        || combinedText.includes('wallart')
        || combinedText.includes('poster')
        || combinedText.includes('canvas')
        || combinedText.includes('print')
      ) {
        news[i].productType = 'wallart'
      } else if (
        combinedText.includes('hoodie')
        || combinedText.includes('sweatshirt')
        || combinedText.includes('pullover')
      ) {
        news[i].productType = 'hoodie'
      } else if (combinedText.includes('tank') || combinedText.includes('vest')) {
        news[i].productType = 'tank-top'
      } else if (combinedText.includes('bag') || combinedText.includes('tote') || combinedText.includes('backpack')) {
        news[i].productType = 'bag'
      } else if (combinedText.includes('pillow') || combinedText.includes('cushion')) {
        news[i].productType = 'pillow'
      } else if (combinedText.includes('blanket') || combinedText.includes('throw')) {
        news[i].productType = 'blanket'
      } else if (
        combinedText.includes('phone case')
        || combinedText.includes('phonecase')
        || combinedText.includes('case')
      ) {
        news[i].productType = 'phone-case'
      } else if (combinedText.includes('sticker') || combinedText.includes('decal')) {
        news[i].productType = 'sticker'
      } else {
        news[i].productType = 'product'
      }
    }

    // Generate flash news
    const name = news[i].name.split(' ')[0] || 'A merchant'

    if (news[i].publishedAt) {
      news[i]
        = `Just now: ${name} from ${news[i].city || news[i].country} published a personalized ${news[i].productType}!`
    } else {
      news[i]
        = `Just now: ${name} from ${news[i].city || news[i].country} created a personalized ${news[i].productType}!`
    }
  }

  return news
}
