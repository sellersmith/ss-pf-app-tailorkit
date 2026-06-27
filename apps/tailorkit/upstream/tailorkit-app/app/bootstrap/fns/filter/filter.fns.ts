import { forceStringFields, operatorNumValues } from './constants'

export function getFilterParams(searchParams: URLSearchParams) {
  return [...searchParams]
    .filter(param => param[0].startsWith('filter__'))
    .map(param => `${param[0].split('__').pop()}__${param[1]}`)
}

export function prepareFilter(param: string) {
  const pieces = param.split('__', 5) as [
    field: string,
    type: string,
    operator: string,
    value: any,
    percentOfResult: string,
  ]

  const [field, , , , percentOfResult] = pieces
  let [, type, operator, value] = pieces

  // Auto-detect missing parameters
  if (value === undefined && (operator !== undefined || type !== undefined)) {
    value = operator || type
    operator = operatorNumValues[type] ? type : 'has'

    type = value.match(/^\d\d\d\d-\d\d-\d\d(~\d\d\d\d-\d\d-\d\d)?$/)
      ? 'date'
      : value.match(/^(\d+|\d*\.\d+)(~(\d+|\d*\.\d+))?$/) && !forceStringFields.includes(field)
        ? 'amount'
        : 'string'

    if (value.indexOf(',') > 0) {
      type = 'array'
      operator = 'any'
    } else if (operator !== 'has' && value.indexOf('~') > 0) {
      operator = 'range'
    }
  }

  return { field, type, operator, value, percentOfResult }
}
