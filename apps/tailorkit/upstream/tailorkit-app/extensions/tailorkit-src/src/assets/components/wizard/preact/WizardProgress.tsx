/** @jsxImportSource preact */
import { Fragment } from 'preact'
import { translate } from '../../../libraries/translation'

export interface WizardProgressStep {
  label: string
  optional?: boolean
}

export interface WizardProgressProps {
  steps: WizardProgressStep[]
  currentStep: number
  completedSteps: Set<number>
  skippedSteps: Set<number>
  totalSteps: number
  allowFreeNavigation?: boolean
  onJump?: (stepIndex: number) => void
}

const BASE = 'emtlkit--wizard'

function StepCircle({ index, isCompleted, isSkipped }: { index: number; isCompleted: boolean; isSkipped: boolean }) {
  if (isCompleted) {
    return (
      <span className={`${BASE}-step-number`} aria-label={translate('wizard-completed', 'Completed')}>
        &#10003;
      </span>
    )
  }
  if (isSkipped) {
    return (
      <span className={`${BASE}-step-number`} aria-label={translate('wizard-skipped', 'Skipped')}>
        &#8722;
      </span>
    )
  }
  return <span className={`${BASE}-step-number`}>{index + 1}</span>
}

function Step({
  step,
  index,
  currentStep,
  completedSteps,
  skippedSteps,
  allowFreeNavigation,
  onJump,
}: {
  step: WizardProgressStep
  index: number
  currentStep: number
  completedSteps: Set<number>
  skippedSteps: Set<number>
  allowFreeNavigation: boolean
  onJump?: (stepIndex: number) => void
}) {
  const isActive = index === currentStep
  const isCompleted = completedSteps.has(index)
  const isSkipped = skippedSteps.has(index)
  const isClickable = allowFreeNavigation && isCompleted

  let stateClass = `${BASE}-step--upcoming`
  if (isActive) stateClass = `${BASE}-step--active`
  else if (isCompleted) stateClass = `${BASE}-step--completed`
  else if (isSkipped) stateClass = `${BASE}-step--skipped`

  const classes = [`${BASE}-step`, stateClass, isClickable ? `${BASE}-step--clickable` : ''].filter(Boolean).join(' ')

  const handleClick = isClickable && onJump ? () => onJump(index) : undefined
  const handleKeyDown
    = isClickable && onJump
      ? (e: Event) => {
          const key = (e as KeyboardEvent).key
          if (key === 'Enter' || key === ' ') {
            e.preventDefault()
            onJump(index)
          }
        }
      : undefined

  return (
    <div
      className={classes}
      data-step={String(index)}
      aria-current={isActive ? 'step' : 'false'}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <StepCircle index={index} isCompleted={isCompleted} isSkipped={isSkipped} />
      <span className={`${BASE}-step-label`}>
        {step.label}
        {step.optional && (
          <small className={`${BASE}-step-optional`}> ({translate('wizard-optional', 'Optional')})</small>
        )}
      </span>
    </div>
  )
}

export function WizardProgress({
  steps,
  currentStep,
  completedSteps,
  skippedSteps,
  totalSteps,
  allowFreeNavigation = false,
  onJump,
}: WizardProgressProps) {
  const pct = totalSteps > 0 ? Math.round((completedSteps.size / totalSteps) * 100) : 0
  const stepOfLabel = translate('wizard-step-of', 'Step {{current}} of {{total}}', {
    current: String(currentStep + 1),
    total: String(totalSteps),
  })

  return (
    <div>
      {/* Mobile/Modal: "Step X of Y · Label" + progress bar */}
      <div className={`${BASE}-progress-mobile`}>
        <span className={`${BASE}-progress-mobile-text`}>
          {stepOfLabel} · {steps[currentStep]?.label}
        </span>
        <div className={`${BASE}-progress-mobile-bar`}>
          <div className={`${BASE}-progress-mobile-bar-fill`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Desktop: horizontal stepper */}
      <div className={`${BASE}-progress-desktop`}>
        {steps.map((step, index) => (
          <Fragment key={index}>
            <Step
              step={step}
              index={index}
              currentStep={currentStep}
              completedSteps={completedSteps}
              skippedSteps={skippedSteps}
              allowFreeNavigation={allowFreeNavigation}
              onJump={onJump}
            />
            {index < steps.length - 1 && (
              <div
                className={[
                  `${BASE}-step-connector`,
                  completedSteps.has(index) || skippedSteps.has(index) ? `${BASE}-step-connector--filled` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {'\u00A0'}
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export default WizardProgress
