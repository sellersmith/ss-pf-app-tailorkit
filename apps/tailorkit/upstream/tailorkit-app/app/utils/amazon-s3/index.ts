import fs from 'fs'
import path from 'path'
import type { PutObjectCommandInput } from '@aws-sdk/client-s3'
import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import mime from 'mime-types'
import { imageSizeFromFile } from 'image-size/fromFile'
import { uuid } from '~/utils/uuid'
import { sanitizeFileName } from '~/utils/file-types'
import AmazonS3File from '~/models/AmazonS3File.server'

let s3: S3Client

export function getAmazonS3Client() {
  const { AWS_REGION = '' } = process.env

  if (!AWS_REGION) {
    throw new Error('AWS_REGION environment variable is required')
  }

  if (!s3) {
    // When running on AWS infrastructure (EC2, ECS, Lambda, etc.)
    // the SDK will automatically discover and use the appropriate credentials
    // from the instance metadata service or environment
    s3 = new S3Client({
      region: AWS_REGION,
      // No explicit credentials - will use default credential chain:
      // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
      // 2. IAM roles for Amazon EC2 instances
      // 3. IAM roles for Amazon ECS tasks
      // 4. Other AWS credential sources
    })
  }

  return s3
}

/**
 * Extract S3 key from CloudFront URL
 * @param url CloudFront URL (e.g., "https://cdn1-tailorkit.ecomate.co/shop.myshopify.com/abc.png")
 * @returns S3 key (e.g., "shop.myshopify.com/abc.png") or null if invalid
 */
export function extractS3KeyFromUrl(url: string): string | null {
  const { CLOUDFRONT_URL } = process.env
  if (!CLOUDFRONT_URL || !url) return null

  const baseUrl = CLOUDFRONT_URL.endsWith('/') ? CLOUDFRONT_URL.slice(0, -1) : CLOUDFRONT_URL

  if (!url.startsWith(baseUrl)) return null

  // Remove base URL and query parameters
  const rawKey = url.replace(`${baseUrl}/`, '')
  return rawKey.split('?')[0]
}

/**
 * Delete a single file from S3
 * @param key S3 object key
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteFileFromS3(key: string): Promise<boolean> {
  if (!key || !process.env.S3_BUCKET_NAME) return false

  try {
    const s3 = getAmazonS3Client()
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      })
    )
    return true
  } catch (err) {
    console.error(`Failed to delete S3 file: ${key}`, err)
    return false
  }
}

/**
 * Delete multiple files from S3 using batch DeleteObjectsCommand
 * Note: For versioned buckets, this creates a delete marker. Files may still be
 * accessible via version ID until bucket lifecycle rules remove old versions.
 * @param keys Array of S3 object keys to delete
 * @returns Object with arrays of deleted and failed keys
 */
export async function deleteFilesFromS3(keys: string[]): Promise<{
  deleted: string[]
  failed: string[]
}> {
  const deleted: string[] = []
  const failed: string[] = []

  if (!keys.length || !process.env.S3_BUCKET_NAME) {
    return { deleted, failed }
  }

  const s3 = getAmazonS3Client()
  const bucketName = process.env.S3_BUCKET_NAME
  const BATCH_SIZE = 1000 // S3 DeleteObjectsCommand max limit

  // Process keys in batches of 1000
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE)

    try {
      const response = await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: batch.map(Key => ({ Key })),
            Quiet: false, // Get detailed response about deleted/failed objects
          },
        })
      )

      // Track successfully deleted objects
      if (response.Deleted) {
        for (const obj of response.Deleted) {
          if (obj.Key) deleted.push(obj.Key)
        }
      }

      // Track failed deletions
      if (response.Errors) {
        for (const err of response.Errors) {
          if (err.Key) {
            console.error(`[S3 Delete] Failed to delete ${err.Key}: ${err.Code} - ${err.Message}`)
            failed.push(err.Key)
          }
        }
      }
    } catch (err) {
      // If batch request fails entirely, mark all keys in batch as failed
      console.error(`[S3 Delete] Batch delete failed:`, err)
      failed.push(...batch)
    }
  }

  return { deleted, failed }
}

export async function uploadFileToAmazonS3(filePath: string, folderName: string) {
  if (!folderName) {
    throw new Error('Folder name is required')
  }

  if (!process.env.S3_BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME environment variable is required')
  }

  // Get Amazon S3 client
  const s3 = getAmazonS3Client()

  // Read file being uploaded
  const fileStream = fs.createReadStream(filePath)
  const baseFileName = path.basename(filePath)
  const fileName = `${folderName}/${baseFileName}`

  // Get the correct content type
  const mimeType = mime.lookup(fileName) || 'application/octet-stream'

  const uploadParams: PutObjectCommandInput = {
    Key: fileName,
    Body: fileStream,
    Bucket: process.env.S3_BUCKET_NAME,
    ContentType: mimeType,
    ContentDisposition: 'inline', // ✅ ensures browser displays instead of downloads
  }

  try {
    const { CLOUDFRONT_URL } = process.env

    const baseUrl
      = CLOUDFRONT_URL?.substring(CLOUDFRONT_URL.length - 1) === '/'
        ? CLOUDFRONT_URL.substring(0, CLOUDFRONT_URL.length - 1)
        : CLOUDFRONT_URL

    await s3.send(new PutObjectCommand(uploadParams))

    return `${baseUrl}/${fileName}`
  } catch (err) {
    console.error('❌ Upload failed:', err)
    throw new Error(`S3 upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

/**
 * Upload print image files to Amazon S3
 * Returns the same format as uploadFilesWithAccessToken for compatibility
 * @param files Array of File objects to upload
 * @param shopDomain Shop domain for folder organization
 * @returns Object with uploadedFiles, errorFiles, and errors
 */
export async function uploadPrintImagesToS3(files: File[], shopDomain: string) {
  const uploadedFiles: {
    fileStatus: string
    alt: string
    __typename: string
    image: { originalSrc: string; width?: number; height?: number }
  }[] = []
  const errorFiles: { name: string; error: string }[] = []
  const errors = ''

  if (!process.env.S3_BUCKET_NAME) {
    return { uploadedFiles, errorFiles, errors: 'S3_BUCKET_NAME environment variable is required' }
  }

  const cacheFolder = path.resolve('./cache')

  if (!fs.existsSync(cacheFolder)) {
    fs.mkdirSync(cacheFolder)
  }

  for (const file of files) {
    try {
      const fileName = sanitizeFileName(file.name)
      const fileId = uuid()
      const prefix = fileId.split('-')[0]
      let filePath = path.resolve(`${cacheFolder}/${prefix}-${fileName}`)
      const mimeType = mime.lookup(filePath)

      if (!mimeType) {
        const defaultExtension = 'png'
        filePath = path.resolve(`${cacheFolder}/${prefix}-${fileName}.${defaultExtension}`)
      }

      // Write file to cache
      fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()))

      // Get image dimensions
      const dimensions = file.type.includes('image') ? await imageSizeFromFile(filePath) : null

      // Upload to S3
      const url = await uploadFileToAmazonS3(filePath, shopDomain)

      // Clean up cache file
      fs.rmSync(filePath)

      if (url) {
        // Track ephemeral file in database for cleanup
        const s3Key = extractS3KeyFromUrl(url)
        if (s3Key) {
          await AmazonS3File.create({
            url,
            name: file.name,
            nameWithoutExtension: file.name.replace(/\.[^/.]+$/, ''),
            shopDomain,
            s3Key,
            ephemeral: true,
          }).catch(err => {
            console.error('Failed to track ephemeral S3 file:', err)
          })
        }

        uploadedFiles.push({
          fileStatus: 'READY',
          alt: file.name,
          __typename: dimensions ? 'MediaImage' : 'GenericFile',
          image: {
            originalSrc: url,
            ...(dimensions && { width: dimensions.width, height: dimensions.height }),
          },
        })
      }
    } catch (err) {
      console.error(`Failed to upload file ${file.name}:`, err)
      errorFiles.push({ name: file.name, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return { uploadedFiles, errorFiles, errors }
}
