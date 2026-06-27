import * as SlackWebApi from '@slack/web-api'
import Shop from '~/models/Shop.server'

const { WebClient } = SlackWebApi

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID
export const TEST_CHANNEL_ID = 'CJ6GPACKC'
export const CORE_TAILORKIT_MEMBERS = '<@U8TU2CQ02> <@U03TPREDM1S> <@U08FH512DUH>'

/**
 * Utilization for send message to channel id
 *
 * @param message string
 * @param channelId string
 * @returns
 */
export const postSlackMessage = async function (message: string, channelId: string) {
  if (!SLACK_BOT_TOKEN) return

  try {
    // Create new webClient instance
    const client = new WebClient(SLACK_BOT_TOKEN)

    // Do post message action
    await client.chat.postMessage({
      token: SLACK_BOT_TOKEN,
      channel: channelId,
      text: message,
      username: 'tailorkit-bot',
      icon_url:
        'https://cdn.shopify.com/app-store/listing_images/958e5ec4440b11eb378c3c27a7a4097d/icon/CKPAh-fW_YYDEAE=.png',
    })
  } catch (error) {
    console.error('❌ Failed to send message to Slack', error)
  }
}

/**
 * Post message to slack channel when installing TailorKit
 *
 * @param shopDomain string
 * @param email string
 * @param shopId string
 */
export const postToSlackChannelWhenInstall = async function (shopDomain: string, email: string, shopId: string) {
  try {
    // Validate shop arguments
    if (!shopDomain || !email || !shopId) {
      throw new Error('Invalid shop config')
    }

    // Create messages
    const storeUrlMess = `Store URL: ${shopDomain}`
    const contactEmailMess = `Contact email: ${email}`
    const partnerStoreMess = `Partner store access: https://partners.shopify.com/2832853/stores/${shopId}`

    const contentPostSlack = `New store: \n • ${storeUrlMess} \n • ${contactEmailMess} \n • ${partnerStoreMess}`

    await postSlackMessage(contentPostSlack, SLACK_CHANNEL_ID || '')
  } catch (error) {
    console.error('❌ Failed to notify to Slack when shop installed', error)
  }
}

/**
 * Post message to slack channel when uninstalling TailorKit
 *
 * @param shopDomain string
 * @param email string
 */
export const postToSlackChannelWhenUninstall = async function (shopDomain: string, email: string) {
  try {
    // Validate shop arguments
    if (!shopDomain || !email) {
      throw new Error('Invalid shop config')
    }

    // Create messages
    const storeUrlMess = `Store URL: ${shopDomain}`
    const contactEmailMess = `Contact email: ${email}`

    // Calculate 0-14 churn rate in the last 30 days
    const res = (
      await Shop.aggregate([
        {
          $group: {
            _id: null,
            createdLast30: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', { $dateSubtract: { startDate: '$$NOW', unit: 'day', amount: 30 } }] },
                  1,
                  0,
                ],
              },
            },
            uninstalledLast30Within14: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$uninstalledAt', { $dateSubtract: { startDate: '$$NOW', unit: 'day', amount: 30 } }] },
                      { $gte: ['$uninstalledAt', '$createdAt'] },
                      {
                        $lte: [{ $dateDiff: { startDate: '$createdAt', endDate: '$uninstalledAt', unit: 'day' } }, 14],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $project: { _id: 0 } },
      ])
    )[0]

    const churnRate = `0-14 day churn rate (last 30 days): ${((res.uninstalledLast30Within14 / res.createdLast30) * 100).toFixed(2)}%`

    const contentPostSlack = `Churned store: \n • ${storeUrlMess} \n • ${contactEmailMess} \n • ${churnRate}`

    await postSlackMessage(contentPostSlack, SLACK_CHANNEL_ID || '')
  } catch (error) {
    console.error('❌ Failed to notify to Slack when shop installed', error)
  }
}

// TODO: Open when data team create an NPS channel for TailorKit
// const SLACK_TAILORKIT_HEALTH_ID = process.env.SLACK_TAILORKIT_HEALTH_ID
// export const postToSlackChannelWhenRatingInApp = async function (
//   shopDomain: string,
//   email: string,
//   rating: number,
//   feedback: string = ''
// ) {
//   try {
//     const contentPostSlack =
// `<@U038VEDB6P7> <@ULMH190BF> \n • User rating ${rating}/5 ⭐️ \n • Store: ${shopDomain} \n • Email: ${email} \n • Feedback: ${feedback}`
//     await postSlackMessage(contentPostSlack, SLACK_TAILORKIT_HEALTH_ID || '')
//   } catch (error) {
//     console.error('❌ Failed to notify to Slack when shop rating in app', error)
//   }
// }
