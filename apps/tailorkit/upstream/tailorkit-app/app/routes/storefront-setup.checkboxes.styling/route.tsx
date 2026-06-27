import { Page, Grid, BlockStack, Box, Frame } from '@shopify/polaris'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { useState, useCallback, useEffect, useMemo } from 'react'
import isEqual from 'lodash/isEqual'
import type { CheckboxGlobalStyling } from '~/types/global-styling'
import { defaultCheckboxStyling } from '~/types/global-styling'
import { TOAST } from '~/constants/toasts'
import CheckboxTypeCard from './components/CheckboxTypeCard'
import CheckboxImageSizeCard from './components/CheckboxImageSizeCard'
import CheckboxColorCard from './components/CheckboxColorCard'
import PersonalizeButtonCard from './components/PersonalizeButtonCard'
import StylingPreview from './components/StylingPreview'
import { STYLING_ACTIONS } from './constants'
import { showToast } from '~/utils/toastEvents'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import onetickStyles from 'extensions/onetick-src/src/onetick.css?url'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'

// Re-export loader and action
export { loader } from './loader.server'
export { action } from './action.server'

// Load onetick CSS for preview styling
export const links = () => [{ rel: 'stylesheet', href: onetickStyles }]

interface LoaderData {
  checkboxStyling: CheckboxGlobalStyling
}

export default function CheckboxStylingPage() {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  const fetcher = useFetcher()

  // Get initial data from loader
  const loaderData = useLoaderData<LoaderData>()
  const initialData = loaderData.checkboxStyling || defaultCheckboxStyling

  // Local state for styling and saved state for change detection
  const [styling, setStyling] = useState<CheckboxGlobalStyling>(initialData)
  const [savedStyling, setSavedStyling] = useState<CheckboxGlobalStyling>(initialData)

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => !isEqual(styling, savedStyling), [styling, savedStyling])

  // Loading state
  const isLoading = fetcher.state === 'submitting'

  // Handle successful save
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const data = fetcher.data as { success: boolean; message?: string }
      if (data.success) {
        showToast(t(TOAST.SETTINGS.CHANGES_SAVED))
        // Update saved state after successful save
        setSavedStyling(styling)
      } else {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      }
    }
  }, [fetcher.state, fetcher.data, styling, t])

  // Handle styling updates from child components
  const handleChange = useCallback((updates: Partial<CheckboxGlobalStyling>) => {
    setStyling(prev => ({
      ...prev,
      ...updates,
    }))
  }, [])

  // Handle save
  const handleSave = useCallback(() => {
    const formData = new FormData()
    formData.append('action', STYLING_ACTIONS.SAVE)
    formData.append('data', JSON.stringify(styling))

    fetcher.submit(formData, { method: 'POST' })
  }, [fetcher, styling])

  // Handle discard
  const handleDiscard = useCallback(() => {
    setStyling(savedStyling)
  }, [savedStyling])

  return (
    <Frame>
      <Page
        title={t('addon-styling')}
        backAction={{
          onAction: () => navigate('/storefront-setup/checkboxes'),
        }}
      >
        <Box minHeight="calc(100vh - 136px)">
          <Grid gap={{ xs: '400' }}>
            {/* Left Column: Config Forms */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 8, xl: 8 }}>
              <BlockStack gap="400">
                <CheckboxTypeCard styling={styling} onChange={handleChange} />
                <CheckboxImageSizeCard styling={styling} onChange={handleChange} />
                <CheckboxColorCard styling={styling} onChange={handleChange} />
                <PersonalizeButtonCard styling={styling} onChange={handleChange} />
              </BlockStack>
            </Grid.Cell>

            {/* Right Column: Live Preview */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
              <StylingPreview styling={styling} />
            </Grid.Cell>
          </Grid>
        </Box>

        {/* Contextual Save Bar */}

        <ContextualSaveBar
          isOpen={hasChanges}
          // message={t('unsaved-changes')}
          onSave={handleSave}
          loading={isLoading}
          onDiscard={handleDiscard}
        />
      </Page>
    </Frame>
  )
}
