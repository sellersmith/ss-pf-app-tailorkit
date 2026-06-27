/**
 * Retry mounting logic with configurable attempts and delay
 * Useful for mounting components that depend on DOM readiness or async data availability
 *
 * @param check - Function that returns true when mount is successful
 * @param onSuccess - Callback when mount succeeds
 * @param maxAttempts - Maximum number of retry attempts (default: 8)
 * @param delayMs - Delay between attempts in milliseconds (default: 16)
 */
export function retryMount(check: () => boolean, onSuccess: () => void, maxAttempts = 8, delayMs = 16): void {
  let attempts = 0

  const attempt = () => {
    if (check()) {
      onSuccess()
      return
    }

    if (attempts < maxAttempts) {
      attempts++
      setTimeout(attempt, delayMs)
    }
  }

  attempt()
}
