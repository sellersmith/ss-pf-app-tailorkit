import type { InspectorControlComponentProps } from '~/modules/TemplateEditor/elements/components/types'
import { TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

export function YTransformation(props: InspectorControlComponentProps) {
  const { t } = useTranslation()
  const { dataKey, onChange, value: y = 0 } = props

  return (
    <div className="tailorkit-input_field">
      <TextField
        labelHidden
        prefix="Y"
        suffix="px"
        type="number"
        autoComplete="off"
        value={y.toString()}
        label={t('top-offset')}
        onChange={top => (dataKey ? onChange(dataKey, top) : onChange(top))}
      />
    </div>
  )
}
