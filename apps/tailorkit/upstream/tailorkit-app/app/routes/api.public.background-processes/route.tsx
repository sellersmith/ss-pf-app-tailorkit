import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { CORE_TAILORKIT_MEMBERS, postSlackMessage, TEST_CHANNEL_ID } from '~/bootstrap/fns/slack.server'
import { syncShopUsage } from '~/models/Shop.server'
import { cleanUpEphemeralS3Files } from '~/models/AmazonS3File.server'
import { appName } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import {
  syncBlogPosts,
  syncClipartDocumentation,
  syncDocumentation,
  syncOnboardingProducts,
  syncScenesOfAIMockups,
  syncTutorials,
} from '~/utils/supabase-client.server'
import {
  BACKGROUND_TASK_NAMES,
  logProcessEnd,
  logProcessStart,
  type TaskResult,
} from '~/models/BackgroundProcessLog.server'
import ApiUsageLog from '~/models/ApiUsageLog.server'
import { cleanupOldWebVitalsData } from '~/models/WebVitals.server'
import { syncElvaFeedbackExport } from '~/utils/supabase-elva-feedback-sync.server'
import { syncElvaConversationsExport } from '~/utils/supabase-elva-conversations-sync.server'

const PROCESS_NAME = '[Background process]'

/**
 * Background processes cron endpoint — single entry point for all scheduled,
 * app-wide maintenance work in TailorKit.
 *
 * ## Purpose
 *
 * This loader is invoked by an external cron scheduler (e.g. Cloud Scheduler /
 * cron-job.org) hitting `GET /api/public/background-processes?token=...` once
 * per day. It consolidates everything that needs to happen "for the whole app,
 * not for a specific shop request" into one auditable run:
 *
 * 1. **Billing & usage rollup** — settle metered usage (AI credits, prints,
 *    storage…) for every active shop and, inside the 23:00–00:59 server-time
 *    window, actually charge merchants via Shopify's usage-based billing.
 *    Manual runs with `?force=true` bypass the time window so engineers can
 *    re-trigger billing after an incident.
 * 2. **Content sync from Supabase → app DB** — refresh the local mirror of
 *    Help Center docs, clipart docs, blog posts, tutorials, onboarding
 *    products, and AI mockup scenes so the app serves up-to-date content
 *    without hitting Supabase on every request.
 * 3. **Retention / housekeeping** — delete data older than 90 days that the
 *    app no longer needs and that we don't want to keep paying to store:
 *    - ephemeral S3 files (storefront uploads, generated print images),
 *    - `ApiUsageLog` rows,
 *    - web-vitals telemetry rows.
 * 4. **Audit & observability** — every run is recorded to MongoDB
 *    (`BackgroundProcessLog`, TTL 90 days) with per-task fulfilled/rejected
 *    status, duration, and trigger type, AND mirrored to Slack so on-call can
 *    spot failures without opening the DB.
 *
 * ## Route & auth
 *
 * - Method/path: `GET /api/public/background-processes`
 * - Query `token` (**required**): must equal `process.env.SECRET_TOKEN`. On
 *   mismatch the endpoint posts an "Unauthorized" Slack notice (so abuse is
 *   visible) and returns `401`.
 * - Query `force` (optional): when `"true"`, marks the run as `trigger='manual'`
 *   in the audit log and forwards `forceCharge=true` to `syncShopUsage`,
 *   forcing it to charge regardless of the 23:00–00:59 cron window. Anything
 *   else (or omitted) is treated as a normal cron run (`trigger='cron'`,
 *   `forceCharge=false`).
 *
 * ## Execution model
 *
 * All tasks run **concurrently** via `Promise.allSettled`, so:
 * - One failing task does NOT abort the others — every task gets a chance to
 *   complete, and partial success is the norm.
 * - The order of array entries is contractually aligned with
 *   `BACKGROUND_TASK_NAMES` from `~/models/BackgroundProcessLog.server`. Index
 *   `i` in the `Promise.allSettled` array MUST correspond to
 *   `BACKGROUND_TASK_NAMES[i]`. A length mismatch is logged as drift but does
 *   not throw — adding/removing a task here requires the same change in
 *   `BACKGROUND_TASK_NAMES`.
 *
 * Tasks executed (in declared order):
 * | Idx | Task                          | Effect                                                                 |
 * | --- | ----------------------------- | ---------------------------------------------------------------------- |
 * | 0   | `syncShopUsage(_, forceCharge)` | Per-shop usage rollup; bills via Shopify when in window or forced.   |
 * | 1   | `syncDocumentation()`         | Pull Help Center docs from Supabase into local store.                  |
 * | 2   | `syncClipartDocumentation()`  | Pull clipart-related docs from Supabase.                               |
 * | 3   | `syncBlogPosts()`             | Pull marketing blog posts from Supabase.                               |
 * | 4   | `syncTutorials()`             | Pull tutorial entries from Supabase.                                   |
 * | 5   | `syncOnboardingProducts()`    | Pull curated onboarding products used in the merchant onboarding flow. |
 * | 6   | `syncScenesOfAIMockups()`     | Pull AI-mockup scene catalog from Supabase.                            |
 * | 7   | `cleanUpEphemeralS3Files(90)` | Delete S3 ephemeral uploads older than 90 days.                        |
 * | 8   | `ApiUsageLog.cleanup(90)`     | Delete `ApiUsageLog` rows older than 90 days.                          |
 * | 9   | `cleanupOldWebVitalsData(90)` | Delete web-vitals telemetry older than 90 days.                        |
 * | 10  | `syncElvaFeedbackExport()`    | Elva feedback export → Supabase staging. Gated by hard-coded constant. |
 * | 11  | `syncElvaConversationsExport()` | Elva per-conversation export (14d) → Supabase staging. Same kill switch. |
 *
 * Note: `syncFulfillmentOrder` is intentionally commented out — currently
 * unused. Re-enabling it requires also adding its name to
 * `BACKGROUND_TASK_NAMES` to preserve index alignment.
 *
 * ## Persistence & observability
 *
 * - **MongoDB audit log** (`BackgroundProcessLog`):
 *   - `logProcessStart(trigger)` is called before tasks run; failures here are
 *     swallowed (best-effort) so a logging outage cannot block billing/sync.
 *   - `logProcessEnd(logId, taskResults, undefined, duration)` is called after
 *     tasks settle, recording each task's `{ name, status, error? }`.
 *   - On top-level throw, `logProcessEnd(logId, [], errorMsg)` records the
 *     failure.
 * - **Slack notifications** to `TEST_CHANNEL_ID`:
 *   - `🚀 started` (with `(FORCE MODE)` suffix for manual runs).
 *   - For S3 cleanup specifically: `🧹` when files were deleted, `⚠️` when
 *     some failed, `❌` when the cleanup task itself rejected.
 *   - `🤌 finished in {duration}ms` on success.
 *   - `❌ failed` + `@channel`-style ping of `CORE_TAILORKIT_MEMBERS` on
 *     top-level failure.
 *
 * ## Error handling
 *
 * - Per-task errors → captured via `Promise.allSettled`, surfaced in the
 *   audit log, do NOT propagate.
 * - Top-level exception (e.g. Slack/DB unreachable, programming error in this
 *   file) → caught, logged to DB + Slack with core team tag, returns `500`.
 *
 * ## Operational notes
 *
 * - This endpoint is intentionally `public` (under `routes/api.public.*`)
 *   because the cron caller cannot present a Shopify session; the secret
 *   token is the only auth.
 * - Safe to invoke ad-hoc with `?token=...&force=true` to manually re-run
 *   billing/sync after an incident — duplicate runs are tolerated by all
 *   downstream tasks (sync = upsert, cleanup = idempotent, billing checks
 *   per-shop state before charging).
 *
 * @param args - Remix loader args; only `request` is used (URL parsed for
 *   `token` and `force` query params).
 * @returns JSON response:
 *   - `200 { success: true, message, data: PromiseSettledResult[] }` on success.
 *   - `401 { success: false, error: 'Unauthorized' }` on bad token.
 *   - `500 { success: false, error: 'Failed to execute cronjob', data }` on
 *     top-level failure.
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url)
  const isAuthorized = searchParams.get('token') === process.env.SECRET_TOKEN

  if (!isAuthorized) {
    await postSlackMessage(`🚀 ${PROCESS_NAME}: ${appName} - Unauthorized`, TEST_CHANNEL_ID)

    return json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Determine trigger type for audit log
  const forceCharge = searchParams.get('force') === 'true'
  const trigger = forceCharge ? 'manual' : 'cron'

  // Persist run start to DB (best-effort — don't block process if logging fails)
  let logId: string | null = null
  try {
    logId = await logProcessStart(trigger)
  } catch {
    console.error(`${PROCESS_NAME} Failed to create process log entry`)
  }

  try {
    await postSlackMessage(
      `🚀 ${PROCESS_NAME}: ${appName} started${forceCharge ? ' (FORCE MODE)' : ''}`,
      TEST_CHANNEL_ID
    )
    const startTime = new Date()

    const response = await Promise.allSettled([
      // Pass forceCharge flag - only true when manually triggered with ?force=true
      // Auto cron runs use time window check (23:00-00:59)
      syncShopUsage(undefined, forceCharge),
      // Temporary disable syncFulfillmentOrder because we are not using it for now
      // syncFulfillmentOrder(),
      syncDocumentation(),
      syncClipartDocumentation(),
      syncBlogPosts(),
      syncTutorials(),
      syncOnboardingProducts(),
      syncScenesOfAIMockups(),
      // Clean up ephemeral S3 files older than 90 days (storefront uploads, print images)
      cleanUpEphemeralS3Files(90),
      // Retention cleanup: remove API usage logs older than 90 days
      ApiUsageLog.cleanup(90),
      // Retention cleanup: remove web vitals data older than 90 days
      cleanupOldWebVitalsData(90),
      // Elva auto-improve loop: hourly export of feedback (explicit + implicit)
      // to Supabase staging table for local Claude Code routine consumption.
      // Gated by hard-coded `ELVA_AUTO_IMPROVE_ENABLED` constant inside the helper (skips when false).
      syncElvaFeedbackExport(),
      // Elva conversation-driven discovery loop: daily per-conversation export
      // (14d lookback) → `auto_improve_elva_conversations_export`. Feeds weekly
      // skill that clusters merchant intents into Tier 1 / Tier 2 / KB-gap.
      // Same kill switch as syncElvaFeedbackExport.
      syncElvaConversationsExport(),
    ])

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    // Validate task count alignment (detect drift between BACKGROUND_TASK_NAMES and allSettled)
    if (response.length !== BACKGROUND_TASK_NAMES.length) {
      console.error(
        `${PROCESS_NAME} Task count mismatch: ${response.length} results vs ${BACKGROUND_TASK_NAMES.length} names`
      )
    }

    // Map results to structured task records for persistent logging
    const taskResults: TaskResult[] = response.map((r, i) => ({
      name: BACKGROUND_TASK_NAMES[i] ?? `task-${i}`,
      status: r.status,
      error: r.status === 'rejected' ? formatErrorMessage(r.reason) : undefined,
    }))

    // Persist run completion to DB (best-effort)
    if (logId) {
      try {
        await logProcessEnd(logId, taskResults, undefined, duration)
      } catch {
        console.error(`${PROCESS_NAME} Failed to update process log entry`)
      }
    }

    // Check S3 cleanup result and notify if there were issues
    const s3CleanupIndex = BACKGROUND_TASK_NAMES.indexOf('cleanUpEphemeralS3Files')
    const cleanupResult = response[s3CleanupIndex]
    if (cleanupResult.status === 'fulfilled') {
      const result = cleanupResult.value as
        | {
            success: boolean
            deletedCount: number
            failedCount: number
            error?: string
          }
        | undefined

      if (result && (!result.success || result.failedCount > 0)) {
        await postSlackMessage(
          `⚠️ ${PROCESS_NAME}: S3 Cleanup Issues - ${result.failedCount} files failed to delete${result.error ? `, error: ${result.error}` : ''}`,
          TEST_CHANNEL_ID
        )
      } else if (result && result.deletedCount > 0) {
        await postSlackMessage(
          `🧹 ${PROCESS_NAME}: S3 Cleanup - Deleted ${result.deletedCount} ephemeral files`,
          TEST_CHANNEL_ID
        )
      }
    } else if (cleanupResult.status === 'rejected') {
      await postSlackMessage(`❌ ${PROCESS_NAME}: S3 Cleanup failed - ${cleanupResult.reason}`, TEST_CHANNEL_ID)
    }

    await postSlackMessage(`🤌 ${PROCESS_NAME}: ${appName} finished in ${duration}ms`, TEST_CHANNEL_ID)

    return json({ success: true, message: 'Executed cronjob successfully', data: response })
  } catch (e) {
    // Persist failure to DB (best-effort)
    if (logId) {
      try {
        await logProcessEnd(logId, [], formatErrorMessage(e))
      } catch {
        console.error(`${PROCESS_NAME} Failed to update process log entry on failure`)
      }
    }

    // Tag core members when background process failed
    const errorMessage = `❌ ${PROCESS_NAME}: ${appName} failed \n ${CORE_TAILORKIT_MEMBERS}\n
    Error: ${formatErrorMessage(e)}
    `
    await postSlackMessage(errorMessage, TEST_CHANNEL_ID)
    return json({ success: false, error: 'Failed to execute cronjob', data: e }, { status: 500 })
  }
})
