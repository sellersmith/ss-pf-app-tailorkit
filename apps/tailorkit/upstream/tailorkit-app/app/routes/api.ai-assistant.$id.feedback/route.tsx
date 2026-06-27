import type { ActionFunction, ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import ConversationMessage from '~/models/ConversationMessage.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { FeedbackType } from '~/enums/conversationMessage'
export const action: ActionFunction = catchAsync(async ({ params, request }: ActionFunctionArgs) => {
  const {
    session: { shop },
  } = await authenticate.admin(request)

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const { id: messageId } = params
    const { feedback } = await request.json()

    if (!messageId || ![FeedbackType.HELPFUL, FeedbackType.UNHELPFUL, null].includes(feedback)) {
      return json({ error: 'Invalid request body' }, { status: 400 })
    }

    const updatedMessage = await ConversationMessage.updateFeedback(messageId, shop, feedback)

    if (!updatedMessage) {
      return json({ error: 'Message not found' }, { status: 404 })
    }

    return json({ success: true, message: updatedMessage })
  } catch (error) {
    console.error('Error updating message feedback:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})
