/**
 * Get the value of an enum by its key
 *
 * @param enumObj
 * @param value
 * @returns
 */
export function getEnumKeyByValue<T extends object>(enumObj: T, value: string): string | undefined {
  return Object.keys(enumObj).find(key => enumObj[key as keyof T] === value)
}

/**
 * Utility function to get enum keys by their values
 * @param enumObj - The enum object
 * @param values - Array of enum values
 * @returns Object with enum keys
 */
export function getEnumKeysByValues<T extends object>(enumObj: T, values: (keyof T)[]): Record<string, string> {
  return values.reduce(
    (acc, value) => {
      const key = getEnumKeyByValue(enumObj, enumObj[value] as unknown as string)
      if (key !== undefined) {
        acc[value as string] = key
      }
      return acc
    },
    {} as Record<string, string>
  )
}
