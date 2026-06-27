export type CharmNodeSettings = {
  ds: 'FIXED' | 'FREE'
  sfl?: string
  mc: number
  ama: boolean
  ap?: 'top' | 'center' | 'bottom'
}

export type CharmSlotNode = {
  i: string
  x: number
  y: number
  sl: number
  l: string
  dc?: string
  /** Rotation in degrees, 0-359. Default 0. */
  r?: number
}

export type CharmLinkedProduct = {
  i: string
  pid: string
  vid?: string
  h?: string
  tr: Array<{ id: string; x: number; y: number; r: number; s: number }>
}

export type CharmNodeLayer = {
  t: 'charm-node'
  i: string
  s: CharmNodeSettings
  lp: CharmLinkedProduct[]
  nd: CharmSlotNode[]
}

export type CharmBuilderState = {
  assignments: Record<string, string>
  positions: Record<string, { x: number; y: number }>
  selectedSlotId?: string
  version: number
  updatedAt: number
}

export type CharmBuilderAction =
  | { type: 'assign'; slotId: string; charmId: string }
  | { type: 'remove'; slotId: string }
  | { type: 'select'; slotId?: string }
  | { type: 'set-position'; slotId: string; position: { x: number; y: number } }
  | { type: 'batch-positions'; positions: Record<string, { x: number; y: number }> }

/** Normalize any degree value into [0, 360). Returns 0 for NaN/undefined. */
export function clampDegrees(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0
  return ((value % 360) + 360) % 360
}
