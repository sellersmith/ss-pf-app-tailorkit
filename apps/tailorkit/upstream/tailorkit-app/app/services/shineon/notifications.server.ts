import { postSlackMessage } from '~/bootstrap/fns/slack.server'

const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || ''

export async function notifyShineOnSubmissionFailed(args: {
  shopDomain: string
  orderId: number
  error: string
  attempts: number
}): Promise<void> {
  try {
    const message = [
      '[ShineOn] Order submission failed',
      ` \u2022 Shop: ${args.shopDomain}`,
      ` \u2022 Order: #${args.orderId}`,
      ` \u2022 Error: ${args.error}`,
      ` \u2022 Attempts: ${args.attempts}`,
    ].join('\n')
    await postSlackMessage(message, SLACK_CHANNEL_ID)
  } catch (error) {
    console.error('Failed to send ShineOn submission failure notification', error)
  }
}

export async function notifyShineOnVariantUnavailable(args: {
  shopDomain: string
  sku: string
  orderId: number
}): Promise<void> {
  try {
    const message = [
      '[ShineOn] SKU discontinued',
      ` \u2022 Shop: ${args.shopDomain}`,
      ` \u2022 SKU: ${args.sku}`,
      ` \u2022 Order: #${args.orderId}`,
      ` \u2022 Action: Variant flagged as unavailable`,
    ].join('\n')
    await postSlackMessage(message, SLACK_CHANNEL_ID)
  } catch (error) {
    console.error('Failed to send ShineOn variant unavailable notification', error)
  }
}

export async function notifyShineOnConnectionLost(args: { shopDomain: string; error: string }): Promise<void> {
  try {
    const message = [
      '[ShineOn] Connection lost',
      ` \u2022 Shop: ${args.shopDomain}`,
      ` \u2022 Error: ${args.error}`,
      ` \u2022 Action: Re-enter API key required`,
    ].join('\n')
    await postSlackMessage(message, SLACK_CHANNEL_ID)
  } catch (error) {
    console.error('Failed to send ShineOn connection lost notification', error)
  }
}
