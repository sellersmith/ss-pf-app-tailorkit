import union from 'lodash/union'
import reduce from 'lodash/reduce'
import isEqual from 'lodash/isEqual'

export const differencesObject = (object1: any, object2: any) => {
  // Get all unique keys from both objects
  const allKeys = union(Object.keys(object1), Object.keys(object2))

  // Check differences across all keys
  const differences = reduce(
    allKeys,
    (result, key) => {
      if (!isEqual(object1[key], object2[key])) {
        ;(result as any)[key] = {
          oldValue: object1[key],
          newValue: object2[key],
        }
      }
      return result
    },
    {}
  )

  return differences
}
