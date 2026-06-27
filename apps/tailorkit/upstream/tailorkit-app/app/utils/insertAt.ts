export function insertAt<T>(array: T[], index: number, newItem: T): T[] {
  return [
    ...array.slice(0, index), // Elements before the insertion point
    newItem, // The new item to insert
    ...array.slice(index), // Elements after the insertion point
  ]
}
