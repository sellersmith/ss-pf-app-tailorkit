/* eslint-disable */
let IDX = 36,
  HEX = ''
while (IDX--) {
  HEX += IDX.toString(36)
}

export function uid(len: number = 11) {
  let str = '',
    num = len || 11
  while (num--) {
    str += HEX[(Math.random() * 36) | 0]
  }
  return str
}

let SIZE = 4096,
  HEX2: any[] = [],
  IDX2 = 0,
  BUFFER: any

for (; IDX2 < 256; IDX2++) {
  HEX2[IDX2] = (IDX2 + 256).toString(16).substring(1)
}

export function uuid() {
  if (!BUFFER || IDX2 + 16 > SIZE) {
    BUFFER = crypto.getRandomValues(new Uint8Array(SIZE))
    IDX2 = 0
  }

  let i = 0,
    tmp,
    out = ''
  for (; i < 16; i++) {
    tmp = BUFFER[i + IDX2]
    if (i == 6) {
      out += HEX2[(tmp & 15) | 64]
    } else if (i == 8) {
      out += HEX2[(tmp & 63) | 128]
    } else {
      out += HEX2[tmp]
    }

    if (i & 1 && i > 1 && i < 11) {
      out += '-'
    }
  }

  IDX2++
  return out
}
const validationRegex = /^[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-4[A-Za-z0-9]{3}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}$/
export const validateUUID = (id?: string): boolean => {
  return typeof id === 'string' && validationRegex.test(id)
}

/**
 * Generate a random token of a given length
 * @param length - The length of the token to generate
 * @returns A random token of the given length
 */
export const generateToken = (length = 64) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)

  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length]
  }

  return result
}
