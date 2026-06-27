/**
 * WizardInPage: full-width in-page variant of the 5-step simplified onboarding wizard.
 * All state, handlers, and computed values live in useWizardCore.
 * All step rendering lives in WizardContent.
 *
 * Layout: Card grows with content, page scrolls naturally.
 * Actions render in both the Page title bar and the card footer.
 */

import { useRef, useMemo, useState, useCallback } from 'react'
import { Button, InlineStack, Page, Pagination } from '@shopify/polaris'
import { useWizardCore } from './hooks/useWizardCore'
import { WizardContent, WizardContentHeader } from './WizardContent'
import { WizardErrorBoundary } from './WizardErrorBoundary'
import type { SimplifiedOnboardingWizardProps } from './types'
import styles from './styles-in-page.module.css'

export function WizardInPage({
  active,
  appConfig,
  onComplete,
  onSkip,
  entryPoint,
  backAction,
}: SimplifiedOnboardingWizardProps) {
  const core = useWizardCore({ active, appConfig, onComplete, onSkip, entryPoint })

  const cardRef = useRef<HTMLDivElement>(null)

  // Pagination state lifted from ProductSelectionStep
  const [pagination, setPagination] = useState<{
    hasNext: boolean
    hasPrevious: boolean
    onNext: () => void
    onPrevious: () => void
  } | null>(null)

  const handlePaginationChange = useCallback(
    (p: { hasNext: boolean; hasPrevious: boolean; onNext: () => void; onPrevious: () => void } | null) => {
      setPagination(p)
    },
    []
  )

  // Page-level actions — renders buttons in the Page title bar for all steps
  const pageActions = useMemo(
    () => ({
      primaryAction: core.primaryAction
        ? {
            content: core.primaryAction.content,
            onAction: core.primaryAction.onAction,
            disabled: core.primaryAction.disabled,
            loading: core.primaryAction.loading,
          }
        : undefined,
      secondaryActions: core.secondaryActions.map(a => ({
        content: a.content,
        onAction: a.onAction,
        loading: a.loading,
        disabled: a.disabled,
      })),
    }),
    [core.primaryAction, core.secondaryActions]
  )

  if (!active) return null

  return (
    <WizardErrorBoundary>
      <Page
        title={core.title}
        backAction={backAction}
        primaryAction={pageActions.primaryAction}
        secondaryActions={pageActions.secondaryActions}
      >
        <div ref={cardRef} className={styles.card}>
          {/* Header: step indicator + heading */}
          <div className={styles.cardHeader}>
            <WizardContentHeader core={core} />
          </div>

          {/* Step body */}
          <div className={styles.cardBody}>
            <WizardContent core={core} appConfig={appConfig} hideHeader onPaginationChange={handlePaginationChange} />
          </div>

          {/* Footer: pagination (left) + action buttons (right) */}
          <div className={styles.cardFooter}>
            <InlineStack align="space-between" blockAlign="center" gap="200">
              <div>
                {core.state.currentStep === 'product'
                  && pagination
                  && (pagination.hasNext || pagination.hasPrevious) && (
                    <Pagination
                      hasPrevious={pagination.hasPrevious}
                      hasNext={pagination.hasNext}
                      onPrevious={pagination.onPrevious}
                      onNext={pagination.onNext}
                    />
                  )}
              </div>
              <InlineStack align="end" gap="200">
                {core.secondaryActions.map(action => (
                  <Button
                    key={action.content}
                    onClick={action.onAction}
                    loading={action.loading}
                    disabled={action.disabled}
                  >
                    {action.content}
                  </Button>
                ))}
                {core.primaryAction && (
                  <Button
                    variant="primary"
                    onClick={core.primaryAction.onAction}
                    disabled={core.primaryAction.disabled}
                    loading={core.primaryAction.loading}
                  >
                    {core.primaryAction.content}
                  </Button>
                )}
              </InlineStack>
            </InlineStack>
          </div>
        </div>
      </Page>
    </WizardErrorBoundary>
  )
}
