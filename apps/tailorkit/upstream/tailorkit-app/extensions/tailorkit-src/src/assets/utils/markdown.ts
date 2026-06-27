import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Sanitize and render markdown content safely with enhanced XSS protection
 *
 * This function configures DOMPurify with strict settings to prevent XSS attacks:
 * - Disallows all dangerous HTML tags and attributes
 * - Sanitizes URLs to prevent javascript: protocol exploits
 * - Prevents DOM clobbering attacks
 *
 * @param content - The markdown content to sanitize and render
 * @returns Sanitized HTML string
 */
export const sanitizeMarkdown = (content: string): string => {
  if (!content) return ''

  // Configure DOMPurify with strict security settings
  const purifyConfig = {
    ALLOWED_TAGS: [
      'p',
      'b',
      'i',
      'em',
      'strong',
      'a',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'br',
      'span',
      'div',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'object', 'embed', 'link'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ADD_ATTR: ['target'], // For links
    FORCE_BODY: true,
    SANITIZE_DOM: true,
    PREVENT_CLOBBERING: true,
    USE_PROFILES: { html: true },
  }

  // First convert markdown to HTML
  const html = marked.parse(content)

  // Then sanitize the HTML to prevent XSS
  if (typeof html !== 'string') return ''

  // Ensure we're in a browser environment where DOMPurify can work
  if (typeof window === 'undefined') {
    // If not in browser, do basic sanitization
    return html.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  return DOMPurify.sanitize(html, purifyConfig)
}
