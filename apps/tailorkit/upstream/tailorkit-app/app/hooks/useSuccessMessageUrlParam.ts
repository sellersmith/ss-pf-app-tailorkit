import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from '@remix-run/react'

/**
 * Custom hook to handle success message URL parameter in parent frame
 * Detects 'showSuccessMessage' parameter, passes it to iframe, and cleans up URL
 */
export function useSuccessMessageUrlParam() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [passSuccessMessage, setPassSuccessMessage] = useState(false)
  const successMessageProcessed = useRef(false)

  // Check for success message parameter once and clean it up
  useEffect(() => {
    if (successMessageProcessed.current) return

    const showSuccessMessage = searchParams.get('showSuccessMessage')
    if (showSuccessMessage === 'true') {
      successMessageProcessed.current = true
      setPassSuccessMessage(true)

      // Clean up immediately to prevent infinite loop
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.delete('showSuccessMessage')
      setSearchParams(newSearchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  return {
    /** Whether to pass the success message parameter to iframe */
    passSuccessMessage,
    /** Whether the parameter has been processed */
    isProcessed: successMessageProcessed.current,
  }
}
