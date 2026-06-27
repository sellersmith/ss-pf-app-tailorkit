/**
 * @description This function sets the position of the caret in a dynamic position
 * @param {HTMLElement} el The HTML element
 * @param {number} position Position on the element being set
 */

export const placeCaretAtPosition = (el: HTMLElement, position: number) => {
  el.focus()
  const textNode = el.firstChild as Text | null

  if (textNode && typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
    const range = document.createRange()
    const sel = window.getSelection()
    const textLength = textNode.length

    // Make sure the cursor position is within a valid range
    const validPosition = Math.min(position, textLength)

    // Set cursor position
    range.setStart(textNode, validPosition)
    range.collapse(true)

    sel?.removeAllRanges()
    sel?.addRange(range)
  }
}
