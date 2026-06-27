// PageFly-authored styling sub-view for the Sales Tools shell, hosting the "Personalization box styling"
// page (`/storefront-setup/styling`). It replaces the upstream `storefront-setup.styling/route.tsx`, which
// the single-shell can't load verbatim because that route is a server-loader Remix module
// (`export { loader }` + `authenticate.admin`). Graft-and-prune vs that route's `Index`:
//  - Pruned: `export { loader }` / `HydrateFallback` (server-only) — styling is read client-side via the
//    already-bridged `GET_GLOBAL_STYLING` preference action instead of the server `getGlobalStyling` loader.
//  - Pruned: `withIdleTracker(withInteractiveChat(...))` HOC chain — the PageFly nav-shell owns the chrome.
//  - Replaced: `GlobalStylingService` (raw-fetch httpClient, bypasses the bridge) → `authenticatedFetch`
//    (the island shim the rest of the screen uses), so GET/UPDATE route through the PageFly app API.
// Everything else (Page chrome + verbatim `GlobalStylingEditor`, `useGlobalStylingHistory`, default factory)
// is the upstream component, imported through the `~/` aliases so its internals resolve to PageFly seams.
import { Box, InlineStack, Page } from '@shopify/polaris'
import isEqual from 'lodash/isEqual'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
// The GlobalStyling preview renders `emtlkit--*` / `emtlkit-modal*` storefront DOM (DisplayModeSelector →
// Personalized + the modal modes). Upstream's styling route loaded these two stylesheets via `links()`;
// the single-shell has no `links()`, so import them as side-effects here — Vite folds them into the shell
// chunk's CSS, which the runtime-loader injects. Without them the preview is completely unstyled.
import 'extensions/tailorkit-src/src/assets/tailorkit.css'
import 'extensions/tailorkit-src/src/assets/components/preact/commons/modal/styles.css'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import GlobalStylingEditor from '~/components/GlobalStyling/GlobalStylingEditor.client'
import { useGlobalStylingHistory } from '~/components/GlobalStyling/hooks/useGlobalStylingHistory'
import { authenticatedFetch } from '~/shopify/fns.client'
import { createDefaultGlobalStyling, type DisplayMode, type GlobalStyling } from '~/types/global-styling'
import { mergeDeep } from '~/utils/mergeDeep'
import { TOAST } from '~/constants/toasts'
import { showToast } from '~/utils/toastEvents'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'

const BASE_PATH = '/storefront-setup'

interface GetGlobalStylingResponse {
  globalStyling?: Partial<GlobalStyling> | null
}

interface UpdateGlobalStylingResponse {
  success?: boolean
  message?: string
}

/**
 * Replicates the upstream styling route's `Index` minus the server loader/HOCs. Styling is fetched once on
 * mount via the bridged `GET_GLOBAL_STYLING` action; an unset record (or any failure) falls back to the
 * upstream default factory so the editor always mounts with a complete styling object.
 */
function StorefrontSetupStylingView() {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  // Back nav must route through the copied-route navigate shim (re-prefixes the PageFly routeBase + uses the
  // host React-router) — NOT Polaris `backAction.url`, which renders a raw `<a href="/storefront-setup">`
  // that does a FULL browser navigation to a bare, un-prefixed path, leaving the embedded app → blank crash.
  const goBack = useCallback(() => navigate(BASE_PATH), [navigate])
  const [saving, setSaving] = useState(false)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline')
  const [initialStyling, setInitialStyling] = useState<GlobalStyling | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadStyling() {
      try {
        const res = await authenticatedFetch<GetGlobalStylingResponse>('/api/preferences', {
          method: 'POST',
          body: JSON.stringify({ action: 'GET_GLOBAL_STYLING' }),
        })
        // Copied GlobalStylingService deep-merges partial saved styling onto the defaults; mirror that with
        // `mergeDeep` (NOT a shallow spread) so a record that saved only `heading.text` keeps the default
        // `heading.fontSize`/`color` instead of replacing the whole nested `heading` object.
        const next = res?.globalStyling
          ? (mergeDeep(createDefaultGlobalStyling(), res.globalStyling) as GlobalStyling)
          : createDefaultGlobalStyling()
        if (!cancelled) setInitialStyling(next)
      } catch (error) {
        console.error('Failed to load global styling', error)
        if (!cancelled) setInitialStyling(createDefaultGlobalStyling())
      }
    }

    void loadStyling()
    return () => {
      cancelled = true
    }
  }, [])

  if (!initialStyling) {
    return <Page title={t('customize-box-styling')} backAction={{ content: t('back'), onAction: goBack }} />
  }

  return (
    <StylingEditor
      initialStyling={initialStyling}
      saving={saving}
      setSaving={setSaving}
      displayMode={displayMode}
      setDisplayMode={setDisplayMode}
      onBack={goBack}
    />
  )
}

interface StylingEditorProps {
  initialStyling: GlobalStyling
  saving: boolean
  setSaving: (saving: boolean) => void
  displayMode: DisplayMode
  setDisplayMode: (mode: DisplayMode) => void
  onBack: () => void
}

/** The history hook seeds from `initialStyling`, so it only mounts once styling has loaded. */
function StylingEditor({ initialStyling, saving, setSaving, displayMode, setDisplayMode, onBack }: StylingEditorProps) {
  const { t } = useTranslation()
  const { styling, pushHistory, handleUndo, handleRedo, isChanged, canUndo, canRedo, resetHistory, handleDiscard } =
    useGlobalStylingHistory(initialStyling)

  const isDefaultStyling = useMemo(() => isEqual(styling, createDefaultGlobalStyling()), [styling])

  const handleRestoreDefault = useCallback(() => {
    pushHistory(createDefaultGlobalStyling())
  }, [pushHistory])

  const handleSave = useCallback(async () => {
    try {
      setSaving(true)
      showToast(t(TOAST.SETTINGS.SAVING))

      const res = await authenticatedFetch<UpdateGlobalStylingResponse>('/api/preferences', {
        method: 'POST',
        body: JSON.stringify({ action: 'UPDATE_GLOBAL_STYLING', styling }),
      })

      if (!res?.success) throw new Error(res?.message || 'Failed to save settings')

      showToast(t(TOAST.SETTINGS.SAVED))
      resetHistory()
    } catch (error) {
      console.error('Save error:', error)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      setSaving(false)
    }
  }, [styling, t, resetHistory, setSaving])

  return (
    <Page
      title={t('customize-box-styling')}
      backAction={{ content: t('back'), onAction: onBack }}
      secondaryActions={[
        { content: t('undo'), onAction: handleUndo, disabled: !canUndo },
        { content: t('redo'), onAction: handleRedo, disabled: !canRedo },
        { content: t('restore-default'), onAction: handleRestoreDefault, disabled: isDefaultStyling },
      ]}
    >
      <InlineStack align="center">
        <Box width="100%">
          {/* The island host always renders client-side, so the upstream route's `ClientOnly` guard (which
              defers SSR) is unnecessary — render the editor directly. */}
          <GlobalStylingEditor
            styling={styling}
            onStylingChange={pushHistory}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
          />

          <ContextualSaveBar isOpen={isChanged} loading={saving} onSave={handleSave} onDiscard={handleDiscard} />
        </Box>
      </InlineStack>
    </Page>
  )
}

export default StorefrontSetupStylingView
