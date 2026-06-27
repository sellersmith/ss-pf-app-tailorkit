import { INCH_LENGTH, type MEASUREMENT_UNIT } from '~/constants/measurement-units'
import type { TemplateDimension } from '~/types/template'
import { isDecimal } from './number'
import type { Template } from '~/types/psd'

export function lengthUnitToPixels(length: number, unit: MEASUREMENT_UNIT, ppi: number) {
  let lengthInInches

  // Convert the length to inches based on the unit provided
  switch (unit) {
    case 'm': {
      lengthInInches = length / (INCH_LENGTH * 0.01)
      break
    }

    case 'cm': {
      lengthInInches = length / INCH_LENGTH
      break
    }

    case 'inch': {
      lengthInInches = length
      break
    }

    case 'mm': {
      lengthInInches = length / (INCH_LENGTH * 10)
      break
    }

    case 'px':
    default: {
      lengthInInches = length / ppi
      break
    }
  }

  // Convert inches to pixels
  const pixels = Math.round(lengthInInches * ppi)

  return pixels
}

/**
 * Convert TemplateDimension to pixels dimension
 *
 * @param dimension TemplateDimension
 * @returns
 */
export function convertDimensionToPixels(dimension: Template['dimension']) {
  return {
    width: lengthUnitToPixels(dimension.width, dimension.measurementUnit, dimension.resolution),
    height: lengthUnitToPixels(dimension.height, dimension.measurementUnit, dimension.resolution),
  }
}

function pixelsToInches(pixels: number, ppi: number) {
  return pixels / ppi
}

// Function to convert pixels to centimeters using a specified PPI
function pixelsToCentimeters(pixels: number, ppi: number) {
  const inches = pixelsToInches(pixels, ppi)
  const centimetersPerInch = 2.54
  return inches * centimetersPerInch
}

// Function to convert pixels to millimeters using a specified PPI
function pixelsToMillimeters(pixels: number, ppi: number) {
  const centimeters = pixelsToCentimeters(pixels, ppi)
  return centimeters * 10
}

// Function to convert pixels to meters using a specified PPI
function pixelsToMeters(pixels: number, ppi: number) {
  const centimeters = pixelsToCentimeters(pixels, ppi)
  return centimeters / 100
}

export function lengthUnitToLengthUnit(
  fromUnit: MEASUREMENT_UNIT,
  toUnit: MEASUREMENT_UNIT,
  length: number,
  ppi: number
) {
  // Convert all units to pixels first
  const pixels = lengthUnitToPixels(length, fromUnit, ppi)
  let lengthInUnit

  switch (toUnit) {
    case 'cm': {
      lengthInUnit = pixelsToCentimeters(pixels, ppi)
      break
    }

    case 'inch': {
      lengthInUnit = pixelsToInches(pixels, ppi)
      break
    }

    case 'm': {
      lengthInUnit = pixelsToMeters(pixels, ppi)
      break
    }

    case 'mm': {
      lengthInUnit = pixelsToMillimeters(pixels, ppi)
      break
    }

    case 'px':
    default: {
      lengthInUnit = Math.round(pixels)
      break
    }
  }

  const formattedLengthInUnit = formatLengthUnit(lengthInUnit, toUnit)

  return formattedLengthInUnit
}

export function resizeDimensionFromResolutionToResolution(
  fromPpi: TemplateDimension['resolution'],
  toPpi: TemplateDimension['resolution'],
  lengthInUnit: number,
  measurementUnit: TemplateDimension['measurementUnit']
) {
  // Only resize when measurement unit equal to pixel unit because ppi (pixels per inch) calculated on pixels
  if (measurementUnit !== 'px') return lengthInUnit

  const lengthInPixel = lengthUnitToPixels(lengthInUnit, measurementUnit, fromPpi)

  const changeable = toPpi / fromPpi
  const a = lengthInPixel * changeable
  const _lengthInUnit = lengthUnitToLengthUnit('px', measurementUnit, a, fromPpi)

  return formatLengthUnit(_lengthInUnit, measurementUnit)
}

export function formatLengthUnit(
  length: number,
  measurementUnit: TemplateDimension['measurementUnit'],
  decimalPlaces = 4
) {
  return measurementUnit === 'px' ? Math.round(length) : +(isDecimal(length) ? length.toFixed(decimalPlaces) : length)
}
