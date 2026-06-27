import type { FetchDataFunc } from '..'

export type DeleteProductFunc = (productId: string) => Promise<void>

/**
 * Delete a product
 *
 * @param {string} productId - The ID of the product to be deleted
 * @returns {Promise<Response>}
 *
 * @example
 * const productId = "5cb87a8cd490a2ccb256cec4";
 * await printify.products.deleteOne(productId);
 * // Expected response: {}
 */
const deleteOne
  = (fetchData: FetchDataFunc, shopId: string) =>
  async (productId: string): Promise<void> => {
    await fetchData(`/shops/${shopId}/products/${productId}.json`, {
      method: 'DELETE',
    })
  }

export default deleteOne
