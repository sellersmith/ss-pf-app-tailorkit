/**
 * Bootstrap hook for charm-mode entry from the onboarding flow router.
 *
 * When the unified editor mounts with `?charmMode=true` (set by the
 * dashboard's openCreateFlow consumer for the Charm Builder flow):
 * - Wait for the template to finish initializing (layer stores populated).
 * - If no CHARM_NODE layer exists yet, insert one at canvas center.
 * - Strip the param from the URL so refresh / back-nav doesn't re-trigger.
 *
 * Used by both TemplateEditor (templates.$id) and ProductEditor
 * (personalized-products.$id), which share the same TemplateEditorStore.
 */

import { useEffect, useRef } from 'react'
import { useSearchParams } from '@remix-run/react'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { ELayerType } from '~/types/psd'
import type { TLayerStore } from '~/stores/modules/layer'
import { useElementActions } from '../components/Editor/hooks/useElementActions'

const CHARM_MODE_PARAM = 'charmMode'

export function useCharmModeBootstrap(): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const charmMode = searchParams.get(CHARM_MODE_PARAM) === 'true'

  const extractedLayerStores = useStore(TemplateEditorStore, s => s.extractedLayerStores)
  // Real readiness signals: _id is empty until initTemplate dispatches INIT_DATA,
  // interactive flips true after init completes. Both must hold before we insert,
  // otherwise our CHARM_NODE gets wiped when initTemplate overwrites
  // extractedLayerStores with the loaded template's layers.
  const templateId = useStore(TemplateEditorStore, s => s._id)
  const interactive = useStore(TemplateEditorStore, s => s.interactive)
  const { addElements } = useElementActions()

  // Single-fire guard. Without this, the effect runs twice in React 18 strict
  // mode (and on subsequent layer-store updates), creating multiple CHARM_NODEs.
  const inserted = useRef(false)

  useEffect(() => {
    if (!charmMode || inserted.current) return
    // Gate on real template-ready signals — see comment above.
    if (!templateId || !interactive) return

    // Don't double-insert if a CHARM_NODE already exists (e.g. merchant
    // refreshed during charm flow and the previous insert persisted).
    const hasCharmNode = extractedLayerStores.some((s: TLayerStore) => s.getState().type === ELayerType.CHARM_NODE)

    inserted.current = true
    if (!hasCharmNode) {
      addElements(ELayerType.CHARM_NODE)
    }

    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete(CHARM_MODE_PARAM)
        return next
      },
      { replace: true }
    )
  }, [charmMode, templateId, interactive, extractedLayerStores, addElements, setSearchParams])
}
