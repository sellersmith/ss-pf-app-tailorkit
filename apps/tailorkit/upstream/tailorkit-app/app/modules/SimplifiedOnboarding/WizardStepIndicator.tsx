/**
 * Visual step progress indicator for the Simplified Onboarding wizard.
 * Desktop: numbered circles with connecting lines.
 * Mobile: "Step N of 5" text with ProgressBar.
 */

import { Fragment } from 'react'
import { Box, Icon, ProgressBar, Text } from '@shopify/polaris'
import { CheckCircleIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import { STEP_LABELS, STEP_NUMBERS, WIZARD_STEPS } from './constants'
import type { WizardStepIndicatorProps } from './types'
import styles from './styles.module.css'

export function WizardStepIndicator({ currentStep, completedSteps }: WizardStepIndicatorProps) {
  const { t } = useTranslation()
  const { isMobileView } = useScreenBreakpoints()

  if (isMobileView) {
    const currentNumber = STEP_NUMBERS[currentStep]
    const progress = ((currentNumber - 1) / (WIZARD_STEPS.length - 1)) * 100

    return (
      <Box padding="300">
        <div className={styles.mobileStepIndicator}>
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('step-current-of-total', { current: currentNumber, total: WIZARD_STEPS.length })}
          </Text>
          <Box paddingBlockStart="200">
            <ProgressBar progress={progress} size="small" />
          </Box>
        </div>
      </Box>
    )
  }

  return (
    <div className={styles.stepIndicatorContainer}>
      {WIZARD_STEPS.map((step, index) => {
        const isActive = step === currentStep
        const isCompleted = completedSteps.includes(step)
        const stepNumber = index + 1
        const isLast = index === WIZARD_STEPS.length - 1

        return (
          <Fragment key={step}>
            <div className={styles.stepNode}>
              <div
                className={`${styles.stepCircle} ${
                  isActive
                    ? styles.stepCircleActive
                    : isCompleted
                      ? styles.stepCircleCompleted
                      : styles.stepCircleFuture
                }`}
                aria-label={t('step-number-of-total-name', {
                  number: stepNumber,
                  total: WIZARD_STEPS.length,
                  name: STEP_LABELS[step],
                })}
              >
                {isCompleted ? <Icon source={CheckCircleIcon} /> : stepNumber}
              </div>
              <span className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ''}`}>
                {t(STEP_LABELS[step])}
              </span>
            </div>
            {!isLast && <div className={`${styles.stepLine} ${isCompleted ? styles.stepLineCompleted : ''}`} />}
          </Fragment>
        )
      })}
    </div>
  )
}
