import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useEffect, useState } from 'react'

/**
 * Custom React hook to track whether the Largest Contentful Paint (LCP) event has been recorded.
 * This hook ensures the LCP state is updated, even if the event doesn't trigger due to dynamic rendering without a page reload.
 */

function useLCPRecorded() {
  const [lcpRecorded, _setLcpRecorded] = useState(false)

  useEffect(() => {
    function setLcpRecorded() {
      _setLcpRecorded(true)
    }

    // Manual toggle the state in case LCP event not triggered because the screen is rendered without reloading the page
    setTimeout(setLcpRecorded, 3000)

    Transmitter.listen('lcp-recorded', setLcpRecorded)

    return () => Transmitter.remove('lcp-recorded', setLcpRecorded)
  }, [])

  return lcpRecorded
}

export default useLCPRecorded
