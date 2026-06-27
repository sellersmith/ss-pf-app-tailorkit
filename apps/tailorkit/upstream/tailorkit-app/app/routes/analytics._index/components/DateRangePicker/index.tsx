import { BlockStack, Box, Button, DatePicker, Icon, InlineGrid, InlineStack, Popover } from '@shopify/polaris'
import { ArrowRightIcon, CalendarIcon } from '@shopify/polaris-icons'
import { endOfDay, format, startOfDay } from 'date-fns'
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { getAnalyticsRangeOptions } from '../../utilities/getAnalyticsRangeOptions'
import type { DateRangeLabel } from '../../types'
import { lastMonth, today } from '../../constants'
import { dateRangeToTypeFormatter } from '../../utilities/dateRangeToTypeFormatter'
import TypeList from './TypeList'
import { DateInput } from './DateInput'
import { handleSetCompared } from '../ButtonComparePrevious'
import useDevices from '~/utils/hooks/useDevice'

export type TSelectedDates = {
  startDate: Date
  endDate: Date
}

export interface IDateRangePickerState {
  startDate: Date
  endDate: Date
  label: string
}

export interface IDateRangePicker {
  dateRangePicker: IDateRangePickerState
  setDateRangePicker: Dispatch<SetStateAction<IDateRangePickerState>>
  compared: IDateRangePickerState & { value: string }
  setCompared: Dispatch<SetStateAction<IDateRangePickerState & { value: string }>>
}

export default function DateRangePicker(props: IDateRangePicker) {
  const { dateRangePicker, setDateRangePicker, compared, setCompared } = props
  const { t } = useTranslation()
  const allDataDateOptions = getAnalyticsRangeOptions(t)

  const [selectedDates, setSelectedDates] = useState<TSelectedDates>({
    startDate: dateRangePicker.startDate,
    endDate: dateRangePicker.endDate,
  })
  const { isMobileView, isDesktopView } = useDevices()
  const [popoverActive, setPopoverActive] = useState<boolean>(false)
  const [label, setLabel] = useState<DateRangeLabel | string>(dateRangePicker.label)
  const currentSelectedDatesRef = useRef({ startDate: dateRangePicker.startDate, endDate: dateRangePicker.endDate })
  const currentTypeRef = useRef(label)
  const currentLabelRef = useRef(dateRangePicker.label)

  const [{ month, year }, setDate] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  })

  const [startDate, setStartDate] = useState(format(dateRangePicker.startDate, 'MMMM d, yyyy'))
  const [endDate, setEndDate] = useState(format(dateRangePicker.endDate, 'MMMM d, yyyy'))

  const handleMonthChange = useCallback((month: number, year: number) => setDate({ month, year }), [])

  const handleChangeTime = (startDate: Date, endDate: Date, month: number, year: number) => {
    handleMonthChange(month, year)
    setSelectedDates({
      startDate: startOfDay(startDate),
      endDate: endOfDay(endDate),
    })
    setStartDate(format(startDate, 'MMMM d, yyyy'))
    setEndDate(format(endDate, 'MMMM d, yyyy'))
  }

  const onChangeType = (values: DateRangeLabel[]) => {
    setLabel(values[0])
    isDesktopView && lastMonth.setMonth(lastMonth.getMonth() - 1)

    const currentTimeSelected = allDataDateOptions[values[0]]

    if (currentTimeSelected) {
      const { startDate, endDate } = currentTimeSelected.data
      const gapMonth = isMobileView ? 0 : 1
      const currentMonth = new Date(endDate).getMonth() - gapMonth
      const currentYear = new Date(endDate).getFullYear()
      handleChangeTime(startDate, endDate, currentMonth, currentYear)
    }
  }

  const handleApplyDateRange = () => {
    currentSelectedDatesRef.current = {
      startDate: selectedDates.startDate,
      endDate: selectedDates.endDate,
    }
    currentTypeRef.current = label
    currentLabelRef.current = dateRangeToTypeFormatter(t, selectedDates.startDate, selectedDates.endDate)

    const mutatedDate = {
      startDate: startOfDay(selectedDates.startDate),
      endDate: endOfDay(selectedDates.endDate),
      label: currentLabelRef.current,
    }
    const _comparedData = handleSetCompared(t, compared.value as any, mutatedDate)
    setDateRangePicker(pre => mutatedDate)
    setCompared(pre => _comparedData)
    setPopoverActive(false)
  }

  return (
    <Popover
      active={popoverActive}
      activator={
        <Button icon={CalendarIcon} onClick={() => setPopoverActive(!popoverActive)}>
          {allDataDateOptions[currentLabelRef.current as DateRangeLabel]?.title ?? currentLabelRef.current}
        </Button>
      }
      autofocusTarget="first-node"
      preferredAlignment="left"
      onClose={() => {
        setSelectedDates(currentSelectedDatesRef.current)
        setPopoverActive(!popoverActive)
        setStartDate(format(dateRangePicker.startDate, 'MMMM d, yyyy'))
        setEndDate(format(dateRangePicker.endDate, 'MMMM d, yyyy'))
        setLabel(dateRangePicker.label)
      }}
      fluidContent
    >
      <BlockStack>
        <InlineGrid columns={{ xs: 'auto', md: '210px 1fr' }}>
          <TypeList onChangeType={onChangeType} label={label} />

          <Box padding="400" maxWidth={isDesktopView ? '520px' : ''}>
            <BlockStack gap="400">
              <InlineGrid columns="1fr auto 1fr" gap="200" alignItems="center">
                <DateInput
                  typeInput={'startDate'}
                  label={t('starting')}
                  value={startDate}
                  setValue={setStartDate}
                  relatedValue={endDate}
                  setRelatedValue={setEndDate}
                  selectedDates={selectedDates}
                  setSelectedDates={setSelectedDates}
                />

                <Icon source={ArrowRightIcon} />

                <DateInput
                  typeInput={'endDate'}
                  label={t('ending')}
                  value={endDate}
                  setValue={setEndDate}
                  relatedValue={startDate}
                  setRelatedValue={setStartDate}
                  selectedDates={selectedDates}
                  setSelectedDates={setSelectedDates}
                />
              </InlineGrid>

              <Box>
                <DatePicker
                  month={month}
                  year={year}
                  onChange={selectedDatesTime => {
                    const a = dateRangeToTypeFormatter(t, selectedDatesTime.start, selectedDatesTime.end)
                    setLabel(a)
                    setSelectedDates({ startDate: selectedDatesTime.start, endDate: selectedDatesTime.end })
                    setStartDate(format(selectedDatesTime.start, 'MMMM d, yyyy'))
                    setEndDate(format(selectedDatesTime.end, 'MMMM d, yyyy'))
                  }}
                  onMonthChange={handleMonthChange}
                  selected={{
                    start: new Date(selectedDates.startDate),
                    end: new Date(selectedDates.endDate),
                  }}
                  multiMonth={isDesktopView}
                  disableDatesAfter={today}
                  allowRange
                  weekStartsOn={1}
                />
              </Box>
            </BlockStack>
          </Box>
        </InlineGrid>

        <Box borderBlockStartWidth="025" borderColor="border" padding="400">
          <InlineStack align="end" gap="200">
            <Button
              onClick={() => {
                setSelectedDates(currentSelectedDatesRef.current)
                setLabel(currentTypeRef.current)
                setPopoverActive(!popoverActive)
              }}
            >
              {t('cancel')}
            </Button>
            <Button variant="primary" onClick={handleApplyDateRange}>
              {t('apply')}
            </Button>
          </InlineStack>
        </Box>
      </BlockStack>
    </Popover>
  )
}
