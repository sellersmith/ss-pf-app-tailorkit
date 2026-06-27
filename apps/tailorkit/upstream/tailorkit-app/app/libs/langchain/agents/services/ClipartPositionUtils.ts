/**
 * Utility functions for clipart positioning adjustments
 */

export interface ClipartPosition {
  x: number
  y: number
}

export interface ClipartDimensions {
  width: number
  height: number
}

export interface ClipartPositioning {
  position: ClipartPosition
  dimensions: ClipartDimensions
  rotation: number
  reasoning: string
}
