/**
 * FillPanel - Inspector panel for fill settings
 *
 * Used in the StylingInspector to edit text/shape fills.
 * Replaces the old TextColorPanel with unified fill support.
 *
 * @module TemplateEditor/elements/components/Text/Styling/Fill
 */

import { useCallback, useMemo } from 'react'
import type TemplateElement from '../../..'
import type { Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { isSolidPaint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { FillPicker } from './FillPicker'
import type { TLayerStore } from '~/stores/modules/layer'

interface FillPanelProps {
  element: TemplateElement<any, any>
  clickedLayerStore?: TLayerStore | null
}

export function FillPanel({ element, clickedLayerStore }: FillPanelProps) {
  // For nested elements (e.g., text in multi-layout), use clickedLayerStore
  // Otherwise use element's state
  const targetLayerStore
    = clickedLayerStore && clickedLayerStore.getState()._id !== element.state._id
      ? clickedLayerStore
      : element.props.layerStore

  const targetState = targetLayerStore.getState()
  const settings = targetState?.settings || {}

  // Get current fill - support both new fills array and legacy textColor
  const currentFill = useMemo((): Paint | string => {
    // New fills array takes precedence
    if (settings.fills && Array.isArray(settings.fills) && settings.fills.length > 0) {
      return settings.fills[0]
    }
    // Fallback to legacy textColor
    return settings.textColor || '#000000'
  }, [settings.fills, settings.textColor])

  const handleFillChange = useCallback(
    (fill: Paint) => {
      const currentSettings = targetState.settings || {}

      // Update both fills array and legacy textColor for backward compatibility
      const updates: Record<string, unknown> = {
        fills: [fill],
      }

      // Keep textColor in sync for backward compatibility
      if (isSolidPaint(fill)) {
        updates.textColor = fill.color
        // Handle neon mode inverse
        if (currentSettings.neonMode === 'inverse') {
          updates.strokeColor = fill.color
        }
      }

      // Update via layerStore dispatch
      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              ...updates,
            },
          },
        },
      })
    },
    [targetLayerStore, targetState]
  )

  return <FillPicker value={currentFill} onChange={handleFillChange} shopDomain={targetState.shopDomain} />
}
