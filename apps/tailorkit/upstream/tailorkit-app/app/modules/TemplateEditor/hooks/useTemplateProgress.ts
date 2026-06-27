/**
 * Hook to calculate template completion progress based on onboarding milestones.
 * Tracks 3 steps: has layers, has personalization, has mockup.
 * Pre-config templates auto-pass all 3; explore-all starts at 0.
 */
import { useCallback, useEffect, useState } from 'react'
import { getAllLayerStore } from '~/stores/modules/layer'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { EOptionSet } from '~/types/psd'
import type { ImageSettings } from '~/types/psd'

/** Option set types that indicate personalization (user-facing fields only) */
const TRACKABLE_OPTION_TYPES = new Set([
  EOptionSet.IMAGE_OPTION,
  EOptionSet.TEXT_OPTION,
  EOptionSet.COLOR_OPTION,
  EOptionSet.FONT_OPTION,
  EOptionSet.IMAGELESS_OPTION,
  EOptionSet.MASK_OPTION,
])

const TOTAL_STEPS = 3

export interface OnboardingSteps {
  hasLayers: boolean
  hasPersonalization: boolean
  hasMockup: boolean
}

export type NextStepKey = 'add_layers' | 'add_personalization' | 'add_mockup' | null

export interface TemplateProgress {
  steps: OnboardingSteps
  completedSteps: number
  totalSteps: number
  percentage: number
  isComplete: boolean
  nextStep: NextStepKey
}

/** Pure function to compute step-based progress from stores */
export function getTemplateProgress(): TemplateProgress {
  const allStores = getAllLayerStore()
  const variants = IntegrationStore.getState().variants

  // Step 1: At least 1 non-deleted layer exists
  const hasLayers = allStores.some(s => !s.getState().isDeletedOnEditor)

  // Step 2: At least 1 layer has personalization configured via either:
  //   a) Option set with data !== null (text/font/color/mask/imageless configured)
  //   b) Image layer with buyer image or seller image enabled (includes AI effects, upload)
  const hasPersonalization = allStores.some(s => {
    const state = s.getState()
    if (state.isDeletedOnEditor) return false

    // Check option sets with configured data (font, color, mask, imageless, seller image)
    const hasOptionSetData
      = state.optionSet?.some(os => TRACKABLE_OPTION_TYPES.has(os.type as EOptionSet) && os.data !== null) ?? false
    if (hasOptionSetData) return true

    // Text layer: "Your buyers" tab means buyer enters text = personalization
    const settings = state.settings as Record<string, unknown> | undefined
    if (settings?.textCreatedBy === 'customers') return true

    // Image layer: buyer mode with upload OR AI effects enabled
    if (!settings) return false
    const imgSettings = settings as unknown as ImageSettings
    const opts = imgSettings.imageUploaderOptions
    return (
      imgSettings.enableBuyerImage === true
      && (opts?.allowCustomerUploadImage === true || opts?.allowCustomerGenerateImageWithAI === true)
    )
  })

  // Step 3: At least 1 variant's mockup has a base image (check both mockup-level and view-level)
  const hasMockup
    = variants?.some(v => {
      if (v.mockup?.baseImage?.url) return true
      return v.mockup?.views?.some(view => view.baseImage?.url) ?? false
    }) ?? false

  const steps: OnboardingSteps = { hasLayers, hasPersonalization, hasMockup }
  const completedSteps = [hasLayers, hasPersonalization, hasMockup].filter(Boolean).length
  const percentage = Math.round((completedSteps / TOTAL_STEPS) * 100)

  // Determine next incomplete step in order
  let nextStep: NextStepKey = null
  if (!hasLayers) nextStep = 'add_layers'
  else if (!hasPersonalization) nextStep = 'add_personalization'
  else if (!hasMockup) nextStep = 'add_mockup'

  return {
    steps,
    completedSteps,
    totalSteps: TOTAL_STEPS,
    percentage,
    isComplete: completedSteps === TOTAL_STEPS,
    nextStep,
  }
}

const POLL_INTERVAL_MS = 2500
const DEFAULT_PROGRESS: TemplateProgress = {
  steps: { hasLayers: false, hasPersonalization: false, hasMockup: false },
  completedSteps: 0,
  totalSteps: TOTAL_STEPS,
  percentage: 0,
  isComplete: false,
  nextStep: 'add_layers',
}

/** Hook that polls stores and returns step-based onboarding progress. Pass enabled=false to skip polling. */
export function useTemplateProgress(enabled = true): TemplateProgress {
  const [progress, setProgress] = useState<TemplateProgress>(() => (enabled ? getTemplateProgress() : DEFAULT_PROGRESS))

  const recompute = useCallback(() => {
    const next = getTemplateProgress()
    setProgress(prev => {
      if (prev.completedSteps === next.completedSteps) return prev
      return next
    })
  }, [])

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(recompute, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [recompute, enabled])

  if (!enabled) return DEFAULT_PROGRESS
  return progress
}
