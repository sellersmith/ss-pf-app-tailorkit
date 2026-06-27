import React from 'react'
import { useNavigate } from './pagefly-remix-react-shim'
import { createPageFlyNavigateAppBridge } from './pagefly-navigate-app-bridge'
import { getShopifyInstance } from './pagefly-shopify-shim'

export const useNavigateAppBridge = () => {
  const navigateRemix = useNavigate()

  return React.useMemo(() => createPageFlyNavigateAppBridge(navigateRemix, getShopifyInstance), [navigateRemix])
}
