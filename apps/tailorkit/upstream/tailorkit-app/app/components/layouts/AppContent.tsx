import { useLoaderData } from '@remix-run/react'
import { useAppInitialization } from '~/hooks/useAppInitialization'
import { useAppLanguage } from '~/hooks/useAppLanguage'
import { useMaintenanceMode } from '~/hooks/useMaintenanceMode'
import { useSavePublishTracking } from '~/hooks/useSavePublishTracking'
import type { RootLoaderData } from '~/types/loaders'
import GlobalModals from '~/components/GlobalModals'
import { AppDocument } from './AppDocument'
import { AppLayout } from './AppLayout'
import { useCrispEvents } from '~/hooks/useCrispTracking'

/**
 * Main content component that handles app initialization and layout
 */
export function App() {
  const rootLoaderData = useLoaderData<RootLoaderData>()
  const { apiKey, locale, maintenanceMode, PUBLIC_ENV, polarisStyles, crispChatStyles, globalStyles, shopData }
    = rootLoaderData

  // Handle maintenance mode
  useMaintenanceMode(maintenanceMode)

  // Handle language changes
  const { language } = useAppLanguage(locale)

  // Initialize app with shop domain for analytics identification
  const { remixQueryClient } = useAppInitialization({ shopDomain: shopData?.shopDomain })

  // Track Crisp events
  useCrispEvents()

  // Track save/publish events globally for modal display
  useSavePublishTracking()

  return (
    <AppDocument
      apiKey={apiKey as string}
      language={language}
      remixQueryClient={remixQueryClient}
      polarisStyles={polarisStyles}
      crispChatStyles={crispChatStyles}
      globalStyles={globalStyles}
      publicEnv={PUBLIC_ENV}
    >
      <AppLayout />
      <GlobalModals />
    </AppDocument>
  )
}
