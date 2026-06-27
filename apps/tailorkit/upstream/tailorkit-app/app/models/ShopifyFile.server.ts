import mongoose from '~/bootstrap/db/connect-db.server'
import Area from './Area.server'
import Asset from './Asset.server'
import Image from './Image.server'
import Mockup from './Mockup.server'
import Provider from './Provider.server'
import Template from './Template.server'
import OptionSet from './OptionSet.server'
import ShopifySession from './ShopifySession.server'
import LayerIntegration from './LayerIntegration.server'
// import { ONE_HOUR_IN_MILLISECONDS } from '~/constants'
import { requestGraphqlApi } from '~/shopify/graphql/fns.server'
import { mutationFileDelete } from '~/shopify/graphql/files/mutation.server'

export enum ShopifyFileType {
  MEDIA_IMAGE = 'MediaImage',
  GENERIC_FILE = 'GenericFile',
  MASK_IMAGE = 'MaskImage',
}

const shopifyFileSchema = new mongoose.Schema(
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
      index: true,
    },
    shopifyId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      default: 'MediaImage',
      enum: ShopifyFileType,
    },
    svgString: {
      type: String,
      required: false,
    },
    // The shop domain that owns the image
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { timestamps: true, strict: false }
)

const ShopifyFile = mongoose.models.ShopifyFile || mongoose.model('ShopifyFile', shopifyFileSchema, 'shopify_files')

export default ShopifyFile

/**
 * Function for cleaning up unused files at Shopify.
 *
 * @param {Date} beforeDate
 *
 * @returns void
 */
export async function cleanUpUnusedFiles(beforeDate?: Date) {
  // Query for unused files
  const unusedFiles = await ShopifyFile.aggregate([
    // Look for files created before the specified date
    {
      $match: {
        type: { $ne: ShopifyFileType.GENERIC_FILE },
        ...(beforeDate && { createdAt: { $lt: beforeDate } }),
      },
    },
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

  // Delete unused files at Shopify
  for (let i = 0; i < unusedFiles.length; i++) {
    const unused = unusedFiles[i]

    // Get shop session
    const session = await ShopifySession.findOne({ shop: unused._id })

    if (session) {
      // Delete unused files at Shopify
      const fileIds = unused.fileIds

      await (async function deleteUnusedFiles() {
        const result = await requestGraphqlApi({
          shopDomain: session.shop,
          query: mutationFileDelete,
          variables: { input: fileIds },
          accessToken: session.accessToken,
        })

        // Verify response
        if (result?.fileDelete?.userErrors?.length) {
          if (result.fileDelete.userErrors[0].message.indexOf('not exist') > -1) {
            const notExist = result.fileDelete.userErrors[0].message.match(/(gid:\/\/shopify\/[^\/]+\/\d+)/g)

            for (let i = 0; i < notExist.length; i++) {
              fileIds.splice(fileIds.indexOf(notExist[i]), 1)
            }

            // Delete file references in database
            await ShopifyFile.deleteMany({ shopifyId: { $in: notExist } })

            // Retry...
            if (fileIds.length) {
              await deleteUnusedFiles()
            }
          } else {
            console.error(result.fileDelete.userErrors)
          }
        } else {
          // Delete file references in database
          await ShopifyFile.deleteMany({ shopifyId: { $in: fileIds } })
        }
      })()
    }
  }
}

// Because we upload layer and option images immediately when creating or editing a
// template before saving, we need to periodically check for unused files and delete
// them at Shopify to prevent reaching the Shopify storage limit. Assuming a template
// creating or editing session is no longer than 1 day, we will check and clean up
// unused files uploaded 1 day ago.
// setInterval(
//   async () => cleanUpUnusedFiles(new Date(Date.now() - 24 * ONE_HOUR_IN_MILLISECONDS)),
//   24 * ONE_HOUR_IN_MILLISECONDS
// )
