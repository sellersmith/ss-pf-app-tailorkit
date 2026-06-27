import mongoose from '~/bootstrap/db/connect-db.server'
import Area from './Area.server'
import Asset from './Asset.server'
import Image from './Image.server'
import Mockup from './Mockup.server'
import Provider from './Provider.server'
import Template from './Template.server'
import OptionSet from './OptionSet.server'
import LayerIntegration from './LayerIntegration.server'
import { deleteFilesFromS3 } from '~/utils/amazon-s3'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'

const amazonS3FileSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      index: true,
    },
    name: {
      type: String,
      index: true,
    },
    nameWithoutExtension: {
      type: String,
    },
    // The shop domain that owns the image
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    // S3 object key for deletion (e.g., "shop-domain.myshopify.com/abc123-image.png")
    s3Key: {
      type: String,
      index: true,
    },
    // Marks files as ephemeral (eligible for automatic cleanup after retention period)
    // Ephemeral files: storefront uploads (buyer images, AI-generated), print images
    // Non-ephemeral files: template previews, mockups, assets, provider logos
    ephemeral: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true, strict: false }
)

// Compound index for efficient ephemeral file cleanup queries
amazonS3FileSchema.index({ ephemeral: 1, createdAt: 1 })

const AmazonS3File
  = mongoose.models.AmazonS3File || mongoose.model('AmazonS3File', amazonS3FileSchema, 'amazon_s3_files')

export default AmazonS3File

/**
 * Function for cleaning up unused files at Shopify.
 *
 * @param {Date} beforeDate
 *
 * @returns void
 */
export async function cleanUpUnusedFiles(beforeDate?: Date) {
  // Query for unused files
  const unusedFiles = await AmazonS3File.aggregate([
    // Look for files created before the specified date
    ...(beforeDate
      ? [
          {
            $match: {
              createdAt: { $lt: beforeDate },
            },
          },
        ]
      : []),
    // Look for file usage in print areas
    {
      $lookup: {
        from: Area.collection.collectionName,
        localField: 'url',
        foreignField: 'previewMedia.originalSrc',
        as: 'areaPreviewMedia',
      },
    },
    {
      $lookup: {
        from: Area.collection.collectionName,
        localField: 'url',
        foreignField: 'mediaConfig.media.originalSrc',
        as: 'areaMediaConfig',
      },
    },
    // Look for file usage in asset libraries
    {
      $lookup: {
        from: Asset.collection.collectionName,
        localField: 'url',
        foreignField: 'previewUrl',
        as: 'assetPreviewUrl',
      },
    },
    // Look for file usage in layer images
    {
      $lookup: {
        from: Image.collection.collectionName,
        localField: 'url',
        foreignField: 'src',
        as: 'imageSrc',
      },
    },
    // Look for file usage in layer integrations
    {
      $lookup: {
        from: LayerIntegration.collection.collectionName,
        localField: 'url',
        foreignField: 'data.src',
        as: 'layerIntegrationDataSrc',
      },
    },
    // Look for file usage in mockups
    {
      $lookup: {
        from: Mockup.collection.collectionName,
        localField: 'url',
        foreignField: 'baseImage.url',
        as: 'mockupBaseImageUrl',
      },
    },
    {
      $lookup: {
        from: Mockup.collection.collectionName,
        localField: 'url',
        foreignField: 'backgroundImage.url',
        as: 'mockupBackgroundImageUrl',
      },
    },
    // Look for file usage in option sets
    {
      $lookup: {
        from: OptionSet.collection.collectionName,
        localField: 'url',
        foreignField: 'data.files.src',
        as: 'optionSetDataFilesSrc',
      },
    },
    {
      $lookup: {
        from: OptionSet.collection.collectionName,
        localField: 'url',
        foreignField: 'data.values.thumbnail',
        as: 'optionSetDataValuesThumbnail',
      },
    },
    {
      $lookup: {
        from: OptionSet.collection.collectionName,
        localField: 'url',
        foreignField: 'data.multi_layout.layouts.thumbnail',
        as: 'optionSetDataMultiLayoutLayoutsThumbnail',
      },
    },
    // Look for file usage in fulfillment providers
    {
      $lookup: {
        from: Provider.collection.collectionName,
        localField: 'url',
        foreignField: 'logoUrl',
        as: 'providerLogoUrl',
      },
    },
    // Look for file usage in templates
    {
      $lookup: {
        from: Template.collection.collectionName,
        localField: 'url',
        foreignField: 'previewUrl',
        as: 'templatePreviewUrl',
      },
    },
    // Select only files that are unused
    {
      $match: {
        'imageSrc.0': { $exists: false },
        'areaMediaConfig.0': { $exists: false },
        'assetPreviewUrl.0': { $exists: false },
        'providerLogoUrl.0': { $exists: false },
        'areaPreviewMedia.0': { $exists: false },
        'mockupBaseImageUrl.0': { $exists: false },
        'templatePreviewUrl.0': { $exists: false },
        'optionSetDataFilesSrc.0': { $exists: false },
        'layerIntegrationDataSrc.0': { $exists: false },
        'mockupBackgroundImageUrl.0': { $exists: false },
        'optionSetDataValuesThumbnail.0': { $exists: false },
        'productOnlineStorePreviewUrl.0': { $exists: false },
        'optionSetDataMultiLayoutLayoutsThumbnail.0': { $exists: false },
      },
    },
    // Group files by shop domain
    {
      $group: {
        _id: '$shopDomain',
        fileIds: {
          $addToSet: '$shopifyId',
        },
      },
    },
  ]).exec()

  // TODO: Delete unused files at Amazon S3
  for (let i = 0; i < unusedFiles.length; i++) {
    console.log(unusedFiles[i])
  }
}

// Because we upload layer and option images immediately when creating or editing a template
// before saving, we need to periodically check for unused files and delete them at Amazon
// S3 to save storage. Assuming a template creating or editing session is no longer than 6
// hours, we will check and clean up unused files uploaded 6 hours ago.
// setInterval(
//   async () => cleanUpUnusedFiles(new Date(Date.now() - 6 * ONE_HOUR_IN_MILLISECONDS)),
//   6 * ONE_HOUR_IN_MILLISECONDS
// )

/**
 * Clean up ephemeral S3 files older than the specified retention period.
 * Ephemeral files include storefront uploads (buyer images, AI-generated) and print images.
 * Processes files in batches to prevent memory issues with large datasets.
 *
 * @param maxAgeDays Maximum age in days before files are deleted (default: 90)
 * @returns Cleanup result with success status and counts
 */
export async function cleanUpEphemeralS3Files(maxAgeDays = 90): Promise<{
  success: boolean
  deletedCount: number
  failedCount: number
  cutoffDate: Date
  error?: string
}> {
  const cutoffDate = new Date(Date.now() - maxAgeDays * ONE_DAY_IN_MILLISECONDS)
  const BATCH_SIZE = 1000 // Process files in batches to prevent memory issues

  console.log(`[S3 Cleanup] Starting cleanup of ephemeral files older than ${maxAgeDays} days`)
  console.log(`[S3 Cleanup] Cutoff date: ${cutoffDate.toISOString()}`)

  let totalDeleted = 0
  let totalFailed = 0

  try {
    // Process files in batches to prevent memory issues
    while (true) {
      // Find ephemeral files older than cutoff date (batch by batch)
      const oldFiles = await AmazonS3File.find({
        ephemeral: true,
        createdAt: { $lt: cutoffDate },
      })
        .limit(BATCH_SIZE)
        .select('_id s3Key url shopDomain')
        .lean()

      if (oldFiles.length === 0) {
        break // No more files to process
      }

      console.log(`[S3 Cleanup] Processing batch of ${oldFiles.length} ephemeral files`)

      // Extract S3 keys (filter out any null/undefined keys)
      const s3Keys = oldFiles.map(file => file.s3Key).filter((key): key is string => !!key)

      // Delete from S3 in batches
      const { deleted, failed } = await deleteFilesFromS3(s3Keys)

      console.log(`[S3 Cleanup] Deleted ${deleted.length} files from S3, ${failed.length} failed`)

      // Delete successfully removed files from MongoDB
      const deletedS3Keys = new Set(deleted)
      const fileIdsToDelete = oldFiles.filter(file => file.s3Key && deletedS3Keys.has(file.s3Key)).map(file => file._id)

      if (fileIdsToDelete.length > 0) {
        await AmazonS3File.deleteMany({ _id: { $in: fileIdsToDelete } })
        console.log(`[S3 Cleanup] Removed ${fileIdsToDelete.length} records from database`)
      }

      totalDeleted += deleted.length
      totalFailed += failed.length

      // If we got fewer files than batch size, we're done
      if (oldFiles.length < BATCH_SIZE) {
        break
      }
    }

    console.log(`[S3 Cleanup] Completed. Total deleted: ${totalDeleted}, Total failed: ${totalFailed}`)

    return {
      success: true,
      deletedCount: totalDeleted,
      failedCount: totalFailed,
      cutoffDate,
    }
  } catch (error) {
    console.error('[S3 Cleanup] Error during cleanup:', error)
    return {
      success: false,
      deletedCount: totalDeleted,
      failedCount: totalFailed,
      cutoffDate,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
