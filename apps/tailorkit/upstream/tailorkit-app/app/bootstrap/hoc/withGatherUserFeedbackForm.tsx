import { Fragment, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FeedbackData, UserJourneyDocument } from '~/models/UserJourney'
import Feedback from '~/modules/Feedback'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { getUserJourneyOfTourGuide } from './withTourGuide'
import { saveUserJourneyProgress } from '~/modules/Onboarding/utilities/saveUserJourneyProgress'
import { type IPostFeedbackData } from '~/modules/Feedback/types'
import { type FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { useGatherUserFeedbackForm } from '~/modules/Feedback/hooks/useGatherUserFeedbackForm'
import { TOAST } from '~/constants/toasts'
import { Checkbox } from '@shopify/polaris'

// Flag for enabling tour guide when needed
const enableGatherUserFeedbackForm = true
const DONT_SHOW_AGAIN_KEY = 'dontShowAgain'

interface WithGatherUserFeedbackFormProps {
  Component: React.ComponentType<any>
  feedbackType: FEEDBACK_TYPE
  onSuccessCallback?: () => void | Promise<void>
  onCloseCallback?: () => void | Promise<void>
  autoTrigger?: boolean
  triggerDelay?: number
  disabled?: boolean
}

/**
 * Higher-Order Component (HOC) to wrap a component with user feedback form functionality.
 * This is used in the context of a tour guide feature to gather user feedback.
 *
 * @param {Object} params - The parameters for the HOC.
 * @param {React.ComponentType<any>} params.Component - The component to be wrapped.
 * @param {FEEDBACK_TYPE} params.feedbackType - The type of feedback to be gathered.
 * @param {boolean} [params.autoTrigger=true] - Whether to automatically trigger the feedback form.
 * @param {number} [params.triggerDelay=0] - Delay before triggering the feedback form.
 * @param {Function} [params.onSuccessCallback] - Callback executed on successful feedback submission.
 * @param {Function} [params.onCloseCallback] - Callback executed when the feedback form is closed.
 * @returns {React.ComponentType<any>} - A component wrapped with feedback form functionality.
 */
export default function withGatherUserFeedbackForm({
  Component,
  feedbackType,
  autoTrigger = true,
  triggerDelay = 0,
  onSuccessCallback,
  onCloseCallback,
  // TODO: Temporary disable all feedback forms to find another useful way to collect user feedback
  disabled = true,
}: WithGatherUserFeedbackFormProps) {
  return function WithGatherUserFeedbackForm(props: any) {
    const { t, i18n } = useTranslation()
    const { showFeedback, feedbackCallback } = useGatherUserFeedbackForm({
      feedbackType,
    })

    const params = new URLSearchParams({ formType: feedbackType })
    const dataSource = `/api/feedback?${params.toString()}`
    const sessionKey = `${DONT_SHOW_AGAIN_KEY}-${feedbackType}`
    const dontShowAgainFromSessionStorage = sessionStorage.getItem(sessionKey) === 'true'
    const [dontShowAgainState, setDontShowAgainState] = useState(dontShowAgainFromSessionStorage)

    // Journey state
    const [userJourney, setUserJourney] = useState<UserJourneyDocument | undefined | null>(undefined)
    const [loaded, setLoaded] = useState(false)
    const [isFinished, setIsFinished] = useState(false)

    useEffect(() => {
      if (dontShowAgainFromSessionStorage) {
        if (typeof feedbackCallback === 'function') {
          feedbackCallback()
        }
        return
      }

      if (autoTrigger && showFeedback) {
        const timer = setTimeout(() => {
          ;(async () => {
            try {
              // Get current tour journey
              const userJourney = await getUserJourneyOfTourGuide(feedbackType)

              // Set tour journey
              if (userJourney) {
                setUserJourney(userJourney)
                setIsFinished(userJourney.isFinished)
              } else {
                setUserJourney(null)
              }
              setLoaded(true)
            } catch (e) {
              console.error(e)
            }
          })()
        }, triggerDelay)
        return () => clearTimeout(timer)
      }
    }, [dontShowAgainFromSessionStorage, feedbackCallback, showFeedback])

    const onDontShowAgain = useCallback(() => {
      if (dontShowAgainState) {
        sessionStorage.setItem(sessionKey, dontShowAgainState.toString())
      }
    }, [dontShowAgainState, sessionKey])

    const onSuccess = useCallback(
      async (postData?: IPostFeedbackData) => {
        if (postData && Object.keys(postData).length > 0) {
          const data: FeedbackData[] = Object.entries(postData).map(([formId, formData]) => ({
            formId,
            data: Object.entries(formData as Record<string, string>).map(([questionKey, selectedValue]) => ({
              questionKey,
              selectedValue,
            })),
          }))

          await saveUserJourneyProgress({
            type: feedbackType,
            data,
            isFinished: true,
          })

          showToast(t(TOAST.FEEDBACK.THANKS_FOR_YOUR_FEEDBACK))
          onDontShowAgain()
        }

        if (typeof onSuccessCallback === 'function') {
          await onSuccessCallback()
        }
      },
      [onDontShowAgain, t]
    )

    const onClose = useCallback(async () => {
      if (typeof onCloseCallback === 'function') {
        await onCloseCallback()
      }
      onDontShowAgain()
    }, [onDontShowAgain])

    return (
      <Fragment>
        <Component {...props} />

        {!disabled
          && enableGatherUserFeedbackForm
          && !dontShowAgainFromSessionStorage
          && showFeedback
          && loaded
          && !isFinished && (
            <Feedback
              t={t}
              dataSource={dataSource}
              displayAs={'modal'}
              userJourney={userJourney}
              defaultOpen={autoTrigger}
              primaryActionContent={t('submit')}
              showSubmitted={false}
              fetchFunction={authenticatedFetch}
              onError={() => showGenericErrorToast()}
              onSuccess={onSuccess}
              onClose={onClose}
              showDontShowAgain
              localeToResponse={i18n.language}
              dontShowAgain={dontShowAgainState}
              footerMarkup={
                <Checkbox
                  label={t('do-not-show-again')}
                  checked={dontShowAgainState}
                  onChange={() => setDontShowAgainState(!dontShowAgainState)}
                />
              }
            />
          )}
      </Fragment>
    )
  }
}
