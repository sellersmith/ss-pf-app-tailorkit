import { createStore } from '~/libs/external-store'
import { type FEEDBACK_TYPE } from '~/modules/Feedback/constants'

interface FeedbackState {
  [feedbackType: string]: {
    showFeedback: boolean
    callback?: () => void | Promise<void>
  }
}

type FeedbackActionTypes =
  | { type: 'SHOW_FEEDBACK'; payload: { feedbackType: FEEDBACK_TYPE; callback?: () => void | Promise<void> } }
  | { type: 'HIDE_FEEDBACK'; payload: { feedbackType: FEEDBACK_TYPE; callback?: () => void | Promise<void> } }

function feedbackStoreReducer(state: FeedbackState, action: FeedbackActionTypes) {
  const payload = action.payload

  switch (action.type) {
    case 'SHOW_FEEDBACK':
      return {
        ...state,
        [payload.feedbackType]: {
          showFeedback: true,
          callback: payload.callback,
        },
      }
    case 'HIDE_FEEDBACK':
      return {
        ...state,
        [payload.feedbackType]: {
          showFeedback: false,
          callback: payload.callback,
        },
      }
    default:
      return state
  }
}

export const feedbackStore = createStore(feedbackStoreReducer, {})
