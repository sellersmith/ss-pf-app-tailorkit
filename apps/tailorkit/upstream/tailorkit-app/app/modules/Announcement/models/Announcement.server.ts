import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { syncAnnouncementsFromGoogleSheet } from '../fns.server'
import type { AnnouncementDocument } from '../types'
import mongoose from 'mongoose'

const AnnouncementSchema = new mongoose.Schema<Omit<AnnouncementDocument, ''>>(
  {
    title: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    content: [String],
    startAt: {
      type: Date,
      index: true,
    },
    endAt: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      index: true,
      required: true,
      enum: ['active', 'inactive'],
    },
    tone: {
      type: String,
      index: true,
      required: true,
      enum: ['success', 'info', 'warning', 'critical'],
    },
  },
  { timestamps: true }
)

const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', AnnouncementSchema)

export default Announcement

/**
 * @description Sync announcements from Google Sheet every start server
 */
export async function runSyncAnnouncementsFromGoogleSheet() {
  try {
    if (!process.env.SYNC_ANNOUNCEMENTS_FROM_GOOGLE_SHEET) {
      await syncAnnouncementsFromGoogleSheet()
      process.env.SYNC_ANNOUNCEMENTS_FROM_GOOGLE_SHEET = 'true'
    }
  } catch (error) {
    console.error(formatErrorMessage(error))
  }
}
