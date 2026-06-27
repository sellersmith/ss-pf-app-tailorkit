import { PROVIDER_API_URL } from '~/constants/fulfillment-providers'
import type { IPrintifyBlueprint, IPrintifyShop } from './types'

export const getShopsListFromPrintify = async (apiToken: string) => {
  try {
    const shopUrl = `${PROVIDER_API_URL.Printify.baseUrl}${PROVIDER_API_URL.Printify.shopsPath}`

    const printifyShops: IPrintifyShop[] | null = await fetch(shopUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
      mode: 'no-cors',
    })
      .then(res => res.json())
      .catch(err => {
        console.log('Failed to fetch Printify Shops data ', err)
        return null
      })

    if (printifyShops && printifyShops.length) {
      const _shopFormatted = printifyShops.map(shop => ({
        label: shop.title,
        value: shop.id,
      }))

      return _shopFormatted
    }

    return null
  } catch (err) {
    return null
  }
}

export const getBlueprintsFromPrintify = async (apiToken: string) => {
  const blueprintsUrl = `${PROVIDER_API_URL.Printify.baseUrl}${PROVIDER_API_URL.Printify.allBlueprintsPath}`
  try {
    const blueprintsList: IPrintifyBlueprint[] | null = await fetch(blueprintsUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
      mode: 'no-cors',
    })
      .then(res => res.json())
      .catch(err => {
        console.log('Failed to fetch Printify Blueprints data ', err)
        return null
      })

    return blueprintsList
  } catch (err) {
    return null
  }
}

export interface IBlueprintProviderByIdTrickUrl {
  total: number
  data: {
    id: string
    name: string
    min_price: number
    min_shipping_prices: {
      standard: number
    }
    scoring: {
      generic_score: number
    }
    options: {
      type: 'size' | 'color'
      items: any[]
    }[]
  }[]
}

// WARNING: The following function is used for trick only, it can be removed at any time
export const getAdvanceBlueprintsProvider = async (blueprintId: string, providerId?: string) => {
  const blueprintProvidersUrl = PROVIDER_API_URL.Printify.blueprintProviderByIdTrickUrl
    .replace('{blueprint_id}', blueprintId)
    .replace('/{provider_id}', providerId ? `/${providerId}` : '')

  try {
    const providersList: any = await fetch(blueprintProvidersUrl, {
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      mode: 'no-cors',
    })
      .then(res => res.json())
      .catch(err => {
        console.log('Failed to fetch Printify Blueprints data by trick url', err)
        return null
      })

    return providersList
  } catch (err) {
    return null
  }
}
