import type { ReactNode } from 'react'
import { useCallback } from 'react'
import ProviderConnectionForm from '~/routes/settings_.providers.connection.$id/ProviderConnectionForm'

interface IProviderConnectionComponentProps {
  required?: boolean
  infoBanner?: ReactNode
  providerConnectionData: any
  onConnectionDataChange?: (data: any) => void
}

export default function ProviderConnectionComponent(props: IProviderConnectionComponentProps) {
  const { infoBanner, providerConnectionData, onConnectionDataChange, required = true } = props
  const { providerInfo: providerData, providerIntegrationData } = providerConnectionData || {}

  const callbackAfterSave = useCallback(
    (data: any) => {
      onConnectionDataChange?.(data)
    },
    [onConnectionDataChange]
  )

  const handleConnectionDataChange = useCallback(
    (data: any) => {
      onConnectionDataChange?.(data)
    },
    [onConnectionDataChange]
  )

  return (
    <ProviderConnectionForm
      required={required}
      infoBanner={infoBanner}
      providerData={providerData}
      providerIntegrationData={providerIntegrationData}
      layout="modal"
      showProviderInfo={false}
      autoSave={false}
      callbackAfterSave={callbackAfterSave}
      onConnectionDataChange={handleConnectionDataChange}
    />
  )
}
