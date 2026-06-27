import { type ReactNode, useCallback, useMemo, type ComponentType, Fragment } from 'react'
import { useOnboardingTour } from '../hooks/useOnboardingTour'
import type { OnboardingQuestion } from '../types'
import LoadingOnboardingForm from '../components/LoadingOnboardingForm'
import { Box, TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { sendOnboardingFeedback } from '../utilities/sendOnboardingFeedback'
import { saveUserJourneyProgress } from '../utilities/saveUserJourneyProgress'
import { useLocation, useNavigate } from '@remix-run/react'
import { ONBOARDING_QUESTION_KEY } from '~/modules/Feedback/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { uuid } from '~/utils/uuid'
import { openIDBDatabase, storeJSONFileToIDB } from '~/bootstrap/db/index-db'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import { startTemplateEditorQuickTour } from '~/modules/TourGuides/TemplateEditorQuickTour/fns'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'

// Interface for props injected into the wrapped component
export interface IOnboardingWithCurrentStepProps {
  question: OnboardingQuestion
  isShowFirstTime: boolean
  hasNextStep: boolean
  hasPreviousStep: boolean
  getSelectedAnswer: (questionKey: string, isMultipleSelect?: boolean) => string[]
  handleSelectAnswer: (selected: string, questionKey: string) => void
  handleNextStep: () => void
  handlePreviousStep: () => void
  handleSaveProgressOnboardingData: (isFinished?: boolean) => Promise<void>
  renderComponentToOthers: () => ReactNode
}

const DASHBOARD_MODAL_ID = 'dashboard_modal'
const INTEGRATION_MODAL_ID = 'integration_modal'

/**
 * @author KhanhNT
 * Higher-Order Component (HOC) to inject onboarding logic and current step data into the wrapped component.
 *
 * @param WrappedComponent - The component that will receive the onboarding data as props.
 * @returns A new component that adds onboarding props to the WrappedComponent.
 */
function withCurrentStep<P extends IOnboardingWithCurrentStepProps>(
  WrappedComponent: ComponentType<P>
): React.FC<Omit<P, keyof IOnboardingWithCurrentStepProps>> {
  // Enhanced component returned by the HOC
  return function EnhancedComponent(props: Omit<P, keyof IOnboardingWithCurrentStepProps>) {
    const { t } = useTranslation()
    const { trackEvent } = useEventsTracking()
    const { pathname } = useLocation()
    const navigate = useNavigate()

    const isDashboard = pathname.includes('/dashboard')
    const isIntegration = pathname.includes('/integrations')

    // Fetching onboarding state from a custom hook
    const {
      questions,
      isShowFirstTime,
      loading,
      selectedState,
      currentStepKey,
      formId,
      setSelectedState,
      setCurrentStepKey,
    } = useOnboardingTour()

    // Determine the current index in the question list
    const currentIndex = useMemo(
      () =>
        Math.max(
          questions.findIndex(({ key }) => key === currentStepKey),
          0
        ),
      [questions, currentStepKey]
    )

    // Get the current question based on the current index
    const currentQuestion = questions[currentIndex] || questions[0]

    // Get label of current question
    const label = currentQuestion?.label

    // Determine if there are next or previous steps available
    const hasNextStep = currentIndex < questions.length - 1
    const hasPreviousStep = currentIndex > 0

    // Function to update the selectedState
    const updateSelectedState = useCallback(
      (questionKey: string, updates: Partial<any>) => {
        setSelectedState(prevState => {
          const newState = new Map(prevState)
          const currentState = prevState.get(questionKey) || { questionKey, selectedValue: '', customInput: '' }
          newState.set(questionKey, { ...currentState, ...updates })
          return newState
        })
      },
      [setSelectedState]
    )

    /**
     * Handles the submission of onboarding feedback.
     *
     * This function processes the questions and user-selected answers, maps them into a structured object with question labels as keys
     * and user answers as values, and then sends the feedback data to a backend service.
     *
     * Example:
     * If:
     * - questions = [{ key: 'experience', label: 'Your experience', options: [{ value: 'beginner', label: 'Beginner' }] }]
     * - selectedState = Map([['experience', { selectedValue: 'beginner' }]])
     * - formId = '12345'
     * Then:
     * - Sends: { 'Your experience': 'Beginner' }
     *
     * Errors:
     * - Logs an error to the console if the process or submission fails.
     */
    const handleSendOnboardingFeedback = useCallback(async () => {
      try {
        const answersDataPopulated = questions.reduce(
          (result: Record<string, string>, { key, label, options }) => {
            const selectedStateEntry = selectedState.get(key)

            // Initialize answer as an empty string
            let answer = ''

            if (selectedStateEntry) {
              const { selectedValue, customInput } = selectedStateEntry
              if (selectedValue) {
                // Map option values to their labels
                const optionLabelMap = options?.reduce(
                  (map, { value, label }) => ({ ...map, [value]: label }),
                  {} as Record<string, string>
                )

                const values = selectedValue.split(', ')

                // Construct answer from mapped labels
                answer = values
                  .map(value => {
                    if (value.toLocaleLowerCase() === 'others' && customInput) {
                      // Use custom input if selectedValue is 'others'
                      return `Others: "${customInput}"`
                    }
                    return optionLabelMap?.[value] || ''
                  })
                  .filter(Boolean) // Filter out any empty or undefined values
                  .join('; ')
              }
            }

            // Assign the constructed answer to the result using the label as the key
            const excludedAnswer = [ONBOARDING_QUESTION_KEY.LET_STARTED, ONBOARDING_QUESTION_KEY.THANK_YOU]
            if (label && !excludedAnswer.includes(key)) {
              result[label] = answer
            }
            return result
          },
          {} as Record<string, string>
        )

        await sendOnboardingFeedback(formId, answersDataPopulated)
      } catch (error) {
        console.error('Failed to handle send onboarding feedback', error)
      }
    }, [formId, questions, selectedState])

    // Handle save progress onboarding data
    const handleSaveProgressOnboardingData = useCallback(
      async (isFinished?: boolean) => {
        try {
          const onboardingData = Array.from(selectedState.values())
          await saveUserJourneyProgress({ data: onboardingData, currentStep: currentStepKey, isFinished })

          if (isFinished) {
            // Save the time users start creating a template
            if (!localStorage?.getItem('TLK_CREATING_TEMPLATE_START_AT')) {
              localStorage?.setItem('TLK_CREATING_TEMPLATE_START_AT', Date.now().toString())
            }

            const id = uuid()
            const storeName = IDB_STORE_NAME.TEMPLATE_DIMENSION
            const formData = {
              title: 'Untitled',
              ...DEFAULT_TEMPLATE_DIMENSION,
            }

            const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, storeName)
            await storeJSONFileToIDB(db, storeName, formData, id)
            const response = await startTemplateEditorQuickTour(id)

            if (response.success) {
              setTimeout(() => navigate(response.returnUrl), 100)
            }
            handleSendOnboardingFeedback()
          }
        } catch (error) {
          console.error('Failed to handle save progress onboarding ', error)
        }
      },
      [selectedState, currentStepKey, navigate, handleSendOnboardingFeedback]
    )

    // Handle moving to the next step
    const handleNextStep = useCallback(() => {
      if (!hasNextStep) {
        return
      }

      const selectedValue = selectedState.get(currentStepKey)?.selectedValue

      const nextQuestionKey = questions[currentIndex + 1]?.key
      if (nextQuestionKey && !selectedState.has(nextQuestionKey)) {
        updateSelectedState(nextQuestionKey, { selectedValue: '', customInput: '' })
      }

      if (label) {
        // Send selected value for tracking
        trackEvent(EVENTS_TRACKING.NEXT_TOUR, {
          [EVENTS_PARAMETERS_NAME.SELECTION]: selectedValue,
          [EVENTS_PARAMETERS_NAME.CURRENT_STEP]: label,
          [EVENTS_PARAMETERS_NAME.TYPE]: isDashboard ? DASHBOARD_MODAL_ID : isIntegration ? INTEGRATION_MODAL_ID : '',
        })
      }

      setCurrentStepKey(nextQuestionKey)
    }, [
      hasNextStep,
      selectedState,
      currentStepKey,
      label,
      questions,
      currentIndex,
      setCurrentStepKey,
      updateSelectedState,
      trackEvent,
      isDashboard,
      isIntegration,
    ])

    // Handle moving to the previous step
    const handlePreviousStep = useCallback(() => {
      if (hasPreviousStep) {
        setCurrentStepKey(questions[currentIndex - 1].key)

        const selectedValue = selectedState.get(currentStepKey)?.selectedValue

        if (label) {
          // Send selected value for tracking
          trackEvent(EVENTS_TRACKING.PREVIOUS_ONBOARDING, {
            [EVENTS_PARAMETERS_NAME.SELECTION]: selectedValue,
            [EVENTS_PARAMETERS_NAME.CURRENT_STEP]: label,
            [EVENTS_PARAMETERS_NAME.TYPE]: isDashboard ? DASHBOARD_MODAL_ID : isIntegration ? INTEGRATION_MODAL_ID : '',
          })
        }
      }
    }, [
      hasPreviousStep,
      setCurrentStepKey,
      questions,
      currentIndex,
      selectedState,
      currentStepKey,
      label,
      trackEvent,
      isDashboard,
      isIntegration,
    ])

    // Get select answer
    const getSelectedAnswer = useCallback(
      (questionKey: string, isMultipleSelect = false): string[] => {
        const selectedValues = selectedState.get(questionKey)?.selectedValue

        if (selectedValues) {
          return isMultipleSelect ? selectedValues.split(', ').filter(Boolean) : [selectedValues]
        }

        return []
      },
      [selectedState]
    )

    // Handle select answer
    const handleSelectAnswer = useCallback(
      (selected: string, questionKey: string) => {
        updateSelectedState(questionKey, { selectedValue: selected, customInput: '' })
      },
      [updateSelectedState]
    )

    // Define the component when user select on `Others` option
    const renderComponentToOthers = () => {
      const { label, key } = currentQuestion
      const editingState = selectedState.get(key) || { customInput: '', selectedValue: '', questionKey: '' }
      const { customInput = '', selectedValue = '' } = editingState
      const shouldRender = selectedValue.toLowerCase().includes('others')

      const handleChangeCustomInput = (value: string) => {
        updateSelectedState(key, { customInput: value })
      }

      return (
        shouldRender && (
          <Box paddingInlineStart={'500'} paddingBlockEnd={'400'} paddingInlineEnd={'400'}>
            <TextField
              autoComplete="off"
              label={label}
              labelHidden
              placeholder={t('input-text')}
              multiline={2}
              value={customInput}
              onChange={handleChangeCustomInput}
            />
          </Box>
        )
      )
    }

    // Show a loading screen if onboarding is loading
    if (loading) {
      return <LoadingOnboardingForm />
    }

    // If onboarding is not finished, render the WrappedComponent with injected onboarding data
    if (currentQuestion) {
      return (
        <Fragment>
          <WrappedComponent
            {...(props as P)}
            question={currentQuestion}
            isShowFirstTime={isShowFirstTime}
            hasNextStep={hasNextStep}
            hasPreviousStep={hasPreviousStep}
            getSelectedAnswer={getSelectedAnswer}
            handleSelectAnswer={handleSelectAnswer}
            handleNextStep={handleNextStep}
            handlePreviousStep={handlePreviousStep}
            handleSendOnboardingFeedback={handleSendOnboardingFeedback}
            handleSaveProgressOnboardingData={handleSaveProgressOnboardingData}
            renderComponentToOthers={renderComponentToOthers}
          />
        </Fragment>
      )
    }

    // Return null when onboarding is finished
    return null
  }
}

export default withCurrentStep
