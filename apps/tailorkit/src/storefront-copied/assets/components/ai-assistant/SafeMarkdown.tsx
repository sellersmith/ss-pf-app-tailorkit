/** @jsxImportSource preact */
import { useMemo } from 'preact/hooks'
import { sanitizeMarkdown } from '../../utils/markdown'

interface SafeMarkdownProps {
  content: string
  className?: string
}

/**
 * A component that safely renders markdown content with XSS protection
 *
 * This component:
 * 1. Sanitizes markdown content using DOMPurify with strict settings
 * 2. Memoizes the result to prevent unnecessary re-renders
 * 3. Uses dangerouslySetInnerHTML in a controlled way
 *
 * @param props - Component props with content to render
 * @returns A div element with sanitized HTML
 */
export function SafeMarkdown({ content, className = '' }: SafeMarkdownProps) {
  // Memoize the sanitized content to prevent unnecessary re-rendering
  const sanitizedHtml = useMemo(() => {
    if (!content || typeof content !== 'string') return ''
    return sanitizeMarkdown(content)
  }, [content])

  // If there's no content, don't render anything
  if (!sanitizedHtml) return null

  return (
    <div
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
