import { useLocation, useNavigate } from '@remix-run/react'
import { useEffect, useState, useCallback } from 'react'
import { rootPage } from '../app-config'
import { authenticatedFetch } from '~/shopify/fns.client'

export interface IChangeLog {
  version: string
  date: string
  title?: string
  features?: { value: string; note?: string }[]
  bugsFixed?: { value: string; note?: string }[]
  improvements?: { value: string; note?: string }[]
}

let cachedChangeLog: IChangeLog[] | null = null

export const useChangeLog = () => {
  const [loading, setLoading] = useState<boolean>(true)
  const [changeLog, setChangeLog] = useState<IChangeLog[]>([])
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const fetchChangeLog = useCallback(async () => {
    setLoading(true)

    try {
      if (!cachedChangeLog) {
        const data = await authenticatedFetch('/api/changelog')

        // Sort the changelog data by date in ascending order
        cachedChangeLog = data.sort(
          (a: IChangeLog, b: IChangeLog) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
      }

      setLoading(false)

      if (!cachedChangeLog?.length && pathname !== rootPage) {
        navigate(rootPage)
        return
      }

      setChangeLog([...(cachedChangeLog || [])].reverse())
    } catch (error) {
      console.error('===> Failed to fetch change log:', error)
      setLoading(false)
    }
  }, [pathname, navigate])

  useEffect(() => {
    fetchChangeLog()
  }, [fetchChangeLog])

  return { changeLog, loading }
}
