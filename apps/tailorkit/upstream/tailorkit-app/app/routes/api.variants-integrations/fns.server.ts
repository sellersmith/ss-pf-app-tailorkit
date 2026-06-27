import Integration from '~/models/Integration.server'
import Mockup from '~/models/Mockup.server'
import PrintArea from '~/models/PrintArea.server'
import VariantIntegration from '~/models/VariantIntegration.server'
import { convertIdsToQuery, ShopifyApiClient } from '~/shopify/graphql/api.server'

export async function getAllVariantsIntegrated({
  shopDomain,
  withShopifyData = null,
}: {
  shopDomain: string
  withShopifyData?: { admin: any } | null
}) {
  const variants = await VariantIntegration.find({ shopDomain })
    .populate({
      path: 'mockup',
      select: '-denormalizedData',
      model: Mockup,
    })
    .lean()

  if (withShopifyData) {
    const admin = withShopifyData.admin
    const api = new ShopifyApiClient(admin)

    const variantShopifyIds = variants.map(v => v.id)
    const productVariantNodes = await api.getProductVariants({ query: convertIdsToQuery(variantShopifyIds) })
    const productVariants = productVariantNodes?.nodes || []
    const variantEntries = Object.fromEntries(
      productVariants?.map((variant: any) => [variant.id, variant.product]) || []
    )

    const _variants = variants.map(variant => {
      variant.product = variantEntries[variant.id]

      return variant
    })

    return _variants
  }

  return variants
}

export async function getIntegrationByVariantId(shopDomain: string, variant_id: string) {
  const variantIntegration = await VariantIntegration.findOne({ _id: variant_id, shopDomain }).populate({
    path: 'printAreas',
    model: PrintArea,
    select: '_id template',
  })
  const integration = await Integration.findOne({ shopDomain, variants: { $in: [variantIntegration?.id] } })

  return {
    integration: integration?.toObject(),
    variantIntegration: variantIntegration?.toObject(),
  }
}
