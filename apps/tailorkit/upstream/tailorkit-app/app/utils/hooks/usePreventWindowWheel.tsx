import { useEffect } from 'react'

function usePreventWindowWheel() {
  function preventWheel(e: WheelEvent) {
    e.preventDefault()
  }

  useEffect(() => {
    window.addEventListener('wheel', e => preventWheel, { passive: false })

    return () => {
      window.removeEventListener('wheel', preventWheel)
    }
  }, [])
}

export default usePreventWindowWheel
