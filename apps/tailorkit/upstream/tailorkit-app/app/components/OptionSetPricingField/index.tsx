import { TextField, Tooltip } from '@shopify/polaris'
import { formatCustomerPrice } from 'extensions/tailorkit-src/src/assets/utils/storefront-pricing'
import { Fragment } from 'react'
import { getCurrencySymbolV2 } from '~/constants/currency-codes'
import type { OptionPricing } from '~/models/OptionSet'
import { useStoreContext } from '~/modules/TemplateEditor/contexts/StoreContext'

interface OptionSetPricingFieldProps {
  item: {
    _id: string
    additionalPricing?: OptionPricing
    [key: string]: any
  }
  onPricingChange: (_id: string, value: string) => Promise<void> | void
  disabled?: boolean
}

export default function OptionSetPricingField({ item, onPricingChange, disabled = false }: OptionSetPricingFieldProps) {
  const { shopData } = useStoreContext()
  const currency = shopData?.shopConfig?.currency || 'USD'

  const currentPricing = item.additionalPricing as OptionPricing | undefined
  const displayValue = currentPricing?.value?.toString() || ''

  const symbol = getCurrencySymbolV2(currency)
  // Use a consistent width so the box is large enough by default
  const inputWidth = '70px'

  const handleChange = (value: string) => {
    onPricingChange(item._id, value)
  }

  const handleBlur = () => {
    if (+displayValue < 0) {
      onPricingChange(item._id, '0')
    }
  }

  return (
    <Fragment>
      <div className="tailorkit-input_field" style={{ minWidth: inputWidth, maxWidth: inputWidth }}>
        <Tooltip content={formatCustomerPrice(Number(displayValue), { code: currency })}>
          <TextField
            autoComplete="off"
            prefix={symbol}
            label={'additional-pricing'}
            labelHidden
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="0"
            type="number"
            disabled={disabled}
          />
        </Tooltip>
      </div>
    </Fragment>
  )
}
