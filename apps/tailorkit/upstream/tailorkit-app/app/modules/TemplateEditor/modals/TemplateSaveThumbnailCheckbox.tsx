import { useShopDomain } from '~/utils/shopify/useShopParams'
import { Checkbox } from '@shopify/polaris'

interface ITemplateSaveThumbnailCheckboxProps {
  saveThumbnailWithPreview: boolean
  setSaveThumbnailWithPreview: (value: boolean) => void
  isPreviewImageVisible: boolean
}

export default function TemplateSaveThumbnailCheckbox(props: ITemplateSaveThumbnailCheckboxProps) {
  const { saveThumbnailWithPreview, setSaveThumbnailWithPreview, isPreviewImageVisible } = props

  const shopDomain = useShopDomain()

  if (!shopDomain || window.PUBLIC_ENV.STORE_ASSET_DOMAIN !== shopDomain) {
    return null
  }

  return (
    <Checkbox
      label={'Save thumbnail with preview product image'}
      checked={saveThumbnailWithPreview}
      onChange={setSaveThumbnailWithPreview}
      disabled={!isPreviewImageVisible}
      helpText={
        !isPreviewImageVisible
          ? 'Add a preview product image to enable this option'
          : 'Thumbnail will include both canvas and preview product image'
      }
    />
  )
}
