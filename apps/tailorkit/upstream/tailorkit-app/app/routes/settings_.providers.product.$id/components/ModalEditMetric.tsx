import type { ModalProps, TextFieldProps } from '@shopify/polaris'
import { Modal, TextField } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface IModalEditMetricProps {
  inputType: TextFieldProps['type']
  inputPrefix?: TextFieldProps['prefix']
  inputSuffix?: TextFieldProps['suffix']
  inputValue?: TextFieldProps['value']
  maxValue?: number
  onDone: (value: TextFieldProps['value']) => void
}

const DEFAULT_METRIC_VALUE = 0

function ModalEditMetric(props: IModalEditMetricProps & ModalProps) {
  const { inputType, inputPrefix, inputSuffix, inputValue, maxValue = Infinity, onDone, ...modalProps } = props

  const { t } = useTranslation()
  const [_inputValue, setInputValue] = useState<number>(+(inputValue || 0) || DEFAULT_METRIC_VALUE)

  const onTextFieldValueChangeHandler = useCallback((value: TextFieldProps['value']) => {
    setInputValue(+(value || 0))
  }, [])

  const handleBlur = useCallback(async () => {
    const realValue = _inputValue < maxValue ? _inputValue : maxValue
    setInputValue(Math.max(realValue, 0))
  }, [_inputValue, maxValue])

  const metric = t(modalProps.title as string).toLowerCase()

  return (
    <Modal
      primaryAction={{
        content: t('done'),
        onAction: () => onDone(_inputValue.toString()),
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: modalProps.onClose,
        },
      ]}
      {...modalProps}
      title={t('edit-metric', { metric })}
    >
      <Modal.Section>
        <div className="textfield-number">
          <TextField
            autoComplete="on"
            label={t('apply-a-metric-to-all-selected-variants', {
              metric,
            })}
            min={0}
            type={inputType}
            {...(inputPrefix ? { prefix: inputPrefix } : {})}
            {...(inputSuffix ? { suffix: inputSuffix } : {})}
            value={_inputValue?.toString()}
            onChange={onTextFieldValueChangeHandler}
            onBlur={handleBlur}
          />
        </div>
      </Modal.Section>
    </Modal>
  )
}

export default ModalEditMetric
