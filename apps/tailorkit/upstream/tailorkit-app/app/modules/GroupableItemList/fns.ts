/**
 * Get the ancestor visible status
 * @param ancestorVisible - The ancestor visible status
 * @param itemVisible - The item visible status
 * @returns The ancestor visible status
 */
export function getAncestorVisible(ancestorVisible?: boolean, itemVisible?: boolean) {
  // 1. Check if the ancestor is not visible
  const isAncestorInvisible = ancestorVisible === false
  // 2. If the ancestor is not visible, we pass the ancestorVisible to the renderItem, if it's false all the ancestor under also is not visible
  // so that the item is not rendered if the ancestor is not visible.
  const _ancestorVisible = isAncestorInvisible ? false : itemVisible

  return _ancestorVisible
}
