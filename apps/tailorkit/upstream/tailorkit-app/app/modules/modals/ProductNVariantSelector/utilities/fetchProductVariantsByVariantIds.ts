import { IntegrationsService } from '~/api/services/integrations'

const fetchProductVariantsByIds = async (params: { variantIds: string[] }) => {
  const { variantIds } = params
  return IntegrationsService.getProductVariantsByVariantIds(variantIds)
}

export default fetchProductVariantsByIds
