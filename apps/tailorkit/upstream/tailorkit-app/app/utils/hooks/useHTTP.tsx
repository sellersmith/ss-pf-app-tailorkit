import { useFetcher } from '@remix-run/react'
import { useCallback, useEffect, useRef } from 'react'
import type { EFetcherKeys } from '~/constants/fetcher-keys'

export type TUseHTTP = {
  key: EFetcherKeys
}

export function useHTTP<T extends Record<string, any>>(
  opts?: TUseHTTP
): (data: any, options: any) => Promise<{ success: boolean } & T> {
  const fetcher = useFetcher(opts?.key ? { key: opts.key } : undefined)
  const promisesRef = useRef<Map<symbol, { resolve: Function; reject: Function }>>(new Map())

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      // Resolve all promises with fetcher.data
      promisesRef.current.forEach(({ resolve }) => resolve(fetcher.data))
      // Clear the resolved promises
      promisesRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data])

  const _submit = useCallback(
    (data: any, options: any): Promise<{ success: boolean } & T> => {
      const key = Symbol()
      const deferred = customPromise<{ success: boolean } & T>()
      promisesRef.current.set(key, deferred)

      fetcher.submit(data, options)

      return deferred.promise
    },
    [fetcher]
  )

  return _submit
}

export function customPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { resolve, reject, promise }
}
