import type { InspectorControlComponentProps } from '~/modules/TemplateEditor/elements/components/types'
import { TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

export function WidthTransformation(props: InspectorControlComponentProps) {
  const { t } = useTranslation()
  const { dataKey, onChange, value: width = 0 } = props

  return (
    <div className="tailorkit-input_field">
      <TextField
        labelHidden
        prefix="W"
        suffix="px"
        type="number"
        autoComplete="off"
        label={t('width')}
        value={width.toString()}
        onChange={width => (dataKey ? onChange(dataKey, width) : onChange(width))}
      />
    </div>
  )
}
