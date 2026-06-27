import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GoogleFontsFiltersArtifact } from './types'

let cachedArtifact: GoogleFontsFiltersArtifact | null = null

export function useGoogleFontsFiltersDataInternal(options: { enabled: boolean }) {
  const [data, setData] = useState<GoogleFontsFiltersArtifact | null>(cachedArtifact)
  const [loading, setLoading] = useState(!cachedArtifact && options.enabled)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    if (!options.enabled) return
    if (cachedArtifact) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${window.PUBLIC_ENV.BASE_URL}fonts/google-fonts.filters.json`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch google-fonts.filters.json (${response.status})`)
      }

      const json = (await response.json()) as GoogleFontsFiltersArtifact
      cachedArtifact = json
      setData(json)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      if (message.toLowerCase().includes('abort')) return
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [options.enabled])

  useEffect(() => {
    if (!options.enabled) return () => undefined
    void fetchData()
    return () => abortRef.current?.abort()
  }, [fetchData, options.enabled])

  const styles = useMemo(() => data?.styles?.groups || [], [data])
  const languages = useMemo(() => data?.languages || [], [data])

  return { data, styles, languages, loading, error }
}

export function useGoogleFontsFiltersData() {
  return useGoogleFontsFiltersDataInternal({ enabled: true })
}
