import type { LoaderFunctionArgs } from '@remix-run/node'
import { useBlocker, useLoaderData } from '@remix-run/react'
import { Box, InlineStack, Page } from '@shopify/polaris'
import extensionCSSModal from 'extensions/tailorkit-src/src/assets/components/preact/commons/modal/styles.css?url'
import extensionCSS from 'extensions/tailorkit-src/src/assets/tailorkit.css?url'
import isEqual from 'lodash/isEqual'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClientOnly } from 'remix-utils/client-only'
import { GlobalStylingService } from '~/api/services/global-styling'
import { json } from '~/bootstrap/fns/fetch.server'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import GlobalStylingEditor from '~/components/GlobalStyling/GlobalStylingEditor.client'
import { useGlobalStylingHistory } from '~/components/GlobalStyling/hooks/useGlobalStylingHistory'
import { getGlobalStyling } from '~/models/GlobalStyling.server'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { HydrateFallback } from '~/routes/dashboard/route'
import { authenticate } from '~/shopify/app.server'
import { createDefaultGlobalStyling, type DisplayMode } from '~/types/global-styling'
import { TOAST } from '~/constants/toasts'
import { showToast } from '~/utils/toastEvents'

export { HydrateFallback }

export const links = () => [
  { rel: 'stylesheet', href: extensionCSS },
  { rel: 'stylesheet', href: extensionCSSModal },
]

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const {
      session: { shop: shopDomain },
    } = await authenticate.admin(request)

    // Get existing styling from database
    const existingStyling = await getGlobalStyling(shopDomain)

    return json({
      styling: existingStyling?.styling || createDefaultGlobalStyling(),
    })
  } catch (error) {
    console.error('Error loading global styling:', error)
    return json({
      styling: createDefaultGlobalStyling(),
    })
  }
}

function Index() {
  const { t } = useTranslation()

  const [saving, setSaving] = useState(false)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline')
  const loaderData = useLoaderData<typeof loader>()

  const { styling, pushHistory, handleUndo, handleRedo, isChanged, canUndo, canRedo, resetHistory, handleDiscard }
    = useGlobalStylingHistory(loaderData.styling)

  const isDefaultStyling = useMemo(() => isEqual(styling, createDefaultGlobalStyling()), [styling])

  // Block navigation when there are unsaved changes
  useBlocker(() => isChanged)

  const handleRestoreDefault = useCallback(() => {
    pushHistory(createDefaultGlobalStyling())
  }, [pushHistory])

  const handleSave = useCallback(async () => {
    try {
      setSaving(true)
      showToast(t(TOAST.SETTINGS.SAVING))

      // Save both to metafields and database via unified API service
      const result = await GlobalStylingService.update(styling)

      if (result.success) {
        showToast(t(TOAST.SETTINGS.SAVED))
        resetHistory()
      } else {
        throw new Error(result.message || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Save error:', error)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      setSaving(false)
    }
  }, [styling, t, resetHistory])

  return (
    <Page
      title={t('customize-box-styling')}
      backAction={{ content: t('back'), url: '/storefront-setup' }}
      secondaryActions={[
        {
          content: t('undo'),
          onAction: handleUndo,
          disabled: !canUndo,
        },
        {
          content: t('redo'),
          onAction: handleRedo,
          disabled: !canRedo,
        },
        {
          content: t('restore-default'),
          onAction: handleRestoreDefault,
          disabled: isDefaultStyling,
        },
      ]}
    >
      <InlineStack align="center">
        <Box width="100%">
          <ClientOnly fallback={null}>
            {() => (
              <GlobalStylingEditor
                styling={styling}
                onStylingChange={pushHistory}
                displayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
              />
            )}
          </ClientOnly>

          <ContextualSaveBar isOpen={isChanged} loading={saving} onSave={handleSave} onDiscard={handleDiscard} />
        </Box>
      </InlineStack>
    </Page>
  )
}

export default withIdleTracker(withInteractiveChat(Index))
