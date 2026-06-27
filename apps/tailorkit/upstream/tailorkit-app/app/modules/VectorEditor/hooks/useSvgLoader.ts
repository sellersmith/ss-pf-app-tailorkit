/**
 * useSvgLoader - Loads SVG content with full effects parsing
 * Extracts gradients, filters, masks, and clip paths from SVG content
 */

import { useState, useEffect, useMemo } from 'react'
import {
  decodeSvgDataUri,
  parseSvgString,
  extractGradients,
  extractFilters,
  extractMasks,
  extractClipPaths,
  createEmptyDefs,
  convertToExtendedSvg,
} from '../utils/svg'
import type { ParsedSvg, ParsedSvgExtended, SvgDefs } from '../types'

interface UseSvgLoaderOptions {
  svgDataUri?: string
  svgUrl?: string
  /** Whether to parse extended SVG features (gradients, filters, masks, clips) */
  parseEffects?: boolean
  /** Whether SVG loading is enabled (defaults to true) */
  enabled?: boolean
}

interface UseSvgLoaderReturn {
  /** Raw SVG string */
  svgString: string | null
  /** Basic parsed SVG (paths only) */
  parsedSvg: ParsedSvg | null
  /** Extended parsed SVG (with styles) - only if parseEffects is true */
  parsedSvgExtended: ParsedSvgExtended | null
  /** Extracted SVG defs (gradients, filters, masks, clips) */
  defs: SvgDefs
  /** Indices of paths marked as clip paths (from data-clip attribute) */
  clipPathIndices: number[]
  /** Indices of paths marked as hole paths (from data-hole attribute) */
  holePathIndices: number[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
}

export function useSvgLoader({
  svgDataUri,
  svgUrl,
  parseEffects = true,
  enabled = true,
}: UseSvgLoaderOptions): UseSvgLoaderReturn {
  const [svgString, setSvgString] = useState<string | null>(null)
  const [parsedSvg, setParsedSvg] = useState<ParsedSvg | null>(null)
  const [defs, setDefs] = useState<SvgDefs>(createEmptyDefs())
  const [clipPathIndices, setClipPathIndices] = useState<number[]>([])
  const [holePathIndices, setHolePathIndices] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load SVG content
  useEffect(() => {
    // Reset state
    setSvgString(null)
    setParsedSvg(null)
    setDefs(createEmptyDefs())
    setClipPathIndices([])
    setHolePathIndices([])
    setError(null)

    // If disabled, don't attempt to load anything (used for raster-only mode)
    if (!enabled) {
      return
    }

    // Priority: svgDataUri > svgUrl
    if (svgDataUri) {
      try {
        const decoded = decodeSvgDataUri(svgDataUri)
        setSvgString(decoded)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to decode SVG data URI')
      }
      return
    }

    if (svgUrl) {
      setIsLoading(true)

      fetch(svgUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`)
          }
          return response.text()
        })
        .then(text => {
          // Validate that it's actually SVG content
          if (!text.includes('<svg') && !text.includes('<SVG')) {
            throw new Error('Invalid SVG content: response does not contain SVG markup')
          }
          setSvgString(text)
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Failed to fetch SVG')
        })
        .finally(() => {
          setIsLoading(false)
        })

      return
    }

    // Neither provided - no SVG to load
    setError('No SVG source provided')
  }, [svgDataUri, svgUrl, enabled])

  // Parse SVG when content is loaded
  useEffect(() => {
    if (!svgString) return

    try {
      // Basic parsing
      const parsed = parseSvgString(svgString)
      setParsedSvg(parsed)

      // Parse effects if enabled
      if (parseEffects) {
        // Create a DOM parser for extracting defs
        const parser = new DOMParser()
        const doc = parser.parseFromString(svgString, 'image/svg+xml')
        const svgElement = doc.querySelector('svg')

        if (svgElement) {
          // Extract all defs using the SVG string (outerHTML)
          const svgContent = svgElement.outerHTML
          const gradients = extractGradients(svgContent)
          const filters = extractFilters(svgContent)
          const masks = extractMasks(svgContent)
          const clipPaths = extractClipPaths(svgContent)

          setDefs({
            gradients,
            filters,
            masks,
            clipPaths,
          })

          // Extract clip/hole path markers from data attributes
          // These are serialized by rebuildSvgStringExtended for round-trip preservation
          // Only select paths that are direct children of SVG, not paths inside defs/mask/clipPath/etc.
          const allPathElements = svgElement.querySelectorAll('path')
          const clipIndices: number[] = []
          const holeIndices: number[] = []

          // Filter out paths that are inside definition elements
          const defContainers = ['defs', 'mask', 'clipPath', 'pattern', 'symbol', 'marker']
          let editablePathIndex = 0

          allPathElements.forEach(pathEl => {
            // Check if this path is inside a definition element
            let parent = pathEl.parentElement
            let isInsideDef = false
            while (parent && parent !== (svgElement as Element)) {
              if (defContainers.includes(parent.tagName.toLowerCase())) {
                isInsideDef = true
                break
              }
              parent = parent.parentElement
            }

            // Only process paths that are not inside definition elements
            if (!isInsideDef) {
              if (pathEl.getAttribute('data-clip') === 'true') {
                clipIndices.push(editablePathIndex)
              }
              if (pathEl.getAttribute('data-hole') === 'true') {
                holeIndices.push(editablePathIndex)
              }
              editablePathIndex++
            }
          })

          setClipPathIndices(clipIndices)
          setHolePathIndices(holeIndices)
        }
      }
    } catch (err) {
      console.error('Failed to parse SVG:', err)
      setError(err instanceof Error ? err.message : 'Failed to parse SVG')
    }
  }, [svgString, parseEffects])

  // Convert to extended format
  const parsedSvgExtended = useMemo(() => {
    if (!parsedSvg || !parseEffects) return null

    try {
      return convertToExtendedSvg(parsedSvg, defs)
    } catch (err) {
      console.error('Failed to convert to extended SVG:', err)
      return null
    }
  }, [parsedSvg, defs, parseEffects])

  return {
    svgString,
    parsedSvg,
    parsedSvgExtended,
    defs,
    clipPathIndices,
    holePathIndices,
    isLoading,
    error,
  }
}

export default useSvgLoader
