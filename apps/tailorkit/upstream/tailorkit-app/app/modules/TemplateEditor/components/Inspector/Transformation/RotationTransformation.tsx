import type { InspectorControlComponentProps } from '~/modules/TemplateEditor/elements/components/types'
import { useTranslation } from 'react-i18next'
import { Image, TextField } from '@shopify/polaris'
import { EXTRA_ICONS } from '~/constants/assets-url'

export function RotationTransformation(props: InspectorControlComponentProps) {
  const { t } = useTranslation()
  const { dataKey, onChange, value: rotate = 0 } = props

  return (
    <div className="tailorkit-input_field">
      <TextField
        labelHidden
        suffix="°"
        type="number"
        autoComplete="off"
        value={rotate.toString()}
        label={t('rotation-degree')}
        prefix={<Image source={EXTRA_ICONS.ROTATE_ICON} alt={t('rotation-icon')} />}
        onChange={rotate => (dataKey ? onChange(dataKey, rotate) : onChange(rotate))}
      />
    </div>
  )
}
