/**
 * Custom hook for managing element creation actions and AI image handling
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useStore } from '~/libs/external-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStore, TemplateEditorStoreActions } from '~/stores/modules/template'
import type { LayerType } from '~/types/psd'
import { ELayerType } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import { authenticatedFetch } from '~/shopify/fns.client'
import { createElement, type ElementCreationContext, type GenerativeOptions } from '../utils/elementCreators'
import type { LayerDocument } from '~/models/Layer.server'

/**
 * Hook that provides element creation actions and AI image handling
 */
export function useElementActions() {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()

  // Store data
  const extractedLayerStores = useStore(TemplateEditorStore, s => s.extractedLayerStores)
  const shopDomain = useStore(TemplateEditorStore, s => s.shopDomain)
  const { widthByPixels, heightByPixels } = useCanvasDimension()

  // AI prompt suggestions
  const [promptSuggestions, setPromptSuggestions] = useState<any[]>([])
  const [imagesGenerated, setImagesGenerated] = useState<IImageQuery[]>([])

  // Fetch prompt presets
  useLayoutEffect(() => {
    authenticatedFetch('/api/prompt-presets').then(res => {
      setPromptSuggestions(res.items.map((item: any) => ({ labelKey: item.name, prompt: item.instruction })))
    })
  }, [])

  // High-water mark counters — track the highest N ever seen for each layer type.
  // Uses refs so values persist across re-renders and never decrease on deletion.
  // e.g. Text 1, Text 2 → delete Text 2 → next is Text 3, not Text 2.
  const textHighWater = useRef(0)
  const imagelessHighWater = useRef(0)
  const multiLayoutHighWater = useRef(0)
  const charmNodeHighWater = useRef(0)

  // Scan existing layers and update high-water marks on every store change.
  // The refs only increase — deletions never lower the counter.
  useMemo(() => {
    let textMax = 0
    let imagelessMax = 0
    let multiLayoutMax = 0
    let charmNodeMax = 0

    for (const store of extractedLayerStores) {
      const state = store.getState()
      const label = state.label || ''

      if (state.type === ELayerType.TEXT) {
        const match = label.match(/^Text\s*(\d+)$/)
        if (match) textMax = Math.max(textMax, parseInt(match[1], 10))
      } else if (state.type === ELayerType.IMAGELESS) {
        const match = label.match(/^Imageless\s*(\d+)$/i)
        if (match) imagelessMax = Math.max(imagelessMax, parseInt(match[1], 10))
      } else if (state.type === ELayerType.MULTI_LAYOUT) {
        const match = label.match(/^Multi-layout\s*(\d+)$/i)
        if (match) multiLayoutMax = Math.max(multiLayoutMax, parseInt(match[1], 10))
      } else if (state.type === ELayerType.CHARM_NODE) {
        const match = label.match(/^Charm builder\s*(\d+)$/i)
        if (match) charmNodeMax = Math.max(charmNodeMax, parseInt(match[1], 10))
      }
    }

    textHighWater.current = Math.max(textHighWater.current, textMax)
    imagelessHighWater.current = Math.max(imagelessHighWater.current, imagelessMax)
    multiLayoutHighWater.current = Math.max(multiLayoutHighWater.current, multiLayoutMax)
    charmNodeHighWater.current = Math.max(charmNodeHighWater.current, charmNodeMax)
  }, [extractedLayerStores])

  /**
   * Main function to add elements to the template
   */
  const addElements = useCallback(
    (
      type: LayerType,
      mediaFiles: IImageQuery[] | null = null,
      generativeOptions?: GenerativeOptions,
      settings?: LayerDocument['settings'],
      opts: { autoSelect?: boolean } = { autoSelect: true }
    ) => {
      const { autoSelect } = opts

      // Read current stores directly from the store to avoid stale closure values.
      // This is critical when addElements is called multiple times synchronously
      // (e.g. multi-element presets) — each call must see the previous call's additions.
      const currentStores = TemplateEditorStore.getState().extractedLayerStores

      // Build fresh context with current high-water marks from refs.
      // This ensures synchronous calls (e.g. multi-element presets) see
      // incrementing counters instead of stale memoized values.
      const freshContext: ElementCreationContext = {
        widthByPixels,
        heightByPixels,
        shopDomain,
        t,
        textLayerCount: textHighWater.current,
        imagelessLayerCount: imagelessHighWater.current,
        multiLayoutLayerCount: multiLayoutHighWater.current,
        charmNodeLayerCount: charmNodeHighWater.current,
      }

      // Create new layer stores
      const newLayerStores = createElement(type, freshContext, mediaFiles, generativeOptions, settings)

      if (newLayerStores.length === 0) {
        return
      }

      // Increment high-water mark so the next synchronous call gets a unique number
      if (type === ELayerType.TEXT) {
        textHighWater.current += 1
      } else if (type === ELayerType.IMAGELESS) {
        imagelessHighWater.current += 1
      } else if (type === ELayerType.MULTI_LAYOUT) {
        multiLayoutHighWater.current += 1
      } else if (type === ELayerType.CHARM_NODE) {
        charmNodeHighWater.current += 1
      }

      // Update template store
      TemplateEditorStoreActions.setExtractedLayerStores([...newLayerStores.reverse(), ...currentStores])

      if (autoSelect) {
        // Auto-select added elements
        setTimeout(() => {
          LayerStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { clickedLayerStore: newLayerStores[0] },
          })
        }, 100)
      }

      // Tracking
      trackEvent(EVENTS_TRACKING.ADD_TEMPLATE_ELEMENT, {
        [EVENTS_PARAMETERS_NAME.ELEMENT_TYPE]: type,
        ...(type === 'image' ? { [EVENTS_PARAMETERS_NAME.NUM_FILES]: mediaFiles?.length || 0 } : {}),
      })
    },
    [widthByPixels, heightByPixels, shopDomain, t, trackEvent]
  )

  /**
   * Handle images selected from AI generator
   */
  const handleSelectAIImages = useCallback(
    (
      mediaFiles: IImageQuery[],
      generativeOptions?: GenerativeOptions,
      opts: { autoSelect?: boolean } = { autoSelect: true }
    ) => {
      if (mediaFiles?.length) {
        addElements(ELayerType.IMAGE, mediaFiles, generativeOptions, undefined, opts)
      }
    },
    [addElements]
  )

  return {
    addElements,
    handleSelectAIImages,
    promptSuggestions,
    imagesGenerated,
    setImagesGenerated,
  }
}
