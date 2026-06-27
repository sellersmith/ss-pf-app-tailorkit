import { useAppBridge } from '@shopify/app-bridge-react'
import { useEffect } from 'react'

export default function BarLoading({ loading }: { loading: boolean }) {
  const shopifyAppBridge = useAppBridge()

  useEffect(() => {
    shopifyAppBridge && shopifyAppBridge.loading(loading)
  }, [loading, shopifyAppBridge])

  return null
}
