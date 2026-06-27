import { BASE_CLICK_COUNT } from '~/routes/api.cliparts/constants'

/**
 * Sort cliparts by usage (clicks high-to-low, then name A-Z)
 *
 * @param items - Array of clipart items to sort
 * @param clickCounts - Map of clipartId to clickCount (already includes +BASE_CLICK_COUNT from API)
 * @returns Sorted array of clipart items
 */
export function sortClipartsByUsage<T extends { _id: string; name?: string; alt?: string }>(
  items: T[],
  clickCounts: Map<string, number> = new Map()
): T[] {
  return [...items].sort((a, b) => {
    const aClickCount = clickCounts.get(a._id) || BASE_CLICK_COUNT // Fallback if not in map
    const bClickCount = clickCounts.get(b._id) || BASE_CLICK_COUNT // Fallback if not in map

    // Primary sort: clicks high-to-low
    if (aClickCount !== bClickCount) {
      return bClickCount - aClickCount
    }

    // Secondary sort: name A-Z
    const aName = (a.name || a.alt || a._id).toLowerCase()
    const bName = (b.name || b.alt || b._id).toLowerCase()

    if (aName < bName) return -1
    if (aName > bName) return 1
    return 0
  })
}
