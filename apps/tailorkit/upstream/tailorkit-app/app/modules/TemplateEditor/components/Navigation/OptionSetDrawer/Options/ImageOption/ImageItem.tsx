import { Icon, TextField } from '@shopify/polaris'
import { UploadIcon } from '@shopify/polaris-icons'
import type { IImageItemsProps } from './items'
import { useTranslation } from 'react-i18next'

export function AddMoreImageItem(props: { toggleImageSelectModal: IImageItemsProps['toggleImageSelectModal'] }) {
  const { toggleImageSelectModal } = props
  const { t } = useTranslation()

  return (
    <div className="fit-dropZone" onClick={toggleImageSelectModal}>
      <TextField
        label={t('upload-your-images')}
        labelHidden
        autoComplete="off"
        placeholder={t('upload-your-images')}
        suffix={<Icon source={UploadIcon} />}
      />
    </div>
  )
}
