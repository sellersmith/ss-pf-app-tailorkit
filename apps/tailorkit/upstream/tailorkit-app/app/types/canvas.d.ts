type Snap = 'start' | 'center' | 'end'
type SnappingEdges = {
  vertical: Array<{
    guide: number
    offset: number
    snap: Snap
  }>
  horizontal: Array<{
    guide: number
    offset: number
    snap: Snap
  }>
}

export type { Snap, SnappingEdges }
