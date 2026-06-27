import { Box, ButtonGroup } from '@shopify/polaris'
import DateRangePicker, { type IDateRangePickerState } from './DateRangePicker'
import { type Dispatch, type SetStateAction } from 'react'
import { ButtonComparePrevious } from './ButtonComparePrevious'
import useDevices from '~/utils/hooks/useDevice'

export default function AnalyticsChartHeader(props: {
  dateRangePicker: IDateRangePickerState
  setDateRangePicker: Dispatch<SetStateAction<IDateRangePickerState>>
  compared: IDateRangePickerState & { value: string }
  setCompared: Dispatch<SetStateAction<IDateRangePickerState & { value: string }>>
}) {
  const { dateRangePicker, setDateRangePicker, compared, setCompared } = props

  const { isSmallMobileView } = useDevices()

  return (
    <Box paddingInlineStart={isSmallMobileView ? '300' : '0'}>
      <ButtonGroup>
        <DateRangePicker
          dateRangePicker={dateRangePicker}
          setDateRangePicker={setDateRangePicker}
          compared={compared}
          setCompared={setCompared}
        />
        <ButtonComparePrevious dateRangePicker={dateRangePicker} compared={compared} setCompared={setCompared} />
      </ButtonGroup>
    </Box>
  )
}
