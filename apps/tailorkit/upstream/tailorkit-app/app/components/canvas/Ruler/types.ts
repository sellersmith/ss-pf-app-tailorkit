import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'

export interface Guide {
  id: string
  position: number
}

export interface GuidesState {
  horizontal: Guide[]
  vertical: Guide[]
}

export interface DraggedGuideState {
  id: string
  isHorizontal: boolean
  position: number
}

export interface TickData {
  position: number
  screenPos: number
  tickSize: number
  showLabel: boolean
}

export interface CanvasRulerProps {
  id: string
  width: number // Canvas width
  height: number // Canvas height
  rulerColor?: string // Color of the ruler. Default: rgba(0, 100, 255)
  displayTextColor?: string // Color of the text on the ruler. Default: rgba(0, 100, 255)
  rulerThickness?: number // Size of ruler in pixels. Default: 20
  scale?: number // Current zoom level. Default: 1
  stagePos?: { x: number; y: number } // Current stage position (for panning). Default: { x: 0, y: 0 }
  layerPos?: { x: number; y: number } // Current layer position (for panning). Default: { x: 0, y: 0 }
  gridSize?: number // Base grid size (will be affected by zoom). Default: 10
  showRulers?: boolean // Toggle rulers visibility. Default: true
  containerRef?: React.RefObject<HTMLDivElement> // Reference to parent container for dynamic sizing
  guides: GuidesState // Guides to display
  measurementUnit?: MEASUREMENT_UNIT // Measurement unit. Default: 'px'
  resolution?: number // Resolution. Default: 300
  setGuides: (guides: GuidesState) => void // Function to set guides
}
