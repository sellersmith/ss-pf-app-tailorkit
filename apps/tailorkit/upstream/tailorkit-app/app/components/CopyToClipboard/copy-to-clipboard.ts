import { showToastI18n } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'

interface CopyOptions {
  debug?: boolean
  format?: string
  onCopy?: (clipboardData: DataTransfer | null) => void
}

/**
 * Copy text to clipboard
 * @param text - The text to copy
 * @param options - The options for the copy
 * @returns True if the text was copied, false otherwise
 */
export function copyToClipboard(text: string, options: CopyOptions = {}): boolean {
  const { debug = false, format: contentFormat, onCopy } = options
  let success = false

  try {
    // Create a temporary element
    const mark = document.createElement('span')
    mark.textContent = text
    mark.ariaHidden = 'true'
    // Reset user styles for span element
    mark.style.all = 'unset'
    mark.style.position = 'fixed'
    mark.style.top = '0'
    mark.style.clip = 'rect(0, 0, 0, 0)'
    mark.style.whiteSpace = 'pre'
    mark.style.webkitUserSelect = 'text'
    mark.style.userSelect = 'text'

    mark.addEventListener('copy', (e: ClipboardEvent) => {
      e.stopPropagation()
      if (contentFormat && e.clipboardData) {
        e.preventDefault()
        // Modern browsers
        e.clipboardData.clearData()
        e.clipboardData.setData(contentFormat, text)
      }
      if (onCopy) {
        e.preventDefault()
        onCopy(e.clipboardData)
      }
    })

    document.body.appendChild(mark)

    const range = document.createRange()
    range.selectNodeContents(mark)

    const selection = document.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }

    success = document.execCommand('copy')
    if (!success) {
      throw new Error('copy command was unsuccessful')
    }

    // Cleanup
    document.body.removeChild(mark)
    if (selection) {
      selection.removeAllRanges()
    }
  } catch (err) {
    debug && console.error('unable to copy using execCommand: ', err)
    debug && console.warn('falling back to prompt')
    try {
      if (window.clipboardData) {
        window.clipboardData.setData(contentFormat || 'text', text)
        if (onCopy) onCopy(null)
        success = true
      } else {
        showToastI18n(TOAST.COMMON.CLIPBOARD_BLOCKED)
      }
    } catch (err) {
      debug && console.error('unable to copy using clipboardData: ', err)
      debug && console.error('falling back to prompt')
      showToastI18n(TOAST.COMMON.CLIPBOARD_BLOCKED)
    }
  }

  return success
}
