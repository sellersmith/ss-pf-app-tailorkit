import { useCallback } from 'react'
import { useStore } from '~/libs/external-store'
import { type FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { feedbackStore } from '~/stores/feedback'
import withGatherUserFeedbackForm from './withGatherUserFeedbackForm'

/**
 * Higher-order component that adds feedback functionality to a component
 * @param Component - The component to wrap with feedback functionality
 * @param feedbackType - The type of feedback to gather
 * @returns A wrapped component with feedback functionality
 */
export default function withFeedback<T extends React.ComponentType<any>>(
  Component: T,
  feedbackType: FEEDBACK_TYPE,
  options?: {
    onSuccess?: () => void | Promise<void>
    onClose?: () => void | Promise<void>
  }
) {
  if (!Component) {
    console.error('[ERROR] Component is undefined in withFeedback')
    return Component
  }

  return function WithFeedbackWrapper(props: React.ComponentProps<T>) {
    const { onSuccess, onClose } = options || {}
    const feedbackState = useStore(feedbackStore, state => state[feedbackType]) || {}
    const feedbackCallback = feedbackState.callback

    const hideFeedbackForm = useCallback(() => {
      feedbackStore.dispatch({
        type: 'HIDE_FEEDBACK',
        payload: {
          feedbackType,
        },
      })
      feedbackCallback && feedbackCallback()
    }, [feedbackCallback])

    return withGatherUserFeedbackForm({
      Component,
      feedbackType,
      onCloseCallback: async () => {
        if (typeof onClose === 'function') {
          await onClose()
        }
        hideFeedbackForm()
      },
      onSuccessCallback: async () => {
        if (onSuccess) {
          await onSuccess()
        }
        hideFeedbackForm()
      },
    })(props)
  }
}
