export const INCH_LENGTH = 2.54

export type MEASUREMENT_UNIT = 'px' | 'inch' | 'mm' | 'cm' | 'm'

export const MEASUREMENT_UNITS: { [key in MEASUREMENT_UNIT]: string } = {
  px: 'Pixels',
  inch: 'Inch',
  mm: 'Millimeters',
  cm: 'Centimeters',
  m: 'Meters',
}
