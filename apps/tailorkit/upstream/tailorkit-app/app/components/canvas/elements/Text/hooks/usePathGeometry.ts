import { useMemo } from 'react'
import { generateCurvePath } from '../utils/pathGenerator'
import { scaleCustomPathToFit } from '../utils/scaleCustomPathToFit'
import { generateTextPath, calculatePathGeometry } from 'extensions/tailorkit-src/src/shared/libraries/konva/text'
import type { TextSettings } from '~/types/psd'

interface PathGeometryOptions {
  width: number
  height: number
  fontSize: number
  textShape: TextSettings['textShape']
  circleStartAngle: number
  circleEndAngle: number
  circleInverted?: boolean
  curvePeaks?: number
  curveBend?: number
  customPathData?: string
  customPathMetadata?: {
    viewBoxWidth: number
    viewBoxHeight: number
  }
  customPathInverted?: boolean
  fontFamily: string
  color: string
  align: string
  verticalAlign: string
}

/**
 * Custom hook for optimized path geometry calculations
 * Provides memoized path data for KonvaTextPath components
 */
export function usePathGeometry({
  width,
  height,
  fontSize,
  textShape,
  circleStartAngle,
  circleEndAngle,
  circleInverted = false,
  curvePeaks = 1,
  curveBend = 50,
  customPathData,
  customPathMetadata,
  customPathInverted = false,
  fontFamily,
  color,
  align,
  verticalAlign,
}: PathGeometryOptions) {
  // Use shared utility for path generation
  const result = useMemo(() => {
    // Handle custom path from VectorEditor
    if (textShape === 'custom' && customPathData) {
      const scaledPath = scaleCustomPathToFit(customPathData, width, height, {
        metadata: customPathMetadata,
        inverted: customPathInverted,
      })
      const pathGeometry = calculatePathGeometry(width, height)

      return {
        pathGeometry,
        fullCirclePath: '',
        textPath: scaledPath,
      }
    }

    if (textShape === 'curve') {
      // Generate sinusoidal curve path with proper peaks and bend
      const curvePath = generateCurvePath(width, height, curvePeaks, curveBend, fontSize || 0)

      // Also calculate geometry for compatibility (using straight line as base)
      const { pathGeometry, fullCirclePath } = generateTextPath({
        width,
        height,
        fontSize: fontSize || 0,
        textShape: 'none', // Use none for base geometry since we have custom curve
        circleStartAngle,
        circleEndAngle,
        fontFamily: fontFamily || 'Arial',
        color: color || '#000000',
        align: align || 'center',
        verticalAlign: verticalAlign || 'middle',
      })

      return {
        pathGeometry,
        fullCirclePath,
        textPath: curvePath,
      }
    }

    // Handle fill-shape as 'none' for path geometry (it uses separate rendering)
    // Use shared utility for circle and other shapes
    const shapeForPath = textShape === 'fill-shape' ? 'none' : textShape || 'none'

    return generateTextPath({
      width,
      height,
      fontSize: fontSize || 0,
      textShape: shapeForPath,
      circleStartAngle,
      circleEndAngle,
      circleInverted,
      fontFamily: fontFamily || 'Arial',
      color: color || '#000000',
      align: align || 'center',
      verticalAlign: verticalAlign || 'middle',
    })
  }, [
    textShape,
    width,
    height,
    fontSize,
    circleStartAngle,
    circleEndAngle,
    circleInverted,
    curvePeaks,
    curveBend,
    customPathData,
    customPathMetadata,
    customPathInverted,
    fontFamily,
    color,
    align,
    verticalAlign,
  ])

  return result
}
