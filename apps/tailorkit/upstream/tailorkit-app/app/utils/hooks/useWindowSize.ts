import { useEffect, useState } from 'react'

/**
 * If this hook is used in an embedded app, it will calculate the width of the embedded page's viewport.
 * Otherwise, it will calculate the actual size of the browser
 *
 * Please use this with caution since most pages of our app is embedded.
 */
export default function useWindowSize() {
  const [size, setSize] = useState(() => ({
    width:
      typeof window !== 'undefined'
        ? window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 0
        : 0,
    height:
      typeof window !== 'undefined'
        ? window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0
        : 0,
  }))

  useEffect(() => {
    function updateSize() {
      setSize({
        width: window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 0,
        height: window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0,
      })
    }

    window.addEventListener('resize', updateSize)

    updateSize()

    return () => window.removeEventListener('resize', updateSize)
  }, [])

  return size
}
