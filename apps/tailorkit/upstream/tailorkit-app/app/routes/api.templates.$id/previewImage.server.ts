import os from 'os'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'
import sharp from 'sharp'
import { uuid } from '~/utils/uuid'
import { uploadFileToAmazonS3, deleteFileFromS3 } from '~/utils/amazon-s3'
import { analyzeTemplateContent } from './fns.server'
import type { Template as TemplateDocument } from '~/types/psd'

/**
 * Return base CDN URL without trailing slash.
 */
export function getCdnBaseUrl() {
  const { CLOUDFRONT_URL } = process.env
  if (!CLOUDFRONT_URL) throw new Error('CLOUDFRONT_URL env is missing')
  return CLOUDFRONT_URL.endsWith('/') ? CLOUDFRONT_URL.slice(0, -1) : CLOUDFRONT_URL
}

/**
 * Build preview URL and provide async background uploader.
 * The caller should set templateData.previewUrl to the returned cdnUrl
 * and invoke uploadTask(previousTemplate) AFTER saveTemplate completes.
 */
export function preparePreviewUpload(previewFile: File, shopDomain: string, cdnBaseUrl: string) {
  const mimeType = previewFile.type || 'image/webp'
  const ext = mime.extension(mimeType) || 'webp'
  const uniqueId = uuid()

  const fileName = `${uniqueId}.${ext}`
  const objectKey = `${shopDomain}/${fileName}`
  // Append version to signal presence of small variant (_w400)
  const cdnUrl = `${cdnBaseUrl}/${objectKey}?v=3`

  const uploadTask = async (previousTemplate: TemplateDocument) => {
    try {
      const arrayBuffer = await previewFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Generate and upload a 400px max-size (fit inside) small variant to reduce list rendering cost
      try {
        const smallSuffix = '_w400'
        const extWithDot = `.${ext}`
        const smallFileName = `${uniqueId}${smallSuffix}${extWithDot}`
        const smallTmpPath = path.join(os.tmpdir(), smallFileName)

        const smallBuffer = await sharp(buffer)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .toFormat(ext as any)
          .toBuffer()

        // Upload small preview image
        await fs.promises.writeFile(smallTmpPath, smallBuffer)
        await uploadFileToAmazonS3(smallTmpPath, shopDomain)
        await fs.promises.unlink(smallTmpPath).catch(() => {})
      } catch (resizeErr) {
        // Non-fatal: if resize fails, continue with original upload only
        console.error('Failed to generate/upload small preview variant', resizeErr)
      }

      async function asyncUploadMainImage() {
        // Upload original preview image
        const tmpPath = path.join(os.tmpdir(), fileName)
        await fs.promises.writeFile(tmpPath, buffer)
        try {
          await uploadFileToAmazonS3(tmpPath, shopDomain)
        } finally {
          await fs.promises.unlink(tmpPath).catch(() => {})
        }

        // Delete old preview if different
        const previousPreviewUrl = previousTemplate?.previewUrl
        const storeAssetDomain = process.env.STORE_ASSET_DOMAIN || ''

        // Prevent deleting old preview if this cdnBaseUrl is from the store asset domain
        const isStoreAssetDomain = shopDomain === storeAssetDomain
        const isUrlFromStoreAssetDomain = [cdnBaseUrl, previousPreviewUrl].some(url => url.includes(storeAssetDomain))
        const isDifferentPreviewUrl = previousPreviewUrl && previousPreviewUrl !== cdnUrl

        // Only delete old preview if it's not the store asset domain
        if (previousPreviewUrl && isDifferentPreviewUrl && !isStoreAssetDomain && !isUrlFromStoreAssetDomain) {
          // Strip CDN base and any query parameters from old URL to get S3 key
          const rawOldKey = previousPreviewUrl.replace(`${cdnBaseUrl}/`, '')
          const oldKey = rawOldKey.split('?')[0]

          // Delete original old preview
          await deleteFileFromS3(oldKey)

          // Attempt to delete small variants (v2: _w200, v3: _w400)
          const lastDot = oldKey.lastIndexOf('.')
          if (lastDot > -1) {
            const variantsToDelete = ['_w200', '_w400']
            for (const suffix of variantsToDelete) {
              const smallOldKey = `${oldKey.slice(0, lastDot)}${suffix}${oldKey.slice(lastDot)}`
              await deleteFileFromS3(smallOldKey).catch(() => {})
            }
          }
        }

        // Analyze new image content
        analyzeTemplateContent(cdnUrl, previousTemplate).catch(() => {})
      }

      // We run this in background to avoid blocking the main thread
      asyncUploadMainImage().catch(() => {})
    } catch (err) {
      console.error('Preview image background task failed', err)
    }
  }

  return { cdnUrl, uploadTask }
}

/**
 * Build thumbnail URL and provide async background uploader.
 * Similar to preparePreviewUpload but for thumbnails (canvas + preview product image).
 * The caller should set templateData.thumbnailUrl to the returned cdnUrl
 * and invoke uploadTask(previousTemplate) AFTER saveTemplate completes.
 */
export function prepareThumbnailUpload(thumbnailFile: File, shopDomain: string, cdnBaseUrl: string) {
  const mimeType = thumbnailFile.type || 'image/webp'
  const ext = mime.extension(mimeType) || 'webp'
  const uniqueId = uuid()

  const fileName = `${uniqueId}.${ext}`
  const objectKey = `${shopDomain}/${fileName}`
  // Append version to signal presence of small variant (_w400)
  const cdnUrl = `${cdnBaseUrl}/${objectKey}?v=3`

  const uploadTask = async (previousTemplate: TemplateDocument) => {
    try {
      const arrayBuffer = await thumbnailFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Generate and upload a 400px max-size (fit inside) small variant to reduce list rendering cost
      try {
        const smallSuffix = '_w400'
        const extWithDot = `.${ext}`
        const smallFileName = `${uniqueId}${smallSuffix}${extWithDot}`
        const smallTmpPath = path.join(os.tmpdir(), smallFileName)

        const smallBuffer = await sharp(buffer)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .toFormat(ext as any)
          .toBuffer()

        // Upload small thumbnail image
        await fs.promises.writeFile(smallTmpPath, smallBuffer)
        await uploadFileToAmazonS3(smallTmpPath, shopDomain)
        await fs.promises.unlink(smallTmpPath).catch(() => {})
      } catch (resizeErr) {
        // Non-fatal: if resize fails, continue with original upload only
        console.error('Failed to generate/upload small thumbnail variant', resizeErr)
      }

      async function asyncUploadMainImage() {
        // Upload original thumbnail image
        const tmpPath = path.join(os.tmpdir(), fileName)
        await fs.promises.writeFile(tmpPath, buffer)
        try {
          await uploadFileToAmazonS3(tmpPath, shopDomain)
        } finally {
          await fs.promises.unlink(tmpPath).catch(() => {})
        }

        // Delete old thumbnail if different
        const previousThumbnailUrl = previousTemplate?.thumbnailUrl
        const storeAssetDomain = process.env.STORE_ASSET_DOMAIN || ''

        // Prevent deleting old thumbnail if this cdnBaseUrl is from the store asset domain
        const isStoreAssetDomain = shopDomain === storeAssetDomain
        const isUrlFromStoreAssetDomain = [cdnBaseUrl, previousThumbnailUrl].some(url => url.includes(storeAssetDomain))
        const isDifferentThumbnailUrl = previousThumbnailUrl && previousThumbnailUrl !== cdnUrl

        // Only delete old thumbnail if it's not the store asset domain
        if (previousThumbnailUrl && isDifferentThumbnailUrl && !isStoreAssetDomain && !isUrlFromStoreAssetDomain) {
          // Strip CDN base and any query parameters from old URL to get S3 key
          const rawOldKey = previousThumbnailUrl.replace(`${cdnBaseUrl}/`, '')
          const oldKey = rawOldKey.split('?')[0]

          // Delete original old thumbnail
          await deleteFileFromS3(oldKey)

          // Attempt to delete small variants (v2: _w200, v3: _w400)
          const lastDot = oldKey.lastIndexOf('.')
          if (lastDot > -1) {
            const variantsToDelete = ['_w200', '_w400']
            for (const suffix of variantsToDelete) {
              const smallOldKey = `${oldKey.slice(0, lastDot)}${suffix}${oldKey.slice(lastDot)}`
              await deleteFileFromS3(smallOldKey).catch(() => {})
            }
          }
        }
      }

      // We run this in background to avoid blocking the main thread
      asyncUploadMainImage().catch(() => {})
    } catch (err) {
      console.error('Thumbnail image background task failed', err)
    }
  }

  return { cdnUrl, uploadTask }
}
