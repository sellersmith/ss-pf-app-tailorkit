import type { CharmProductRef, CharmTransformInstance } from '~/types/psd'

/** Flattened charm instance — one per transform entry across all products */
export type CharmInstance = {
  product: CharmProductRef
  instanceId: string
  transform: CharmTransformInstance
}
