import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import WebVitals, { cleanupOldWebVitalsData, getWebVitalsDBStats } from '~/models/WebVitals.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'

/**
 * GET - Get database statistics
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const stats = await getWebVitalsDBStats()

    return json({
      success: true,
      data: stats,
      message: 'Database statistics retrieved successfully',
    })
  } catch (error) {
    console.error('Error getting Web Vitals database stats:', formatErrorMessage(error))
    return json(
      {
        success: false,
        error: 'Failed to get database statistics',
        details: formatErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Perform cleanup operations
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const body = await request.json()
    const { action, maxAgeDays } = body

    switch (action) {
      case 'cleanup': {
        const maxAge = maxAgeDays || 90

        if (maxAge < 1 || maxAge > 730) {
          return json(
            {
              success: false,
              error: 'Invalid maxAgeDays. Must be between 1 and 730 days',
            },
            { status: 400 }
          )
        }

        console.log(`[WebVitals API] Starting cleanup for records older than ${maxAge} days`)

        const result = await cleanupOldWebVitalsData(maxAge)

        if (result.success) {
          return json({
            success: true,
            data: {
              deletedCount: result.deletedCount,
              cutoffDate: result.cutoffDate,
              maxAgeDays: maxAge,
            },
            message: `Successfully deleted ${result.deletedCount} records older than ${maxAge} days`,
          })
        }
        return json(
          {
            success: false,
            error: 'Cleanup failed',
            details: result.error,
          },
          { status: 500 }
        )
      }

      case 'dry-run': {
        const maxAge = maxAgeDays || 90

        if (maxAge < 1 || maxAge > 730) {
          return json(
            {
              success: false,
              error: 'Invalid maxAgeDays. Must be between 1 and 730 days',
            },
            { status: 400 }
          )
        }

        // Count records that would be deleted
        const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000)

        const countToDelete = await WebVitals.countDocuments({
          timestamp: { $lt: cutoffDate },
        })

        return json({
          success: true,
          data: {
            wouldDeleteCount: countToDelete,
            cutoffDate,
            maxAgeDays: maxAge,
          },
          message: `Dry run: Would delete ${countToDelete} records older than ${maxAge} days`,
        })
      }

      default: {
        return json(
          {
            success: false,
            error: 'Invalid action. Supported actions: cleanup, dry-run',
          },
          { status: 400 }
        )
      }
    }
  } catch (error) {
    console.error('Error in Web Vitals cleanup API:', formatErrorMessage(error))
    return json(
      {
        success: false,
        error: 'Internal server error',
        details: formatErrorMessage(error),
      },
      { status: 500 }
    )
  }
}
