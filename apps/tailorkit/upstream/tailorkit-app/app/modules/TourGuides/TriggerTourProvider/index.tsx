import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from '@remix-run/react'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { tourStore } from '~/stores/tour'
import TourGuide from '~/components/TourGuide'
import { TOUR_TRIGGER_REGISTRY, ETriggerType, type TourTriggerConfig } from '~/constants/tours/trigger-registry'
import { saveProgressQuickTourData } from '../TemplateEditorQuickTour/fns'
import { authenticatedFetch } from '~/shopify/fns.client'
import useDevices from '~/utils/hooks/useDevice'
import type { ELayerType } from '~/types/psd'

/**
 * Batch-fetch UserJourney records for multiple types in one request.
 * Returns a map of type -> journey document.
 */
async function batchGetUserJourneys(types: string[]): Promise<Record<string, { isFinished: boolean }>> {
  try {
    const response = await authenticatedFetch(`/api/user-journey?types=${encodeURIComponent(types.join(','))}`)
    if (!response.success) return {}

    const map: Record<string, { isFinished: boolean }> = {}
    for (const uj of response.userJourneys || []) {
      map[uj.type] = uj
    }
    return map
  } catch {
    return {}
  }
}

/**
 * TriggerTourProvider - Manages trigger-based tours that activate on user actions.
 *
 * This component:
 * 1. Batch-fetches UserJourney records for all trigger tours on mount
 * 2. Subscribes to LayerStoreSelection for layer-click triggers
 * 3. Evaluates triggers against the registry when conditions are met
 * 4. Renders <TourGuide> when a trigger tour activates
 * 5. Prevents conflicts with route-based tours via tourStore checks
 */
function TriggerTourProvider() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const deviceData = useDevices()
  const isMobileView = deviceData.isMobileView
  // Skip all trigger tours when arriving from simplified onboarding — product is already set up
  const isSimplifiedOnboarding = new URLSearchParams(location.search).get('simplified') === 'true'

  // Track which trigger tours are already finished
  const [finishedTriggerIds, setFinishedTriggerIds] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  // Currently active trigger tour
  const [activeTrigger, setActiveTrigger] = useState<TourTriggerConfig | null>(null)

  // Prevent duplicate evaluations during the same render cycle
  const activatingRef = useRef(false)

  // Ensure EDITOR_OPEN only fires once per component lifetime
  const editorOpenFiredRef = useRef(false)

  // Subscribe to layer count so EDITOR_OPEN trigger waits for template initialization
  const layerCount = useStore(TemplateEditorStore, s => s.extractedLayerStores.length)

  // Prefetch all trigger-based journey statuses on mount
  useEffect(() => {
    let cancelled = false
    const triggerIds = TOUR_TRIGGER_REGISTRY.map(config => config.id)
    batchGetUserJourneys(triggerIds).then(journeyMap => {
      if (cancelled) return
      const finished = new Set<string>()
      for (const [type, journey] of Object.entries(journeyMap)) {
        if (journey.isFinished) finished.add(type)
      }
      setFinishedTriggerIds(finished)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Check if any route-based or other tour is currently active
  const isAnyTourActive = useStore(tourStore, state => {
    return Object.entries(state).filter(([, tour]) => tour.active).length > 0
  })

  // Helper: can a trigger activate?
  const canActivateTrigger = useCallback(
    (config: TourTriggerConfig) => {
      if (!loaded) return false
      if (activeTrigger) return false
      if (activatingRef.current) return false
      if (isAnyTourActive) return false
      if (finishedTriggerIds.has(config.id)) return false
      if (isMobileView) return false
      if (isSimplifiedOnboarding) return false
      return true
    },
    [loaded, activeTrigger, isAnyTourActive, finishedTriggerIds, isMobileView, isSimplifiedOnboarding]
  )

  // Evaluate triggers and activate the highest-priority matching one
  const tryActivateTrigger = useCallback(
    (triggerType: ETriggerType, meta?: { layerType?: ELayerType }) => {
      const candidates = TOUR_TRIGGER_REGISTRY.filter(config => config.triggerType === triggerType)
        .filter(config => {
          if (triggerType === ETriggerType.LAYER_CLICK && meta?.layerType) {
            return config.triggerMeta?.layerTypes?.includes(meta.layerType) ?? false
          }
          return true
        })
        .filter(config => !config.shouldActivate || config.shouldActivate())
        .filter(canActivateTrigger)
        .sort((a, b) => a.priority - b.priority)

      if (candidates.length > 0) {
        const winner = candidates[0]
        activatingRef.current = true

        // Register in the global tourStore so route-based system sees it
        tourStore.dispatch({ type: 'SET_TOUR', payload: { key: winner.id, active: true } })
        setActiveTrigger(winner)

        // Reset activating flag after state update
        requestAnimationFrame(() => {
          activatingRef.current = false
        })
      }
    },
    [canActivateTrigger]
  )

  // Keep a stable ref to tryActivateTrigger so trigger effects only fire
  // when actual conditions change (new layer click, editor load), not when
  // internal state cascades cause tryActivateTrigger identity to change.
  // Without this, closing a tour causes: activeTrigger→null → canActivateTrigger
  // changes → tryActivateTrigger changes → LAYER_CLICK effect re-fires with the
  // same clickedLayerStore → tour immediately re-activates.
  const tryActivateTriggerRef = useRef(tryActivateTrigger)
  tryActivateTriggerRef.current = tryActivateTrigger

  // TRIGGER: Editor open (debounced to wait for template initialization)
  // When loaded becomes true, we start a 500ms timer. If layerCount changes
  // (template initializing layers), the timer resets. This ensures shouldActivate()
  // evaluates after layers are populated.
  // editorOpenFiredRef prevents re-firing when tryActivateTrigger identity changes
  // (e.g., after another tour finishes and finishedTriggerIds/activeTrigger update).
  useEffect(() => {
    if (!loaded || editorOpenFiredRef.current) return
    const timer = setTimeout(() => {
      editorOpenFiredRef.current = true
      tryActivateTriggerRef.current(ETriggerType.EDITOR_OPEN)
    }, 500)
    return () => {
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, layerCount])

  // TRIGGER: Layer click (subscribe to store changes)
  const clickedLayerStore = useStore(LayerStoreSelection, s => s.clickedLayerStore)

  useEffect(() => {
    if (!clickedLayerStore || !loaded) return

    const layerState = clickedLayerStore.getState()
    const layerType = layerState?.type as ELayerType | undefined
    if (layerType) {
      tryActivateTriggerRef.current(ETriggerType.LAYER_CLICK, { layerType })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedLayerStore, loaded])

  // Build flow for active trigger
  const activeFlow = useMemo(() => {
    if (!activeTrigger) return null
    return activeTrigger.renderFlow({ t, navigate, deviceData })
  }, [activeTrigger, t, navigate, deviceData])

  // Permanently dismiss the trigger tour (persist isFinished: true).
  // Unlike route-based tours that use a two-tier close/dismiss pattern, trigger tours
  // are short contextual guides (2-3 steps) shown once per element type. All exit paths
  // (Got it, X close, backdrop click) persist dismissal — no separate "Don't show again" needed.
  const markTriggerPermanentlyDismissed = useCallback(async () => {
    if (!activeTrigger) return

    try {
      await saveProgressQuickTourData(activeTrigger.id, null, 100, true)
    } catch (e) {
      console.error('Failed to save trigger tour dismissal:', e)
    }

    // Update local state so it won't show again in this session
    setFinishedTriggerIds(prev => new Set([...prev, activeTrigger.id]))

    // Clear from global tourStore
    tourStore.dispatch({ type: 'SET_TOUR', payload: { key: activeTrigger.id, active: false } })

    setActiveTrigger(null)
  }, [activeTrigger])

  // onNext callback for step tracking
  const onNext = useCallback(() => {
    const tourGuideCard = document.querySelector('#tour-guide-card')
    if (!tourGuideCard) return 0
    return Number(tourGuideCard.getAttribute('data-tour-step-index') || 0)
  }, [])

  // Render nothing if no trigger tour is active
  if (!activeFlow || !activeTrigger) return null

  const isMultiStep = activeFlow.steps.length > 1

  return (
    <TourGuide
      flow={activeFlow}
      active={true}
      showProgress={isMultiStep}
      showSkip={isMultiStep}
      skipLabel={t('skip')}
      onPrev={isMultiStep ? { content: t('back') } : undefined}
      onNext={{ content: t('next'), action: onNext }}
      onSkip={markTriggerPermanentlyDismissed}
      onFinish={markTriggerPermanentlyDismissed}
    />
  )
}

export default TriggerTourProvider
