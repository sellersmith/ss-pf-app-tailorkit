export const smoothScrollToElement = (element: HTMLElement, center: boolean = true): void => {
  if (!element) return

  // Attempt native smooth scroll first
  try {
    element.scrollIntoView({
      behavior: 'smooth',
      block: center ? 'center' : 'nearest',
      inline: 'nearest',
    })
  } catch (_) {
    // Fallback for browsers that do not support smooth behaviour
    element.scrollIntoView(center)
  }

  // Manual fallback if the theme or browser ignores smooth behaviour
  setTimeout(() => {
    const bounding = element.getBoundingClientRect()
    const targetY = bounding.top + window.pageYOffset - (center ? window.innerHeight / 2 - bounding.height / 2 : 0)
    const distance = Math.abs(window.pageYOffset - targetY)

    if (distance > 20) {
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }, 50)
}
