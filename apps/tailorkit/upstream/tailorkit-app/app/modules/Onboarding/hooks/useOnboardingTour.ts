import { useEffect, useState } from 'react'
import { fetchActiveOnboardingForm } from '../utilities/fetchActiveOnboardingForm'
import type { OnboardingQuestion } from '../types'
import type { OnboardingData } from '~/models/UserJourney'

/**
 * @author KhanhNT
 *
 * Custom hook for managing the onboarding tour process.
 * This hook is responsible for fetching onboarding data, managing the current step,
 * and handling the state related to the questions and modal display in the onboarding process.
 *
 * It manages the following states:
 * - `loading`: Tracks whether the onboarding data is being fetched.
 * - `questions`: Stores the list of onboarding questions.
 * - `modalActive`: Tracks whether the onboarding modal should be active or not.
 * - `currentStepKey`: Holds the key of the current step in the onboarding process.
 * - `selectedState`: A map of the selected onboarding data for each question.
 *
 * The hook also provides functions to update the state:
 * - `setCurrentStepKey`: Allows updating the current step.
 * - `setModalActive`: Allows updating the modal active state.
 * - `setSelectedState`: Allows updating the selected data for each question.
 *
 * The hook fetches onboarding data using the `fetchOnboardingData` function, which:
 * - Retrieves the active onboarding form.
 * - Sets the onboarding questions and the current step.
 * - Tracks whether the form is finished and updates the modal visibility accordingly.
 * - Maps selected data for each question into the `selectedState` map.
 */

export const useOnboardingTour = (force = false) => {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([])
  const [isShowFirstTime, setIsShowFirstTime] = useState(false)
  const [formId, setFormId] = useState('')
  const [currentStepKey, setCurrentStepKey] = useState('')
  const [selectedState, setSelectedState] = useState<Map<string, OnboardingData>>(new Map())

  async function fetchOnboardingData() {
    setLoading(true)

    try {
      const onboardingForm = await fetchActiveOnboardingForm()
      if (onboardingForm) {
        const { currentStep, questions, currentStepData, formId, isShowFirstTime } = onboardingForm
        const _currentStep = currentStep || questions?.[0]?.key
        const initialSelectedState = new Map<string, OnboardingData>()

        if (formId && _currentStep) {
          currentStepData.forEach(data => {
            initialSelectedState.set(data.questionKey, data)
          })

          setFormId(formId)
          setQuestions(questions)
          setIsShowFirstTime(isShowFirstTime)
          setCurrentStepKey(_currentStep)
        }

        // Update the selected state with the tour progress
        setSelectedState(initialSelectedState)
      }
    } catch (err) {
      console.error('Cannot fetch onboarding data ', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      await fetchOnboardingData()
    })()
  }, [force])

  return {
    loading,
    questions,
    isShowFirstTime,
    currentStepKey,
    selectedState,
    formId,
    setSelectedState,
    setCurrentStepKey,
  }
}
