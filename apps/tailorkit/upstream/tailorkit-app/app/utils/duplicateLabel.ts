interface LabeledItem {
  label: string
  [key: string]: any // Allows additional properties
}

/**

 * @description This function is serving for generating duplicated label 
 * @param label 
 * @param items 
 * @returns string
 * 
 * @example
 * const items = [
    { label: "Layer A" },
    { label: "Layer A (1)" },
    { label: "Layer A (2)" },
    { label: "1" },
    { label: "1 (2)" },
  ];
  console.log(duplicateLabel("Layer A", items)); // Output: "Layer A (3)"
  console.log(duplicateLabel("1", items));       // Output: "1 (3)"
 */
export function duplicateLabel<T extends LabeledItem>(label: string, items: T[]): string {
  // Escape special characters in the label to safely use in the regex
  const escapedLabel = label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

  // Build a regex to match existing labels with optional "(x)" suffix
  const regex = new RegExp(`^${escapedLabel}( \\((\\d+)\\))?$`)

  // Collect matching labels
  const matchingLabels = items.filter(item => regex.test(item.label)).map(item => item.label)

  if (matchingLabels.length) {
    // Find the highest numeric suffix among matching labels
    const max = matchingLabels.reduce((highest, current) => {
      const match = current.match(/\((\d+)\)$/) // Extract the number from "(x)"
      const num = match ? parseInt(match[1], 10) : 0 // Defaults to 0 if no suffix
      return Math.max(highest, num)
    }, 0)

    // Generate the new label with incremented suffix
    label = `${label} (${max + 1})`
  }

  return label
}
