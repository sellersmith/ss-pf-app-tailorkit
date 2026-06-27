import type { InspectorControlComponentProps } from '~/modules/TemplateEditor/elements/components/types'
import { TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

export function HeightTransformation(props: InspectorControlComponentProps) {
  const { t } = useTranslation()
  const { dataKey, onChange, value: height = 0 } = props

  return (
    <div className="tailorkit-input_field">
      <TextField
        labelHidden
        prefix="H"
        suffix="px"
        type="number"
        autoComplete="off"
        label={t('height')}
        value={height.toString()}
        onChange={height => (dataKey ? onChange(dataKey, height) : onChange(height))}
      />
    </div>
  )
}
