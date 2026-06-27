import { Checkbox, InlineStack, Spinner, Thumbnail } from '@shopify/polaris'
import { type IItem } from './ListItems'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { getShopifyImageInSpecificWidth } from 'extensions/tailorkit-src/src/assets/fns/shopify-image-url'
import styles from '~/modules/modals/ImageSelector/components/ThumbnailButton.style.module.css'

interface IThumbnailButton {
  item: IItem
  style?: string
  showCheckbox?: boolean
  imageInSpecificWidth?: number
}

export function ThumbnailGridButton(props: IThumbnailButton) {
  const { item, imageInSpecificWidth = 180 } = props
  const { previewUrl, alt, selected, isUploading } = item

  return (
    <div className={styles.ImageSelect}>
      <div className={styles.ImageSelectWrapperImage}>
        <img
          src={getShopifyImageInSpecificWidth(previewUrl, imageInSpecificWidth)}
          alt={alt}
          width={'100%'}
          height={'100%'}
          loading="lazy"
          style={{
            objectFit: 'contain',
            objectPosition: 'center center',
            borderRadius: '4px',
          }}
        />
      </div>

      <Checkbox
        id={previewUrl}
        name="imgUrl"
        value={previewUrl}
        label={alt}
        labelHidden
        checked={selected}
        disabled={isUploading}
        onChange={() => {}}
      />
      {isUploading && (
        <div className="emtlkit-loading-media">
          <Spinner size="small" />
        </div>
      )}
    </div>
  )
}

export function ThumbnailListButton(props: IThumbnailButton) {
  const { item, showCheckbox = true, imageInSpecificWidth = 180 } = props
  const { previewUrl, alt = '', selected, isUploading } = item

  return (
    <InlineStack gap={'200'} blockAlign="center">
      {showCheckbox && (
        <Checkbox
          id={previewUrl}
          name="imgUrl"
          value={previewUrl}
          label={alt}
          labelHidden
          checked={selected}
          disabled={isUploading}
          onChange={() => {}}
        />
      )}
      <Thumbnail source={getShopifyThumbnail(previewUrl, imageInSpecificWidth)} alt={alt} size="large" />

      {isUploading && (
        <div className="emtlkit-loading-media">
          <Spinner size="small" />
        </div>
      )}
    </InlineStack>
  )
}
