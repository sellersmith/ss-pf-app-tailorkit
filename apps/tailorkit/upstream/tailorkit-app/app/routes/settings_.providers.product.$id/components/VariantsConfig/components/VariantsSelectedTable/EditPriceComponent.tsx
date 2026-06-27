import { BlockStack, InlineError, Text, TextField } from '@shopify/polaris'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface IEditCostProps {
  price: number
  onChangePrice: (cost: number) => void
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  error?: string
  setError?: (params: { [key: string]: string | undefined }) => void
  id?: string
  maxValue?: number
}

export const EditPriceComponent = (props: IEditCostProps) => {
  const { t } = useTranslation()
  const { price, onChangePrice, prefix = '$', suffix, error, id, setError, maxValue = Infinity } = props
  const [cost, setCost] = useState(price)

  const handleChangeCost = useCallback(
    (value: string) => {
      setCost(+value)
      setError && id && setError({ [id]: undefined })
    },
    [id, setError]
  )

  const handleBlur = useCallback(() => {
    const realValue = Math.min(cost, maxValue)
    setCost(realValue)
    onChangePrice(realValue)
  }, [cost, onChangePrice, maxValue])

  useEffect(() => {
    setCost(price)
  }, [price])

  return (
    <div className="textfield-number">
      <div style={{ marginTop: `${error ? '20px' : '0px'}` }}>
        <BlockStack gap={'100'}>
          <TextField
            id={id}
            label={t('cost')}
            labelHidden
            autoComplete={'off'}
            value={cost.toString()}
            placeholder={t('input-your-profit-margin')}
            prefix={prefix}
            suffix={suffix || ''}
            type="number"
            onChange={handleChangeCost}
            onBlur={handleBlur}
            min={0}
            error={!!error}
          />
          {error && (
            <InlineError
              message={
                <Text as="span" variant="bodyXs">
                  {error}
                </Text>
              }
              fieldID={id || ''}
            />
          )}
        </BlockStack>
      </div>
    </div>
  )
}
