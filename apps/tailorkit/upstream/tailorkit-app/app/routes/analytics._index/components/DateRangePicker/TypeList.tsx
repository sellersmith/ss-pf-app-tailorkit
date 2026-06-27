import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, OptionList, Scrollable } from '@shopify/polaris'
import type { DateRangeLabel } from '../../types'
import { getAnalyticsRangeOptions } from '../../utilities/getAnalyticsRangeOptions'
import isEmpty from 'lodash/isEmpty'

interface ITypeListOnLaptop {
  onChangeType: (values: DateRangeLabel[]) => void
  label: string
}

export default function TypeList({ onChangeType, label }: ITypeListOnLaptop) {
  const { t } = useTranslation()

  const handleTypeChanged = useCallback(
    (values: any) => {
      onChangeType(values)
    },
    [onChangeType]
  )

  const rangeTimeOptions = useMemo(() => {
    const rangeOptions = getAnalyticsRangeOptions(t)
    if (rangeOptions && !isEmpty(rangeOptions)) {
      return Object.values(rangeOptions).map(({ value, title }: any) => ({
        value,
        label: title,
      }))
    }
    return []
  }, [t])

  return (
    <Box borderInlineEndWidth="025" borderColor="border">
      <Scrollable shadow style={{ height: '330px' }}>
        <OptionList onChange={handleTypeChanged} options={rangeTimeOptions} selected={[label ?? '']} />
      </Scrollable>
    </Box>
  )
}
