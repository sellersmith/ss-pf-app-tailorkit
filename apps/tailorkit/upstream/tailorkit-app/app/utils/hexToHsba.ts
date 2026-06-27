import type { HSBAColor, RGBAColor } from '@shopify/polaris'
import { hsbToRgb, rgbToHsb } from '@shopify/polaris'

const removeHash = (hex: string) => (hex.charAt(0) === '#' ? hex.slice(1) : hex)

const hexToDecimal = (hex: string) => parseInt(hex, 16)

export const hexToRgba = (hex: string): RGBAColor => {
  try {
    const hashlessHex = removeHash(hex)
    const isShort = hashlessHex.length === 3 || hashlessHex.length === 4

    const twoDigitHexR = isShort ? `${hashlessHex.slice(0, 1)}${hashlessHex.slice(0, 1)}` : hashlessHex.slice(0, 2)
    const twoDigitHexG = isShort ? `${hashlessHex.slice(1, 2)}${hashlessHex.slice(1, 2)}` : hashlessHex.slice(2, 4)
    const twoDigitHexB = isShort ? `${hashlessHex.slice(2, 3)}${hashlessHex.slice(2, 3)}` : hashlessHex.slice(4, 6)
    const twoDigitHexA
      = (isShort ? `${hashlessHex.slice(3, 4)}${hashlessHex.slice(3, 4)}` : hashlessHex.slice(6, 8)) || 'ff'

    // const numericA = +((parseInt(a, 16) / 255).toFixed(2));

    return {
      red: hexToDecimal(twoDigitHexR),
      green: hexToDecimal(twoDigitHexG),
      blue: hexToDecimal(twoDigitHexB),
      alpha: +(hexToDecimal(twoDigitHexA) / 255).toFixed(2),
    }
  } catch (error) {
    return {
      red: 0,
      green: 0,
      blue: 0,
      alpha: 1,
    }
  }
}

export const hexToHsba = (hexColor: string): HSBAColor => {
  const { red, green, blue, alpha } = hexToRgba(hexColor)
  return { ...rgbToHsb({ red, green, blue }), alpha }
}

export const rgbaToHsba = (rgba: RGBAColor): HSBAColor => {
  const { red, green, blue, alpha } = rgba
  return { ...rgbToHsb({ red, green, blue }), alpha }
}

// Convert RGBA to HEX
export const rgbaToHex = (rgba: RGBAColor): string => {
  const toHex = (n: number) => {
    const hex = n.toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }

  const { red, green, blue, alpha } = rgba
  const alphaHex = Math.round(alpha * 255)

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}${toHex(alphaHex)}`
}

// Convert HSBA to HEX
export const hsbaToHex = (hsba: HSBAColor): string => {
  const rgba = hsbToRgb(hsba) as RGBAColor
  return rgbaToHex(rgba)
}
