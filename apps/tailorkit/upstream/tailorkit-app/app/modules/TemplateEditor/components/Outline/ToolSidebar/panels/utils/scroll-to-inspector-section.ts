/**
 * Scroll to a heading inside `.template-inspector-content` that matches any of the given keywords.
 * Uses MutationObserver to wait for the container and headings to render,
 * with a 2s timeout to avoid leaking observers.
 */
export function scrollToInspectorSection(keywords: string[]): void {
  const CONTAINER_SELECTOR = '.template-inspector-content'
  const TIMEOUT_MS = 2000

  const tryScroll = (): boolean => {
    const container = document.querySelector(CONTAINER_SELECTOR)
    if (!container) return false

    const headings = container.querySelectorAll('h3')
    for (const heading of headings) {
      const text = heading.textContent?.trim().toLowerCase() || ''
      if (keywords.some(kw => text.includes(kw))) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return true
      }
    }
    return false
  }

  // Try immediately first
  if (tryScroll()) return

  // Fall back to MutationObserver for async-rendered content
  const observer = new MutationObserver(() => {
    if (tryScroll()) {
      observer.disconnect()
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // Cleanup after timeout to prevent leaks
  setTimeout(() => {
    observer.disconnect()
    // Final fallback: scroll to bottom of container
    const container = document.querySelector(CONTAINER_SELECTOR)
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }, TIMEOUT_MS)
}
