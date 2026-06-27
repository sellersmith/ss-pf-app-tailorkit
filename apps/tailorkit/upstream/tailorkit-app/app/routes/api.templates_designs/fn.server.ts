import Template from '~/models/Template.server'
import { TEMPLATE_TYPE } from '../api.templates/constants'

export const getPremadeTemplateByCategory = async (category: string) => {
  try {
    const templates = await Template.aggregate([
      {
        $match: {
          type: { $ne: TEMPLATE_TYPE.CLIPART },
          shopDomain: process.env.STORE_ASSET_DOMAIN,
          category,
        },
      },
      {
        $project: {
          name: 1,
          createdAt: 1,
          updatedAt: 1,
          previewUrl: 1,
          type: 1,
          category: 1,
        },
      },
    ])
    return templates[0]
  } catch (e) {
    console.error('Failed to get Template design: ', e)
  }
}
