/**
 * Safely access window functions for TailorKit
 * This allows for custom implementations to override default behavior
 */
export function windowFunctionCustom(): Record<string, any> {
  if (typeof window === 'undefined') {
    return {}
  }

  // Create a namespace for TailorKit functions on window
  if (!window.TailorKit) {
    window.TailorKit = {}
  }

  return {
    // Interceptor reset function
    RESET_INTERCEPTOR_FETCH_API: window.TailorKit.RESET_INTERCEPTOR_FETCH_API,
  }
}

// Declare global window interface extension
declare global {
  interface Window {
    TailorKit?: Record<string, any>
  }
}
