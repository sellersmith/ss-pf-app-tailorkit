import { useEffect, useState } from 'react'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const useAppHandle = () => {
  const [appHandle, setAppHandle] = useState('')

  useEffect(() => {
    ;(async () => {
      const appHandle = await authenticatedFetch(`/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_APP_HANDLE}`)

      setAppHandle(appHandle)
    })()
  }, [])

  return {
    appHandle,
  }
}
