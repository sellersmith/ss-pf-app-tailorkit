import { useCallback, useEffect, useState } from 'react'
import type { disableUntilFnc, TourGuideStep } from '../types'

const POLL_TIME = 500

/**
 * Hook for evaluating if current step can do action next or pre or not
 *
 * @param currentStep TourGuideStep
 * @returns { isNextCurrentStepDisabled: boolean, isPreCurrentStepDisabled: boolean}
 */
function useCheckStepAction(currentStep: TourGuideStep) {
  const [isNextCurrentStepDisabled, setIsNextCurrentStepDisabled] = useState(false)
  const [isPreCurrentStepDisabled, setIsPreCurrentStepDisabled] = useState(false)

  // Function to check and poll condition
  const checkAndPollCondition = useCallback(
    (conditionFunc: disableUntilFnc, setDisabledState: React.Dispatch<React.SetStateAction<boolean>>) => {
      let isMounted = true
      let interval: NodeJS.Timeout | null = null

      const checkCondition = async () => {
        const conditionMet = await conditionFunc()
        if (isMounted) {
          setDisabledState(!conditionMet) // Set the disabled state based on the condition
        }
        return conditionMet
      }

      const pollCondition = () => {
        interval = setInterval(async () => {
          await checkCondition()
        }, POLL_TIME) // Poll every 500ms
      }

      checkCondition() // Initial check
      pollCondition()

      return () => {
        isMounted = false
        if (interval) clearInterval(interval)
      }
    },
    []
  )

  // Check the `disableNextUntil` condition if present
  useEffect(() => {
    // Reset the disabled state before checking the condition
    setIsNextCurrentStepDisabled(false)

    if (currentStep?.disableNextUntil && typeof currentStep.disableNextUntil === 'function') {
      return checkAndPollCondition(currentStep.disableNextUntil, setIsNextCurrentStepDisabled)
    }
  }, [currentStep, checkAndPollCondition])

  // Check the `disablePreUntil` condition if present
  useEffect(() => {
    // Reset the disabled state before checking the condition
    setIsPreCurrentStepDisabled(false)

    if (currentStep?.disablePreUntil && typeof currentStep.disablePreUntil === 'function') {
      return checkAndPollCondition(currentStep.disablePreUntil, setIsPreCurrentStepDisabled)
    }
  }, [currentStep, checkAndPollCondition])

  return {
    isNextCurrentStepDisabled,
    isPreCurrentStepDisabled,
  }
}

export default useCheckStepAction
