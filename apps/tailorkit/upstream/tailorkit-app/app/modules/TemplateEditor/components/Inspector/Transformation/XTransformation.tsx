import type { InspectorControlComponentProps } from '~/modules/TemplateEditor/elements/components/types'
import { TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

export function XTransformation(props: InspectorControlComponentProps) {
  const { t } = useTranslation()
  const { dataKey, onChange, value: x = 0 } = props

  return (
    <div className="tailorkit-input_field">
      <TextField
        labelHidden
        prefix="X"
        suffix="px"
        type="number"
        autoComplete="off"
        value={x.toString()}
        label={t('left-offset')}
        onChange={left => (dataKey ? onChange(dataKey, left) : onChange(left))}
      />
    </div>
  )
}
