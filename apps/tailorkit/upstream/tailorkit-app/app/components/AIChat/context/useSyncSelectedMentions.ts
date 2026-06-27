import { useEffect, useRef } from 'react'

type Resolver = (selectedItem: any) => Partial<any> | undefined

interface UseSyncSelectedMentionsArgs<T> {
  selected: T[]
  setSelected: (next: T[]) => void
  resolvers: Resolver[]
}

/**
 * Generic synchronizer for selected mention items across entity types.
 * It merges display fields from latest sources using provided resolvers,
 * preserving identity fields to avoid UI flicker.
 */
export function useSyncSelectedMentions<T extends { cardId?: string }>(args: UseSyncSelectedMentionsArgs<T>) {
  const { selected, setSelected, resolvers } = args
  const prevHashRef = useRef<string>('')

  useEffect(() => {
    if (!Array.isArray(selected) || selected.length === 0) return

    let changed = false
    const nextSelected = selected.map(item => {
      let merged: Partial<T> | undefined
      for (const resolve of resolvers) {
        const patch = resolve(item)
        if (patch && Object.keys(patch).length) {
          merged = { ...(merged as any), ...(patch as any) }
        }
      }
      if (!merged) return item
      const next = { ...(item as any), ...(merged as any) } as T
      const nextKey = JSON.stringify({ n: (next as any).name, p: (next as any).previewUrl, e: (next as any).isEditor })
      const prevKey = JSON.stringify({ n: (item as any).name, p: (item as any).previewUrl, e: (item as any).isEditor })
      if (nextKey !== prevKey) {
        changed = true
      }
      return next
    })

    if (!changed) return

    const hash = JSON.stringify(nextSelected.map(i => ({ id: (i as any).cardId, n: (i as any).name })))
    if (hash === prevHashRef.current) return
    prevHashRef.current = hash

    setSelected(nextSelected)
  }, [selected, setSelected, resolvers])
}
