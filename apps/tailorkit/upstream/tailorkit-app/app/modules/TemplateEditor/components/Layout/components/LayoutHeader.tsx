/**
 * Layout header component that renders the main header and inspector headers for different devices
 */

import { useLocation } from '@remix-run/react'
import { InspectorHeader } from '../../Inspector'
import UnifiedHeader from '~/modules/ProductEditor/components/UnifiedHeader'
import { OnboardingProgressBar } from '../../OnboardingProgress'
import { useTemplateProgress } from '../../../hooks/useTemplateProgress'
import { isOnboardingRoute } from '~/utils/shopify'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'

interface LayoutHeaderProps {
  isSmallMobileView: boolean
  isTabletView: boolean
}

/**
 * Renders the unified header for all tabs (Design, Mockup, Preview)
 * Since Template Editor and Product Editor are now merged into one Unified Editor,
 * we only use UnifiedHeader for all contexts.
 */
export function MainHeader() {
  const location = useLocation()
  const publishedAt = useStore(IntegrationStore, state => state.publishedAt)
  // Show onboarding progress bar only for traditional onboarding flow:
  // - Simplified onboarding (from wizard) adds &simplified=true — skip progress bar
  // - Also skip when product is already published
  const isSimplifiedOnboarding = new URLSearchParams(location.search).get('simplified') === 'true'
  const isOnboarding = isOnboardingRoute(location.search) && !isSimplifiedOnboarding && !publishedAt
  const progress = useTemplateProgress(isOnboarding)

  return (
    <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--p-color-bg-surface)' }}>
      <UnifiedHeader />
      {isOnboarding && <OnboardingProgressBar progress={progress} />}
    </div>
  )
}

/**
 * Renders the inspector header for mobile devices
 */
export function MobileInspectorHeader() {
  return (
    <div style={{ gridColumn: '1 / -1', gridRow: '2' }}>
      <InspectorHeader />
      <div style={{ borderTop: '1px solid var(--p-color-border)' }} />
    </div>
  )
}

/**
 * Renders the inspector header for tablet devices
 */
export function TabletInspectorHeader() {
  return (
    <div style={{ gridColumn: '1 / -1', gridRow: '2' }}>
      <InspectorHeader />
      <div style={{ borderTop: '1px solid var(--p-color-border)' }} />
    </div>
  )
}

/**
 * Combined layout header component that renders appropriate headers based on device type
 */
export default function LayoutHeader({ isSmallMobileView, isTabletView }: LayoutHeaderProps) {
  return (
    <>
      <MainHeader />

      {/* Mobile inspector header below main header (shown in both editor and preview) */}
      {isSmallMobileView && <MobileInspectorHeader />}

      {/* Tablet inspector header below main header (shown in both editor and preview) */}
      {isTabletView && <TabletInspectorHeader />}
    </>
  )
}
