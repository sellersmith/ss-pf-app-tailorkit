import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { getApiLogger } from '~/services/ApiLogger.server'
import { initializeLoggerWithEnv } from '~/libs/openai/logger.config.server'
import { json } from '~/bootstrap/fns/fetch.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const { searchParams } = url
  const isAuthorized = searchParams.get('token') === process.env.SECRET_TOKEN

  if (!isAuthorized) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const action = searchParams.get('action') || 'summary'
  const userId = searchParams.get('userId')
  const shopDomain = searchParams.get('shopDomain')
  const days = parseInt(searchParams.get('days') || '30')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  // Initialize logger if needed
  const logger = getApiLogger() || initializeLoggerWithEnv(shopDomain || undefined)

  try {
    switch (action) {
      case 'summary': {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        const [costSummary, recentLogs, quota, dailyStats] = await Promise.all([
          logger.getCostSummary({
            userId: userId || undefined,
            shopDomain: shopDomain || undefined,
            startDate,
            endDate,
          }),
          logger.getRecentLogs({
            userId: userId || undefined,
            shopDomain: shopDomain || undefined,
            limit: 10,
            page: 1,
          }),
          userId ? logger.getUserQuota(userId, shopDomain || undefined) : null,
          logger.getUserUsageStats(userId || '', shopDomain || undefined, days),
        ])

        return json({
          success: true,
          data: {
            costSummary,
            recentLogs: recentLogs.logs,
            quota,
            dailyStats,
            period: {
              days,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
          },
        })
      }

      case 'logs': {
        const startDate = url.searchParams.get('startDate')
        const endDate = url.searchParams.get('endDate')
        const status = url.searchParams.get('status')
        const model = url.searchParams.get('model')

        const logs = await logger.getRecentLogs({
          userId: userId || undefined,
          shopDomain: shopDomain || undefined,
          status: status || undefined,
          model: model || undefined,
          limit,
          page,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        })

        return json({
          success: true,
          data: logs,
        })
      }

      case 'quota': {
        if (!userId) {
          return json({ success: false, error: 'userId is required for quota information' }, { status: 400 })
        }

        const quota = await logger.getUserQuota(userId, shopDomain || undefined)
        return json({
          success: true,
          data: quota,
        })
      }

      case 'stats': {
        const dailyStats = await logger.getUserUsageStats(userId || '', shopDomain || undefined, days)

        return json({
          success: true,
          data: dailyStats,
        })
      }

      case 'cost-breakdown': {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        const costSummary = await logger.getCostSummary({
          userId: userId || undefined,
          shopDomain: shopDomain || undefined,
          startDate,
          endDate,
        })

        return json({
          success: true,
          data: {
            summary: costSummary,
            period: {
              days,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
          },
        })
      }

      default:
        return json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('API Usage Analytics Error:', error)
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url)
  const { searchParams } = url
  const isAuthorized = searchParams.get('token') === process.env.SECRET_TOKEN

  if (!isAuthorized) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const action = formData.get('action')?.toString()
  const userId = formData.get('userId')?.toString()
  const shopDomain = formData.get('shopDomain')?.toString()

  const logger = getApiLogger() || initializeLoggerWithEnv(shopDomain || undefined)

  try {
    switch (action) {
      case 'update-quota': {
        if (!userId) {
          return json({ success: false, error: 'userId is required' }, { status: 400 })
        }

        const dailyRequestLimit = parseInt(formData.get('dailyRequestLimit')?.toString() || '0')
        const dailyTokenLimit = parseInt(formData.get('dailyTokenLimit')?.toString() || '0')
        const dailyCostLimit = parseFloat(formData.get('dailyCostLimit')?.toString() || '0')

        const updatedQuota = await logger.updateUserQuota({
          userId,
          shopDomain: shopDomain || undefined,
          dailyRequestLimit: dailyRequestLimit || undefined,
          dailyTokenLimit: dailyTokenLimit || undefined,
          dailyCostLimit: dailyCostLimit || undefined,
        })

        return json({
          success: true,
          data: updatedQuota,
        })
      }

      case 'cleanup': {
        const daysToKeep = parseInt(formData.get('daysToKeep')?.toString() || '90')
        const result = await logger.cleanup(daysToKeep)

        return json({
          success: true,
          data: result,
          message: `Cleaned up logs older than ${daysToKeep} days`,
        })
      }

      default:
        return json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('API Usage Action Error:', error)
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}
