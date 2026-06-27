import type { MEASUREMENT_UNIT } from '../constants/measurement-units'
import type { RESOLUTION } from '../constants/resolution'

export type Position = {
  x: number
  y: number
}

export type Dimension = {
  width: number
  height: number
}

export type ViewPort = {
  scale: number
  left: number
  top: number
}

export type TemplateDimension = {
  width: number
  height: number
  measurementUnit: MEASUREMENT_UNIT
  resolution: number | RESOLUTION
}

/**
 * Response type for cloning a clipart template
 */
export interface CloneClipartResponse {
  templateId: string
  templateName: string
  isFirstTemplate: boolean
}

/**
 * Request payload for cloning a clipart template
 */
export interface CloneClipartRequest {
  clipartId: string
}

/**
 * Template with cloning capabilities
 */
export interface ClonableTemplate {
  _id: string
  name: string
  type: 'clipart' | 'premade-template' | 'template'
  category?: string
  isFromTailorkit?: boolean
  previewUrl?: string
  shopDomain: string
}
