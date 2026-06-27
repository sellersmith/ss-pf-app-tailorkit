/**
 * Clear all property of object
 * @param obj
 */
export function clearObject(obj: any) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      delete obj[key]
    }
  }
}
