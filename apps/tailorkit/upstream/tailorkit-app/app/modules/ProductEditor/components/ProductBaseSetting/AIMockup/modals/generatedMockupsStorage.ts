import type { GeneratedMockup } from './types'

/**
 * Module-level storage for generated mockups per view.
 * Persists across modal open/close cycles but clears on page refresh (session-only).
 */
export const generatedMockupsStorage = new Map<string, GeneratedMockup[]>()
