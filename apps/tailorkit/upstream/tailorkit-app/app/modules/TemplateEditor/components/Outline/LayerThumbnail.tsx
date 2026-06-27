import { Thumbnail } from '@shopify/polaris'
import { getShopifyThumbnail } from '~/utils/loadImage'

export function LayerThumbnail(props: { src: string }) {
  const { src } = props

  return <Thumbnail source={getShopifyThumbnail(src)} alt="Layer thumbnail" size="extraSmall" />
}
