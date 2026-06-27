import { useTranslation } from 'react-i18next'
import { Bleed, Box, Button, Collapsible, Icon, InlineStack, OptionList, Popover, Text } from '@shopify/polaris'
import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from 'react'
import { EOptionsComparing, NO_COMPARE_LABEL_KEY, todayRange } from '../constants'
import { ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons'
import { getQuartersFromNearestToFarthest } from '../utilities/getQuartersFromNearestToFarthest'
import { getPreviousPeriodDatesRange } from '../utilities/getPreviousPeriodDatesRange'
import { dateRangeToLabelFormatter } from '../utilities/dateRangeToLabelFormatter'
import { type IDateRangePickerState } from './DateRangePicker'
import { type TFunction } from 'i18next'

const QUARTER_DROPDOWN = 'quarter-dropdown'

export interface IButtonComparePrevious {
  compared: IDateRangePickerState & { value: string }
  setCompared: Dispatch<SetStateAction<IDateRangePickerState & { value: string }>>
  dateRangePicker: IDateRangePickerState
}

export const handleSetCompared = (
  t: TFunction,
  comparedSelected: EOptionsComparing,
  dateRangePicker: IButtonComparePrevious['dateRangePicker']
): IButtonComparePrevious['compared'] => {
  if (comparedSelected === EOptionsComparing.PREVIOUS_PERIOD) {
    const previousPeriodRange = getPreviousPeriodDatesRange(dateRangePicker.startDate, dateRangePicker.endDate)

    if (previousPeriodRange) {
      const label = dateRangeToLabelFormatter(previousPeriodRange.startDate, previousPeriodRange.endDate)
      return { ...previousPeriodRange, label, value: comparedSelected }
    }
  }

  const quarterOptions = getQuartersFromNearestToFarthest(t) || {}
  const quarterSelected = Object.values(quarterOptions).find((opt: any) => opt.value === comparedSelected)
  if (quarterSelected && quarterSelected.data) {
    const label = dateRangeToLabelFormatter(quarterSelected.data.startDate, quarterSelected.data.endDate)

    return { ...quarterSelected.data, label, value: comparedSelected }
  }

  return { ...todayRange, label: `${t(NO_COMPARE_LABEL_KEY)}`, value: comparedSelected }
}

export function ButtonComparePrevious(props: IButtonComparePrevious): JSX.Element {
  const { compared, setCompared, dateRangePicker } = props
  const { t } = useTranslation()

  const [popoverActive, setPopoverActive] = useState(false)
  const [openQuarter, setOpenQuarter] = useState(false)

  // Toggle the quarter dropdown
  const handleToggleQuarter = useCallback(() => setOpenQuarter(prev => !prev), [])

  // Toggle popover visibility
  const togglePopoverActive = useCallback(() => setPopoverActive(prev => !prev), [])

  // Comparison options for the dropdown
  const OPTIONS_COMPARE = useMemo(
    () => [
      { value: EOptionsComparing.NO_COMPARISON, label: t(NO_COMPARE_LABEL_KEY) },
      { value: EOptionsComparing.PREVIOUS_PERIOD, label: t('previous-period') },
    ],
    [t]
  )

  // Fetch quarter options from nearest to farthest
  const QUARTER_COMPARE = useMemo(() => {
    const quarterOptions = getQuartersFromNearestToFarthest(t)
    return (quarterOptions && Object.values(quarterOptions)) || []
  }, [t])

  // Map quarter options to OptionList format
  const QUARTER_OPTIONS_COMPARE = useMemo(
    () =>
      QUARTER_COMPARE.map((option: any) => ({
        label: <Box paddingInlineStart="400">{option?.label || ''}</Box>,
        value: option?.value || '',
      })),
    [QUARTER_COMPARE]
  )

  // Handle changes in comparison type
  const handleTypeChanged = useCallback(
    (selected: any[]) => {
      if (Array.isArray(selected) && selected[0]) {
        if (selected[0] === QUARTER_DROPDOWN) {
          handleToggleQuarter()
          return
        }
        const _comparedData = handleSetCompared(t, selected[0], dateRangePicker)
        setCompared(pre => _comparedData)
      }
      setPopoverActive(false)
    },
    [dateRangePicker, handleToggleQuarter, setCompared, t]
  )

  // Popover activator button
  const activator = <Button onClick={togglePopoverActive} disclosure>{`${t('compare-to')} ${compared.label}`}</Button>

  // Dropdown label for the quarters section
  const sectionDropdownLabel = useMemo(
    () => (
      <Box width="174px">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text as="p">{t('quarters')}</Text>
          <Box width="20px">
            <Icon source={openQuarter ? ChevronUpIcon : ChevronDownIcon} />
          </Box>
        </InlineStack>
      </Box>
    ),
    [openQuarter, t]
  )

  return (
    <Popover active={popoverActive} activator={activator} onClose={togglePopoverActive} preferredAlignment="left">
      <OptionList
        onChange={handleTypeChanged}
        options={[...OPTIONS_COMPARE, { value: QUARTER_DROPDOWN, label: sectionDropdownLabel }]}
        selected={[compared.value]}
      />
      <Collapsible open={openQuarter} transition={{ duration: '100ms', timingFunction: 'ease-in-out' }} id={''}>
        <Bleed marginBlockStart="200">
          <OptionList onChange={handleTypeChanged} options={QUARTER_OPTIONS_COMPARE} selected={[compared.value]} />
        </Bleed>
      </Collapsible>
    </Popover>
  )
}
