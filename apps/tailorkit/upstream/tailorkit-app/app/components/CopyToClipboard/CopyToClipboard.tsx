import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { copyToClipboard } from './copy-to-clipboard'

interface CopyToClipboardProps {
  text: string
  onCopy?: (text: string, result: boolean) => void
  options?: {
    debug?: boolean
    message?: string
    format?: string
  }
  children: ReactNode | ((isCopied: boolean) => ReactNode)
}

export function CopyToClipboard({ text, onCopy, options, children }: CopyToClipboardProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleClick = useCallback(() => {
    const result = copyToClipboard(text, options)
    if (onCopy) {
      onCopy(text, result)
    }
    setIsCopied(result)

    // Reset the copied state after 2 seconds
    if (result) {
      setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    }
  }, [text, options, onCopy])

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick()
        }
      }}
      style={{ cursor: 'pointer', width: 'fit-content' }}
    >
      {typeof children === 'function' ? children(isCopied) : children}
    </div>
  )
}
