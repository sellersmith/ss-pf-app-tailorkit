/**
 * SVG Optimization Utilities (Server-side)
 *
 * Functions for optimizing SVG using SVGO.
 */

import { optimize, type Config } from 'svgo'

/**
 * Options for SVG optimization
 */
export interface SvgOptimizationOptions {
  /** Remove viewBox attribute (default: false - keep it for scaling) */
  removeViewBox?: boolean
  /** Remove xmlns attribute (default: false - keep for data URI rendering) */
  removeXMLNS?: boolean
  /** Remove width/height and make responsive (default: true) */
  removeDimensions?: boolean
}

/**
 * Optimize SVG using SVGO
 *
 * @param svgString - SVG string to optimize
 * @param options - Optimization options
 * @returns Optimized SVG string
 */
export async function optimizeSvg(svgString: string, options: SvgOptimizationOptions = {}): Promise<string> {
  const { removeViewBox = false, removeXMLNS = false, removeDimensions = true } = options

  try {
    const config: Config = {
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              removeViewBox, // Keep viewBox for proper scaling
              removeXMLNS, // Keep xmlns - required for data URI rendering
            },
          },
        },
      ],
    }

    // Add removeDimensions plugin if enabled
    if (removeDimensions) {
      config.plugins!.push('removeDimensions')
    }

    const result = optimize(svgString, config)
    return result.data
  } catch (error) {
    console.error('SVGO optimization failed, returning original SVG:', error)
    return svgString // Return original if optimization fails
  }
}

/**
 * Minify SVG by removing whitespace and comments
 * Lightweight alternative to full SVGO optimization
 *
 * @param svgString - SVG string to minify
 * @returns Minified SVG string
 */
export function minifySvg(svgString: string): string {
  return svgString
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim()
}
