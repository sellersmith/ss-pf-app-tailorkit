import { useEffect } from 'react'

/**
 * Custom hook to inject the Satismeter script.
 */
export const useSatismeter = () => {
  // Load the Satismeter script
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(function () {
        window.satismeter
          = window.satismeter
          || function () {
            ;(window.satismeter.q = window.satismeter.q || []).push(arguments)
          }

        // @ts-ignore
        window.satismeter.l = 1 * new Date()
        // @ts-ignore
        const script = document.createElement('script')
        // @ts-ignore
        const parent = document.getElementsByTagName('script')[0].parentNode
        // @ts-ignore
        script.async = 1
        // @ts-ignore
        script.src = 'https://app.satismeter.com/js'
        // @ts-ignore
        parent.appendChild(script)
      })()
    }
  }, [])
}
