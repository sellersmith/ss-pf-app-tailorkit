import { useEffect, useState } from 'react'
import loadCSS from '../loadCSS'

export default function usePreloadCSS(path: string) {
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    loadCSS(path)
      .then(() => setLoading(false))
      .catch(error => console.error('Error loading CSS:', error))
  }, [path])

  return isLoading
}
