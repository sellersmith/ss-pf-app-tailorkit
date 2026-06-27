import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { type IPageInfo } from '~/types/shopify-product'
import { FILE_ACTIONS } from './constants'
import { json } from '~/bootstrap/fns/fetch.server'
import { queryShopifyFiles } from './fns.server'
import { ShopifyFileType } from '~/models/ShopifyFile.server'

export const action = async ({ request }: LoaderFunctionArgs) => {
  try {
    const {
      admin,
      session: { shop: shopDomain },
    } = await authenticate.admin(request)
    const api = new ShopifyApiClient(admin)

    // Get action from search params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case FILE_ACTIONS.FETCH_MEDIA_LISTS: {
        // Get shopify image list
        const formData = await request.formData()
        const pageInfo: IPageInfo = JSON.parse(formData.get('pageInfo') as string)
        const isFetchNextPage = Boolean(formData.get('isFetchNextPage'))
        const queryValue: string = formData.get('queryValue') as string

        const { hasNextPage, endCursor } = pageInfo
        const shouldFetchNextPage = isFetchNextPage && hasNextPage && endCursor
        const queryParams = shouldFetchNextPage ? { after: endCursor, query: queryValue } : { query: queryValue }

        const mediaList = await api.getMediaFiles(queryParams)

        return json({ success: true, mediaList })
      }

      case FILE_ACTIONS.QUERY_FONT_FILES:
      case FILE_ACTIONS.QUERY_MASK_FILES: {
        const formData = await request.formData()
        const queryValue: string = formData.get('queryValue') as string
        const page: string = formData.get('page') as string

        const isFetchFontFiles = action === FILE_ACTIONS.QUERY_FONT_FILES
        const fileType = isFetchFontFiles ? ShopifyFileType.GENERIC_FILE : ShopifyFileType.MASK_IMAGE
        const data = await queryShopifyFiles(queryValue, shopDomain, Number(page), fileType)
        const { files, pageInfo } = data

        return json({ success: true, data: { [isFetchFontFiles ? 'fontFiles' : 'maskFiles']: files, pageInfo } })
      }
    }
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
}
