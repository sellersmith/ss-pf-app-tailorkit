import { type IProductWithVariants, type IVariant } from '~/types/shopify-product'

const getProductsListFromVariants = (variants: IVariant[]) => {
  const products: IProductWithVariants[] = []

  variants
    .filter(variant => !!variant)
    .forEach(variant => {
      const currentProduct = products.find(p => variant.product?.id === p?.id)
      if (currentProduct) {
        currentProduct.variants.push(variant)
      } else {
        products.push({
          ...variant.product,
          variants: [variant],
        })
      }
    })

  return products
}

export default getProductsListFromVariants
