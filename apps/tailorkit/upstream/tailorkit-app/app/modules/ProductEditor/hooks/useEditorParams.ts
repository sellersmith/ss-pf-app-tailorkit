import { useCallback, useLayoutEffect, useMemo } from 'react'
import { createStore, useStore } from '~/libs/external-store'
import type { Store } from '~/libs/external-store'
import { EDITOR_TABS, type EditorTab } from '../constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'

type EditorParamsState = {
  tab: EditorTab
  mockupId: string
  printAreaId: string
  templateId: string
}

type EditorParamsAction =
  | { type: 'SET_TAB'; payload: EditorTab }
  | { type: 'SET_PRINT_AREA_ID'; payload: string }
  | { type: 'SET_TEMPLATE_ID'; payload: string }
  | { type: 'SET_MOCKUP_ID'; payload: string }
  | { type: 'UPDATE_PARAMS'; payload: Partial<EditorParamsState> }
  | { type: 'REPLACE_STATE'; payload: EditorParamsState }

type EditorParamsUpdates = Partial<{ tab: EditorTab; mockupId: string; printAreaId: string; templateId: string }>

const DEFAULT_STATE: EditorParamsState = {
  tab: EDITOR_TABS.DESIGN,
  mockupId: '',
  printAreaId: '',
  templateId: '',
}

const isEditorTab = (value: string | null): value is EditorTab => {
  if (!value) return false
  return Object.values(EDITOR_TABS).includes(value as EditorTab)
}

const areStatesEqual = (a: EditorParamsState, b: EditorParamsState) =>
  a.tab === b.tab && a.mockupId === b.mockupId && a.printAreaId === b.printAreaId && a.templateId === b.templateId

const editorParamsReducer: (state: EditorParamsState, action: EditorParamsAction) => EditorParamsState = (
  state,
  action
) => {
  switch (action.type) {
    case 'SET_TAB': {
      if (state.tab === action.payload) return state
      return { ...state, tab: action.payload }
    }
    case 'SET_PRINT_AREA_ID': {
      if (state.printAreaId === action.payload) return state
      return { ...state, printAreaId: action.payload }
    }
    case 'SET_TEMPLATE_ID': {
      if (state.templateId === action.payload) return state
      return { ...state, templateId: action.payload }
    }
    case 'SET_MOCKUP_ID': {
      if (state.mockupId === action.payload) return state
      return { ...state, mockupId: action.payload }
    }
    case 'UPDATE_PARAMS': {
      let hasChanges = false
      const nextState: EditorParamsState = { ...state }

      if (Object.prototype.hasOwnProperty.call(action.payload, 'tab')) {
        const nextTab = action.payload.tab ?? state.tab
        if (nextState.tab !== nextTab) {
          hasChanges = true
          nextState.tab = nextTab
        }
      }

      if (Object.prototype.hasOwnProperty.call(action.payload, 'mockupId')) {
        const nextMockupId = action.payload.mockupId ?? ''
        if (nextState.mockupId !== nextMockupId) {
          hasChanges = true
          nextState.mockupId = nextMockupId
        }
      }

      if (Object.prototype.hasOwnProperty.call(action.payload, 'printAreaId')) {
        const nextPrintAreaId = action.payload.printAreaId ?? ''
        if (nextState.printAreaId !== nextPrintAreaId) {
          hasChanges = true
          nextState.printAreaId = nextPrintAreaId
        }
      }

      if (Object.prototype.hasOwnProperty.call(action.payload, 'templateId')) {
        const nextTemplateId = action.payload.templateId ?? ''
        if (nextState.templateId !== nextTemplateId) {
          hasChanges = true
          nextState.templateId = nextTemplateId
        }
      }

      return hasChanges ? nextState : state
    }
    case 'REPLACE_STATE': {
      return areStatesEqual(state, action.payload) ? state : action.payload
    }
    default:
      return state
  }
}

let editorParamsStore: Store<EditorParamsState, EditorParamsAction> | null = null
let subscriberCount = 0
let unsubscribeFromStore: (() => void) | null = null
let popstateHandler: ((event: PopStateEvent) => void) | null = null
let hasHydratedFromURL = false
let lastHydratedUrl: string | null = null
let lastSyncedState: EditorParamsState = DEFAULT_STATE

const getEditorParamsStore = () => {
  if (!editorParamsStore) {
    editorParamsStore = createStore(editorParamsReducer, DEFAULT_STATE)
  }
  return editorParamsStore
}

// Export store getter for reading current state without hook subscription
export { getEditorParamsStore }

const getStateFromURL = (): EditorParamsState => {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  const params = new URLSearchParams(window.location.search)
  const tabParam = params.get('tab')
  const mockupParam = params.get('mockup') || ''
  const printAreaParam = params.get('printAreaId') || ''
  const templateParam = params.get('templateId') || ''

  return {
    tab: isEditorTab(tabParam) ? (tabParam as EditorTab) : EDITOR_TABS.DESIGN,
    mockupId: mockupParam,
    printAreaId: printAreaParam,
    templateId: templateParam,
  }
}

const syncStoreToURL = (state: EditorParamsState) => {
  if (typeof window === 'undefined') return

  const currentParams = new URLSearchParams(window.location.search)
  const changes: boolean[] = []

  // Only sync tab param on personalized-products route
  const isProductEditorRoute = window.location.pathname.startsWith('/personalized-products/')

  const updateParam = (key: string, value: string): boolean => {
    const existing = currentParams.get(key)
    if (value) {
      if (existing !== value) {
        currentParams.set(key, value)
        return true
      }
      return false
    }

    if (existing !== null) {
      currentParams.delete(key)
      return true
    }

    return false
  }

  // Update all parameters and track changes explicitly
  // Only sync 'tab' on personalized-products route to avoid polluting other routes
  if (isProductEditorRoute) {
    changes.push(updateParam('tab', state.tab))
  }
  changes.push(updateParam('mockup', state.mockupId))
  changes.push(updateParam('printAreaId', state.printAreaId))
  changes.push(updateParam('templateId', state.templateId))

  const hasChanged = changes.some(Boolean)

  if (!hasChanged) return

  const nextSearch = currentParams.toString()
  const currentSearch = window.location.search.slice(1)
  if (nextSearch === currentSearch) return

  const nextUrl = [window.location.pathname, nextSearch].filter(Boolean).join('?')
  window.history.replaceState(window.history.state, '', nextUrl)
}

const ensureClientSideEffects = (store: Store<EditorParamsState, EditorParamsAction>) => {
  if (typeof window === 'undefined') return

  const currentUrl = window.location.pathname + window.location.search

  if (!hasHydratedFromURL || currentUrl !== lastHydratedUrl) {
    hasHydratedFromURL = true
    lastHydratedUrl = currentUrl
    const urlState = getStateFromURL()
    store.dispatch({ type: 'REPLACE_STATE', payload: urlState })
    lastSyncedState = store.getState()
    syncStoreToURL(lastSyncedState)
  }

  if (!unsubscribeFromStore) {
    lastSyncedState = store.getState()
    unsubscribeFromStore = store.subscribe(nextState => {
      if (areStatesEqual(lastSyncedState, nextState)) {
        return
      }
      lastSyncedState = nextState
      syncStoreToURL(nextState)
    })
  }

  if (!popstateHandler) {
    popstateHandler = () => {
      const nextStateFromURL = getStateFromURL()
      const current = store.getState()
      if (!areStatesEqual(current, nextStateFromURL)) {
        store.dispatch({ type: 'REPLACE_STATE', payload: nextStateFromURL })
      }
    }
    window.addEventListener('popstate', popstateHandler)
  }
}

const cleanupClientSideEffects = () => {
  if (typeof window === 'undefined') return

  if (unsubscribeFromStore) {
    unsubscribeFromStore()
    unsubscribeFromStore = null
  }

  if (popstateHandler) {
    window.removeEventListener('popstate', popstateHandler)
    popstateHandler = null
  }

  hasHydratedFromURL = false
}

/**
 * Custom hook for managing unified editor URL parameters with an external store.
 */
export function useEditorParams() {
  const store = getEditorParamsStore()

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    subscriberCount += 1
    ensureClientSideEffects(store)

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1)
      if (subscriberCount === 0) {
        cleanupClientSideEffects()
      }
    }
  }, [store])

  const tab = useStore(store, state => state.tab)
  const mockupId = useStore(store, state => state.mockupId)
  const printAreaId = useStore(store, state => state.printAreaId)
  const templateId = useStore(store, state => state.templateId)

  const previewMode = tab === EDITOR_TABS.PREVIEW

  const { trackEvent } = useEventsTracking()

  const setTab = useCallback(
    (newTab: EditorTab) => {
      trackEvent(EVENTS_TRACKING.CHANGE_EDITOR_TAB, {
        [EVENTS_PARAMETERS_NAME.VALUE]: newTab,
      })

      store.dispatch({ type: 'SET_TAB', payload: newTab })
    },
    [store, trackEvent]
  )

  const setPrintAreaId = useCallback(
    (id: string) => {
      store.dispatch({ type: 'SET_PRINT_AREA_ID', payload: id })
    },
    [store]
  )

  const setTemplateId = useCallback(
    (id: string) => {
      store.dispatch({ type: 'SET_TEMPLATE_ID', payload: id })
    },
    [store]
  )

  const updateParams = useCallback(
    (params: EditorParamsUpdates) => {
      store.dispatch({ type: 'UPDATE_PARAMS', payload: params })
    },
    [store]
  )

  return useMemo(
    () => ({
      tab,
      mockupId,
      printAreaId,
      templateId,
      previewMode,
      setTab,
      setPrintAreaId,
      setTemplateId,
      updateParams,
    }),
    [tab, mockupId, printAreaId, templateId, previewMode, setTab, setPrintAreaId, setTemplateId, updateParams]
  )
}
