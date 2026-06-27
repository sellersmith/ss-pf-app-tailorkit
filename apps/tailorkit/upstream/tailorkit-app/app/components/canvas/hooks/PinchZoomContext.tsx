/**
 * PinchZoomContext - Context for sharing pinch zoom state between components
 *
 * This context allows child components (like CanvasStage) to check if a pinch
 * gesture was recently active, which is used to suppress tap events that might
 * fire right after a pinch gesture ends.
 */

import { createContext, useContext } from 'react'

interface PinchZoomContextValue {
  /** Ref to check if pinch was recently active (for tap suppression) */
  wasPinchingRef: React.RefObject<boolean>
}

/**
 * Default context value with a ref that always returns false
 * This is used when the context is not provided (e.g., in desktop mode)
 */
const defaultValue: PinchZoomContextValue = {
  wasPinchingRef: { current: false },
}

export const PinchZoomContext = createContext<PinchZoomContextValue>(defaultValue)

/**
 * Hook to access the pinch zoom context
 * @returns The pinch zoom context value
 */
export function usePinchZoomContext() {
  return useContext(PinchZoomContext)
}
