import { TextField } from '@shopify/polaris'
import { compareAsc, format } from 'date-fns'
import { type Dispatch, type SetStateAction } from 'react'
import { type TSelectedDates } from '~/routes/analytics._index/components/DateRangePicker'
import { DATE_FORMAT_REGEX } from '../../constants'

interface IDateInput {
  typeInput: 'startDate' | 'endDate'
  label: string
  value: string
  setValue: Dispatch<SetStateAction<string>>
  relatedValue: string
  setRelatedValue: Dispatch<SetStateAction<string>>
  selectedDates: TSelectedDates
  setSelectedDates: Dispatch<TSelectedDates>
}

export const DateInput = (props: IDateInput) => {
  const { label, value, setValue, relatedValue, setRelatedValue, selectedDates, setSelectedDates, typeInput } = props

  const handleChangeDateInput = (val: string) => {
    try {
      setValue(val)

      if (!val.match(DATE_FORMAT_REGEX)) {
        return
      }

      const currentDate = new Date(val)
      const relatedDate = new Date(relatedValue)
      const result = compareAsc(currentDate, relatedDate)

      /**
       * If the start date is greater than the end date or the end date is smaller than the start date,
       * they will be adjusted to the same date.
       */
      if ((result === 1 && typeInput === 'startDate') || (result === -1 && typeInput === 'endDate')) {
        setRelatedValue(format(val, 'MMMM d, yyyy'))
        setSelectedDates({
          startDate: currentDate,
          endDate: currentDate,
        })
      } else {
        setSelectedDates({ ...selectedDates, [typeInput]: currentDate })
      }
    } catch (error) {
      console.error('===> Error handleChangeDateInput:', error)
    }
  }

  const handleBlur = () => {
    try {
      let newValue: string | Date = value

      if (!value.match(DATE_FORMAT_REGEX)) {
        newValue = selectedDates[typeInput]
      }

      setValue(format(newValue, 'MMMM d, yyyy'))
    } catch (error) {
      console.error('===> Error handleBlur parsing date:', error)
      setValue(format(new Date(), 'MMMM d, yyyy'))
    }
  }

  return (
    <TextField
      labelHidden
      label={label}
      value={value}
      autoComplete="off"
      onChange={handleChangeDateInput}
      onFocus={() => setValue(value => format(value, 'yyyy-MM-dd'))}
      onBlur={handleBlur}
    />
  )
}
