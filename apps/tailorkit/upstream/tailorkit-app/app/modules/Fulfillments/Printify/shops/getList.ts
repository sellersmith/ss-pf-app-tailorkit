import type { FetchDataFunc } from '..'

export interface Shop {
  id: number
  title: string
  sales_channel: string
}

export type GetListShopsFunc = () => Promise<Shop[]>

/**
 * Retrieve a list of shops in a Printify account
 *
 * @returns {Promise<Shop[]>}
 *
 * @example
 * const shops = await printify.shops.list();
 * // Expected response:
 * // [
 * //   { id: 5432, title: "My new store", sales_channel: "My Sales Channel" },
 * //   { id: 9876, title: "My other new store", sales_channel: "disconnected" }
 * // ]
 */
const getList = (fetchData: FetchDataFunc) => async (): Promise<Shop[]> => {
  const response = await fetchData(`/shops.json`, {
    method: 'GET',
  })

  return response
}

export default getList
