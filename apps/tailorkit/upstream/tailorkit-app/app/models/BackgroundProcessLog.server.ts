/**
 * BackgroundProcessLog - Persistent audit log for background process executions.
 *
 * Records each run of the cron-triggered background process with:
 * - trigger type (cron vs manual)
 * - overall status and duration
 * - per-task results (fulfilled/rejected)
 * - auto-cleanup via MongoDB TTL index (90 days)
 */

import mongoose from '~/bootstrap/db/connect-db.server'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'

const RETENTION_DAYS = 90
const RETENTION_SECONDS = (RETENTION_DAYS * ONE_DAY_IN_MILLISECONDS) / 1000

export interface TaskResult {
  name: string
  status: 'fulfilled' | 'rejected'
  error?: string
}

const TaskResultSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: { type: String, enum: ['fulfilled', 'rejected'], required: true },
    error: String,
  },
  { _id: false }
)

const BackgroundProcessLogSchema = new mongoose.Schema(
  {
    trigger: {
      type: String,
      enum: ['cron', 'manual'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    completedAt: Date,
    durationMs: Number,
    tasks: [TaskResultSchema],
    /** Top-level error if process crashed before task execution */
    error: String,
    /** TTL: MongoDB auto-deletes after 90 days */
    expireAt: {
      type: Date,
      default: Date.now,
      expires: RETENTION_SECONDS,
    },
  },
  { timestamps: true }
)

// Descending index on startedAt for querying recent runs
BackgroundProcessLogSchema.index({ startedAt: -1 })

const BackgroundProcessLog
  = mongoose.models.BackgroundProcessLog
  || mongoose.model('BackgroundProcessLog', BackgroundProcessLogSchema, 'background_process_logs')

export default BackgroundProcessLog

/**
 * Task names matching the background process route execution order.
 * Used to label results from Promise.allSettled.
 */
export const BACKGROUND_TASK_NAMES = [
  'syncShopUsage',
  'syncDocumentation',
  'syncClipartDocumentation',
  'syncBlogPosts',
  'syncTutorials',
  'syncOnboardingProducts',
  'syncScenesOfAIMockups',
  'cleanUpEphemeralS3Files',
  'cleanupApiUsageLogs',
  'cleanupWebVitals',
  'syncElvaFeedbackExport',
  'syncElvaConversationsExport',
] as const

/**
 * Create a log entry when a background process starts.
 * Returns the document _id for updating on completion.
 */
export async function logProcessStart(trigger: 'cron' | 'manual'): Promise<string> {
  const doc = await BackgroundProcessLog.create({
    trigger,
    status: 'running',
    startedAt: new Date(),
  })
  return doc._id.toString()
}

/**
 * Update the log entry when a background process finishes.
 * Safe and idempotent — silently no-ops if logId not found.
 */
export async function logProcessEnd(
  logId: string,
  tasks: TaskResult[],
  error?: string,
  durationMs?: number
): Promise<void> {
  await BackgroundProcessLog.findByIdAndUpdate(logId, {
    status: error ? 'failed' : 'completed',
    completedAt: new Date(),
    durationMs,
    tasks,
    error: error || undefined,
  })
}
