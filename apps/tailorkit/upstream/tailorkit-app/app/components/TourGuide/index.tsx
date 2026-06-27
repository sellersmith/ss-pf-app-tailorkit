import { Button } from '@shopify/polaris'
import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GuidedTourBackdrop from './components/TourGuideBackdrop'
import TourGuideCard from './components/TourGuideCard'
import {
  CARD_TARGET_SPACING,
  DEFAULT_RECURSIVE_QUERY_COUNT,
  DEFAULT_RECURSIVE_QUERY_TIME,
  ECardPlacement,
} from './constants'
import styles from './styles.module.css'
import type { TourGuidePosition, HighlightRect, ITourGuideProps } from './types'
import {
  addTooltipTriangle,
  constrainPositionToViewport,
  getPositionByPlacement,
  getViewportDimension,
  scrollElementToCenter,
  toggleScroll,
} from './utils/fns'
import useCheckStepAction from './utils/useCheckStepAction'
import evaluateHighlightRectSize from './utils/evaluateHighlightRectSize'
import { useElementObserver } from './utils/useElementObserver'
import { useEnhanceEvents } from './utils/useEnhanceEvents'
import { EMPTY_ARRAY } from '~/constants'
import { useUtilizerRef } from './utils/useUtilizerRef'
import TourGuideArrow from './components/TourGuideArrow'
import { useLiveChat } from '~/utils/hooks/useLiveChat'

/**
 * TourGuide component is built to be highly configurable.
 * Work natively on React and Shopify Polaris style without inserting dependencies package.
 *
 * @author Long Billy, Long PC
 *
 * @param props ITourGuideProps
 * @returns
 */
const TourGuide: React.FC<ITourGuideProps> = props => {
  const {
    flow,
    startStepId,
    active,
    showProgress,
    showSkip = true,
    skipLabel = 'Skip',
    canInteractHighlight = true,
    // showArrow = false,
    arrowConfig = {},
    onPrev,
    onNext,
    onSkip,
    onFinish,
    onDontShowAgain,
  } = props
  const { t } = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)

  // Utilize refs
  const recursiveQueryRef = useRef<number>(DEFAULT_RECURSIVE_QUERY_COUNT)
  const {
    intervalRef,
    animationTimeoutRef,
    recursiveTimeoutRef,
    tourActiveChangeRef,
    clearIntervalRef,
    clearAnimationTimeoutRef,
    clearRecursiveTimeoutRef,
    setTourActiveChangeRef,
  } = useUtilizerRef()

  const tourId = flow.id
  // Define steps
  const steps = useMemo(() => flow.steps ?? EMPTY_ARRAY, [flow])

  const [stepIndex, setStepIndex] = useState(startStepId ? steps.findIndex(step => step.id === startStepId) : 0)

  // Get current step
  const currentStep = useMemo(() => steps[stepIndex] ?? steps[0], [steps, stepIndex])
  // Temporary disable arrow
  // const shouldShowArrow = !!(showArrow || (currentStep.element && (showArrow || currentStep.arrowSelector)))
  const shouldShowArrow = false
  const arrowRef = useRef<boolean>(shouldShowArrow)
  const currentStepId = currentStep.id

  // Get current condition of next and pre status
  const { isNextCurrentStepDisabled, isPreCurrentStepDisabled } = useCheckStepAction(currentStep)

  const canGoBack = stepIndex > 0 && !isPreCurrentStepDisabled

  // Tour guide card position
  const [position, setPosition] = useState<TourGuidePosition>({})

  // High light rect dimension and position
  const [highlightRect, setHighlightRect] = useState<HighlightRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })

  const moveCardPosition = useCallback(
    (_stepIndex?: number) => {
      // Clear the timeout
      clearTimeout(animationTimeoutRef.current)
      clearTimeout(recursiveTimeoutRef.current)

      const currentStep = steps[_stepIndex ?? stepIndex] ?? steps[0]
      const recursiveQueryRefValue = recursiveQueryRef.current

      if (!currentStep) return

      const {
        element: elementSelector,
        placement = ECardPlacement.CENTER,
        delay = 0,
        stageRadius,
        stagePadding = 0,
        recursiveQuery,
        disableActiveInteraction,
      } = currentStep

      try {
        // Query target element
        const element = document.querySelector(elementSelector)

        // Retry if element has zero dimensions (e.g. Konva stage not yet initialized)
        const hasZeroDimensions
          = element
          && (() => {
            const rect = element.getBoundingClientRect()
            return rect.width === 0 || rect.height === 0
          })()

        if ((!element || hasZeroDimensions) && recursiveQuery && recursiveQueryRefValue <= recursiveQuery) {
          arrowRef.current = false

          // Retry to query element
          recursiveTimeoutRef.current = setTimeout(() => {
            moveCardPosition(_stepIndex)

            // Increase recursive query count
            recursiveQueryRef.current++
          }, DEFAULT_RECURSIVE_QUERY_TIME)

          return
        }
        // Reset recursive query count if element is found
        recursiveQueryRef.current = DEFAULT_RECURSIVE_QUERY_COUNT

        const cardElement = cardRef.current
        if (!element || !cardElement) return

        // Scroll element first
        scrollElementToCenter(element)

        // Show arrow if element is found
        arrowRef.current = shouldShowArrow

        // Set animation time while moving
        animationTimeoutRef.current = setTimeout(() => {
          // Get the bounding rectangle of the target element and the card element
          const targetRect = element.getBoundingClientRect()

          const { left: x, top: y, width, height } = targetRect

          const cardRect = cardElement.getBoundingClientRect()

          // Get screen viewport
          const viewport = getViewportDimension()

          // Revaluate the highlight size
          const constrainedRect = evaluateHighlightRectSize(targetRect, stagePadding)
          const constrainedTargetRect = { ...cardRect, ...constrainedRect }

          // Get the initial position of the card based on the placement
          const initialPosition = getPositionByPlacement(
            placement,
            constrainedTargetRect,
            cardRect,
            CARD_TARGET_SPACING
          )

          // Constrain the position of the card to the viewport
          const constrainedPosition = constrainPositionToViewport(initialPosition, cardRect, viewport)

          // Set dimension and coordinate for highlight box
          setHighlightRect({
            x,
            y,
            width,
            height,
            rx: stageRadius,
            ry: stageRadius,
            padding: stagePadding,
            disableActiveInteraction,
          })

          // Place tooltip triangle base on computed position
          addTooltipTriangle(cardElement, placement, cardRect)
          setPosition(constrainedPosition)
        }, delay)
      } catch (error) {
        console.error('Error in moveCardPosition:', error)
      }
    },
    [animationTimeoutRef, recursiveTimeoutRef, shouldShowArrow, stepIndex, steps]
  )

  const onCloseTourHandler = useCallback(() => {
    // Run onSkip
    typeof onSkip === 'function' && onSkip()

    // Run onSkip of current step
    const onCurrentSkip = currentStep.onSkip
    if (typeof onCurrentSkip === 'function') {
      onCurrentSkip()
    }

    toggleScroll(true)
  }, [onSkip, currentStep.onSkip])

  const onFinishTourHandler = useCallback(() => {
    // Run onFinish
    typeof onFinish === 'function' && onFinish()

    toggleScroll(true)
  }, [onFinish])

  const onDontShowAgainHandler = useCallback(() => {
    typeof onDontShowAgain === 'function' && onDontShowAgain()

    toggleScroll(true)
  }, [onDontShowAgain])

  const onCheckActionDone = useCallback(async () => {
    const recursiveSelector = currentStep.recursiveElement
    const recursiveElement = recursiveSelector && document.querySelector(recursiveSelector)

    if (recursiveSelector && !recursiveElement) {
      return // Wait until the element appears
    }

    let nextStep = stepIndex + 1 // Check if next step can skip or not

    async function checkSkipStep(stepIndex: number) {
      const nextStepData = steps[stepIndex]
      const skipNextStepWhen = nextStepData?.skipThisStepWhen

      // Check if skip this step is promise function or normal function
      const isSkipNextStepIsFunction = typeof skipNextStepWhen === 'function'
      const isSkipNextStepIsPromise = skipNextStepWhen instanceof Promise

      const _skipThisStepWhen = isSkipNextStepIsFunction
        ? isSkipNextStepIsPromise
          ? await skipNextStepWhen()
          : skipNextStepWhen()
        : skipNextStepWhen

      return _skipThisStepWhen
    }

    while (nextStep < steps.length && (await checkSkipStep(nextStep))) {
      nextStep += 1
    }

    // If all remaining steps are skipped, finish the tour
    if (nextStep >= steps.length) {
      clearIntervalRef()
      return
    }

    setStepIndex(nextStep)

    // Move card to position with the next step
    moveCardPosition(nextStep)

    // Clear the timer as the condition has been satisfied
    clearIntervalRef()
  }, [currentStep.recursiveElement, stepIndex, steps, moveCardPosition, clearIntervalRef])

  const onMoveNextHandler = useCallback(
    (stepIndex: number, triggeredNextFuc?: boolean) => {
      clearIntervalRef()

      const isLastStep = stepIndex === steps.length - 1

      const currentStep = steps[stepIndex ?? stepIndex] ?? steps[0]

      if (typeof onNext?.action === 'function') {
        onNext.action(currentStep.id)
      }

      const onCurrentNext = currentStep.onNext
      if (typeof onCurrentNext === 'function' && !triggeredNextFuc) {
        try {
          onCurrentNext()
        } catch (error) {
          console.error('Error in step onNext callback:', error)
        }
      }

      if (isLastStep) {
        onFinishTourHandler()

        return
      }

      intervalRef.current = setInterval(onCheckActionDone, 150)
    },
    [steps, intervalRef, onNext, onCheckActionDone, onFinishTourHandler, clearIntervalRef]
  )

  const onMovePreviousHandler = useCallback(
    (stepIndex: number) => {
      if (stepIndex > 0) {
        if (typeof onPrev?.action === 'function') {
          onPrev.action()
        }

        const onCurrentPre = currentStep.onPre
        if (typeof onCurrentPre === 'function') {
          const result = onCurrentPre()

          if (typeof result === 'boolean' && !result) {
            return
          }
        }

        const preStep = stepIndex - 1

        setStepIndex(preStep)

        // Move card to position with pre step
        moveCardPosition(preStep)
      }
    },
    [currentStep.onPre, moveCardPosition, onPrev]
  )

  const onMoveNextByEvents = useCallback(() => {
    return onMoveNextHandler(stepIndex, true)
  }, [stepIndex, onMoveNextHandler])

  // Enhance events for tour guide (must run before observer to gate on mountReady)
  const { mountReady } = useEnhanceEvents(currentStep, !!active, onMoveNextByEvents)

  const onMoveCardHandler = useCallback(() => {
    if (!mountReady) return
    return moveCardPosition(stepIndex)
  }, [stepIndex, moveCardPosition, mountReady])

  // Observer the element selector changes
  useElementObserver(currentStep.element, onMoveCardHandler)

  useEffect(() => {
    // Clean up the interval and timeouts
    return () => {
      clearIntervalRef()
      clearAnimationTimeoutRef()
      clearRecursiveTimeoutRef()
    }
  }, [clearIntervalRef, clearAnimationTimeoutRef, clearRecursiveTimeoutRef])

  const renderNavigationButtons = useMemo(
    () => (
      <div className={styles.navigationContainer}>
        {(showSkip || currentStep?.preLabel) && onCloseTourHandler && (
          <Button onClick={onCloseTourHandler} variant="monochromePlain">
            {showSkip ? skipLabel : currentStep?.preLabel}
          </Button>
        )}
        {onDontShowAgain && (
          <Button onClick={onDontShowAgainHandler} variant="monochromePlain">
            {t('don-t-show-again')}
          </Button>
        )}
        <div style={{ flex: 1 }} />
        {onPrev && canGoBack && (
          <Button id="tour-guide-card-back" variant="monochromePlain" onClick={() => onMovePreviousHandler(stepIndex)}>
            {onPrev.content || t('back')}
          </Button>
        )}
        <Button
          id="tour-guide-card-next"
          disabled={isNextCurrentStepDisabled}
          variant="secondary"
          onClick={() => onMoveNextHandler(stepIndex)}
        >
          {currentStep?.nextLabel || onNext.content || t('next')}
        </Button>
      </div>
    ),
    [
      onPrev,
      canGoBack,
      showSkip,
      onCloseTourHandler,
      currentStep?.preLabel,
      currentStep?.nextLabel,
      skipLabel,
      isNextCurrentStepDisabled,
      onNext.content,
      onMovePreviousHandler,
      stepIndex,
      onMoveNextHandler,
      onDontShowAgain,
      onDontShowAgainHandler,
      t,
    ]
  )

  useEffect(() => {
    // If the tourActive change and is true, we call the previous of onNext function
    if (active && tourActiveChangeRef.current > 0) {
      const onContinueTour = currentStep.onContinueTour

      if (typeof onContinueTour === 'function') {
        onContinueTour()

        // Reset the tourActiveChangeRef
        setTourActiveChangeRef(0)
      }
    }

    // Increase the tourActiveChangeRef
    setTourActiveChangeRef(tourActiveChangeRef.current + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const { closeChatBox } = useLiveChat()

  useLayoutEffect(() => {
    closeChatBox()
  }, [closeChatBox])

  if (steps.length === 0 || !active) return null

  return (
    <Fragment>
      <GuidedTourBackdrop highlightRect={highlightRect} canInteractHighlight={canInteractHighlight} />

      {/* Add the arrow component */}
      {arrowRef.current && (
        <TourGuideArrow
          visible={active}
          targetSelector={currentStep.arrowSelector || currentStep.element}
          color={currentStep.arrowConfig?.color || arrowConfig.color}
          size={currentStep.arrowConfig?.size || arrowConfig.size}
          animationDuration={currentStep.arrowConfig?.animationDuration || arrowConfig.animationDuration}
          animationStyle={currentStep.arrowConfig?.animationStyle || arrowConfig.animationStyle}
          startPosition={currentStep.arrowConfig?.startPosition || arrowConfig.startPosition}
          offset={currentStep.arrowConfig?.offset || arrowConfig.offset}
          placement={currentStep.arrowConfig?.placement || arrowConfig.placement}
          curveIntensity={currentStep.arrowConfig?.curveIntensity || arrowConfig.curveIntensity || 0.4}
        />
      )}

      <TourGuideCard
        tourId={tourId}
        stepId={currentStepId}
        steps={steps}
        stepIndex={stepIndex}
        cardRef={cardRef}
        title={currentStep?.title}
        content={currentStep?.content}
        helpText={currentStep?.helpText}
        progress={showProgress && steps.length > 1 ? `${stepIndex + 1} / ${steps.length}` : ''}
        position={position}
        onClose={currentStep?.showClose === false ? undefined : onCloseTourHandler}
        renderNavigationButtons={renderNavigationButtons}
      />
    </Fragment>
  )
}

export default TourGuide
