import { verifyResponse, type ShopifyApiClient } from '../api.server'
import ShopifyFile, { ShopifyFileType } from '~/models/ShopifyFile.server'
import { requestGraphqlApi } from '../fns.server'
import { mutationFileCreate, mutationStagedUploadsCreate } from './mutation.server'
import { queryForFileByIds } from './query.server'
import { duplicateLabel } from '~/utils/duplicateLabel'
import { ALLOWED_FONT_EXTENSIONS } from '~/constants/dropzone'
import { convertFontFileToSVG } from '~/utils/convertFontFileToSVG'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { getFileNameWithoutExtension, sanitizeFileName } from '~/utils/file-types'
import type { TFileToUpload } from './types'
import fs from 'fs'
import path from 'path'
import { imageSizeFromFile } from 'image-size/fromFile'
import { imageSize } from 'image-size'
import { uploadFileToAmazonS3, extractS3KeyFromUrl } from '~/utils/amazon-s3'
import AmazonS3File from '~/models/AmazonS3File.server'
import { uuid } from '~/utils/uuid'
import mime from 'mime-types'
import { sleep } from '~/utils/sleep'
import { ONE_MINUTE_IN_MILLISECONDS, ONE_SECOND_IN_MILLISECONDS } from '~/constants'

const POLLING_CONFIG = {
  MAX_TIMEOUT_MS: ONE_MINUTE_IN_MILLISECONDS, // 5 minutes total timeout
  DELAY_BETWEEN_POLLS_MS: ONE_SECOND_IN_MILLISECONDS, // 1 second between polls
  MAX_ITERATIONS: 30, // Maximum 30 polling attempts
}

export const getImageSizeFromUrl = async (imageUrl: string) => {
  try {
    const response = await fetch(imageUrl)
    const buffer = await response.arrayBuffer()

    return imageSize(new Uint8Array(buffer))
  } catch (e) {
    console.error('Failed to get image size from url', formatErrorMessage(e))
    return null
  }
}

export const prepareFiles = (files: (File | TFileToUpload)[]) =>
  files
    .map(
      file =>
        file instanceof File && {
          filename: file.name,
          mimeType: file.type,
          resource: file.type.includes('image') ? 'IMAGE' : 'FILE',
          fileSize: file.size.toString(),
          httpMethod: 'POST',
        }
    )
    .filter(Boolean)

export const prepareFilesToCreate = (stagedTargets: any, files: any, alts: string[]) =>
  stagedTargets.map((stagedTarget: any, index: number) => {
    return {
      originalSource: stagedTarget.resourceUrl,
      contentType: files[index].type.includes('image') ? 'IMAGE' : 'FILE',
      filename: files[index].name,
      alt: alts[index],
    }
  })

/**
 * Upload files to Shopify or Amazon S3
 * @param args - The arguments for the uploadFiles function
 * @param args.api - The Shopify API client
 * @param args.files - The files to upload
 * @param args.shopDomain - The shop domain
 * @param args.privateUpload - Whether to upload to Shopify or Amazon S3
 * @param args.fileUploadType - The type of file upload
 * @param args.ephemeral - Whether to mark the files as ephemeral
 * @returns The uploaded files
 */
export const uploadFiles = async (args: {
  api: ShopifyApiClient
  files: (File | TFileToUpload)[]
  shopDomain: string
  privateUpload?: boolean
  fileUploadType?: string
  ephemeral?: boolean
}) => {
  const { api, files, shopDomain, privateUpload = false, fileUploadType, ephemeral = false } = args
  const isUploadingMasks = fileUploadType === 'masks'

  let errors: string = ''
  const errorFiles: any = []
  const uploadedFiles: any = []

  // Save files to local storage first
  for (const file of files) {
    if (!(file instanceof File)) {
      const dimensions = await getImageSizeFromUrl(file.originalSource)
      uploadedFiles.push({
        fileStatus: 'READY',
        alt: file.alt || file.filename,
        __typename: isUploadingMasks ? ShopifyFileType.MASK_IMAGE : dimensions ? 'MediaImage' : 'GenericFile',
        ...(dimensions
          ? {
              image: {
                originalSrc: file.originalSource,
                width: dimensions!.width,
                height: dimensions!.height,
              },
            }
          : {
              image: {
                originalSrc: file.originalSource,
              },
            }),
      })
      continue
    }

    const cacheFolder = path.resolve('./cache')

    if (!fs.existsSync(cacheFolder)) {
      fs.mkdirSync(cacheFolder)
    }

    // Sanitize file name, AWS S3 does not automatically sanitize file name
    const fileName = sanitizeFileName(file.name)

    const fileId = uuid()
    const prefix = fileId.split('-')[0]
    let filePath = path.resolve(`${cacheFolder}/${prefix}-${fileName}`)
    const mimeType = mime.lookup(filePath)

    if (!mimeType) {
      const defaultExtension = 'png'
      filePath = path.resolve(`${cacheFolder}/${prefix}-${fileName}.${defaultExtension}`)
    }

    fs.writeFileSync(filePath, Buffer.from(await (file as File).arrayBuffer()))

    // Check if either file size is greater than 20MB or image resolution is greater than 20MP
    const isSizeGreaterThan20MB = (file as File).size > 20 * 1024 * 1024
    const dimensions = (file as File).type.includes('image') && (await imageSizeFromFile(filePath))
    const isResolutionGreaterThan20MP = dimensions && dimensions.width * dimensions.height > 20 * 1000 * 1000

    // Upload to Amazon S3 instead of Shopify if either file size is
    // greater than 20MB or image resolution is greater than 20MP.
    if (isSizeGreaterThan20MB || isResolutionGreaterThan20MP || privateUpload) {
      const folderName = privateUpload ? `em-public` : shopDomain
      const url = await uploadFileToAmazonS3(filePath, folderName)

      if (url) {
        // Track ephemeral files in database for cleanup
        if (ephemeral && !privateUpload) {
          const s3Key = extractS3KeyFromUrl(url)

          if (s3Key) {
            await AmazonS3File.create({
              url,
              name: fileName,
              nameWithoutExtension: getFileNameWithoutExtension(fileName),
              shopDomain,
              s3Key,
              ephemeral: true,
            }).catch(err => {
              console.error('Failed to track ephemeral S3 file:', err)
            })
          }
        }

        uploadedFiles.push({
          fileStatus: 'READY',
          alt: fileName,
          __typename: isUploadingMasks ? ShopifyFileType.MASK_IMAGE : dimensions ? 'MediaImage' : 'GenericFile',
          ...(dimensions
            ? {
                image: {
                  originalSrc: url,
                  width: dimensions!.width,
                  height: dimensions!.height,
                },
              }
            : {
                image: {
                  originalSrc: url,
                },
              }),
        })
      }
    }

    // Delete the cached image file
    fs.rmSync(filePath)
  }

  if (privateUpload) {
    return { uploadedFiles, errorFiles, errors }
  }

  try {
    const preparedFiles = prepareFiles(files) as any[]
    let result = preparedFiles.length
      ? await api.createStagedUploads(preparedFiles).catch(console.error)
      : { stagedTargets: [] }

    const filesInstanceFilesToUpload = []
    const filesFromUrlToUpload = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (file instanceof File) {
        const formData = new FormData()
        const url = result.stagedTargets[i].url
        const params = result.stagedTargets[i].parameters

        params.forEach((param: { name: string; value: any }) => {
          formData.append(param.name, param.value)
        })

        formData.append('file', file)

        await fetch(url, { method: 'POST', body: formData, mode: 'no-cors' })

        filesInstanceFilesToUpload.push(file)
      } else {
        filesFromUrlToUpload.push(file)
      }
    }

    const _filesInstanceFilesToUpload = prepareFilesToCreate(result.stagedTargets, filesInstanceFilesToUpload, [
      ...filesInstanceFilesToUpload.map(file => file.name),
    ])

    const filesToUpload = [..._filesInstanceFilesToUpload, ...filesFromUrlToUpload]
    result = await api.createFile(filesToUpload)

    let uploadingFiles = result.files
    const pollingStartTime = Date.now()
    let pollingIterations = 0

    while (uploadingFiles.length) {
      // Check timeout
      const elapsedTime = Date.now() - pollingStartTime
      if (elapsedTime >= POLLING_CONFIG.MAX_TIMEOUT_MS) {
        const pendingIds = uploadingFiles.map((f: any) => f.id).join(', ')
        throw new Error(
          `Shopify file upload timed out after ${POLLING_CONFIG.MAX_TIMEOUT_MS / 1000}s. Pending files: ${pendingIds}`
        )
      }

      // Check max iterations
      if (pollingIterations >= POLLING_CONFIG.MAX_ITERATIONS) {
        const pendingIds = uploadingFiles.map((f: any) => f.id).join(', ')
        throw new Error(
          `Shopify file upload exceeded maximum ${POLLING_CONFIG.MAX_ITERATIONS} polling attempts. Pending files: ${pendingIds}`
        )
      }

      const filesStatus = await api.getFileByIds(uploadingFiles.map((f: any) => f.id))
      // eslint-disable-next-line no-loop-func
      filesStatus.forEach((file: any) => {
        if (file.fileStatus === 'READY' || file.fileErrors?.length) {
          uploadingFiles = uploadingFiles.filter((f: any) => f.id !== file.id)

          if (file.fileStatus === 'READY') {
            uploadedFiles.push({ ...file, __typename: isUploadingMasks ? ShopifyFileType.MASK_IMAGE : file.__typename })
          } else {
            errorFiles.push(file)
          }
        }
      })

      // Add delay between polls to avoid hammering the API
      if (uploadingFiles.length) {
        await sleep(POLLING_CONFIG.DELAY_BETWEEN_POLLS_MS)
      }

      pollingIterations++
    }

    // Save uploaded files info to app database for later reference if needed
    for (const file of uploadedFiles) {
      const name = file.alt
      let nameWithoutExtension = getFileNameWithoutExtension(name)

      const existingFiles = await ShopifyFile.find({
        shopDomain,
        nameWithoutExtension: { $regex: nameWithoutExtension, $options: 'i' },
      })

      // Rename the file name if it already exists
      if (existingFiles) {
        const newName = duplicateLabel(
          nameWithoutExtension,
          existingFiles.map((f: any) => ({ label: f.nameWithoutExtension }))
        )

        nameWithoutExtension = newName
      }

      // Check if the file is a font file
      const isFontFile = ALLOWED_FONT_EXTENSIONS.includes(`.${name.split('.').pop()}` || '')

      const url = file.image?.originalSrc || file.url

      let svgString = ''
      if (isFontFile) {
        try {
          const fontFile = await convertFontFileToSVG(url, nameWithoutExtension, { fontSize: 12 })

          svgString = fontFile
        } catch (e) {
          console.error(formatErrorMessage(e))
        }
      }

      const updater = {
        name,
        shopDomain,
        url,
        nameWithoutExtension,
        type: file.__typename,
        svgString,
      }

      await ShopifyFile.updateOne({ shopifyId: file.id }, updater, { upsert: true })
    }
  } catch (e) {
    errors = e as string
    console.error('Failed to upload images', formatErrorMessage(e))
  }

  return { uploadedFiles, errorFiles, errors }
}

// TODO: Write a mechanism to use graphql like admin method to avoid duplicating code
export const uploadFilesWithAccessToken = async (accessToken: string, files: File[], shopDomain: string) => {
  let errors: string = ''
  const errorFiles: any = []
  const uploadedFiles: any = []

  try {
    const preparedFiles = prepareFiles(files)

    let result = await verifyResponse(
      await requestGraphqlApi({
        query: mutationStagedUploadsCreate,
        variables: { input: preparedFiles },
        shopDomain,
        accessToken,
      }),
      'stagedUploadsCreate'
    )

    for (let i = 0; i < files.length; i++) {
      const formData = new FormData()
      const url = result.stagedTargets[i].url
      const params = result.stagedTargets[i].parameters

      params.forEach((param: { name: string; value: any }) => {
        formData.append(param.name, param.value)
      })

      formData.append('file', files[i])

      await fetch(url, { method: 'POST', body: formData, mode: 'no-cors' })
    }

    result = await verifyResponse(
      await requestGraphqlApi({
        query: mutationFileCreate,
        variables: { files: prepareFilesToCreate(result.stagedTargets, files, [...files.map(file => file.name)]) },
        shopDomain,
        accessToken,
      }),
      'fileCreate'
    )

    let uploadingFiles = result.files

    while (uploadingFiles.length) {
      const filesStatus = await verifyResponse(
        await requestGraphqlApi({
          query: queryForFileByIds(uploadingFiles.map((f: any) => f.id)),
          shopDomain,
          accessToken,
        }),
        'nodes'
      )

      // eslint-disable-next-line no-loop-func
      filesStatus.forEach((file: any) => {
        if (file.fileStatus === 'READY' || file.fileErrors?.length) {
          uploadingFiles = uploadingFiles.filter((f: any) => f.id !== file.id)

          if (file.fileStatus === 'READY') {
            uploadedFiles.push(file)
          } else {
            errorFiles.push(file)
          }
        }
      })
    }

    // Save uploaded files info to app database for later reference if needed
    // Disable save print image file to ShopifyFile to bypass cleaning up mechanism
    // await ShopifyFile.bulkWrite(
    //   uploadedFiles.map((file: any) => {
    //     const name = file.alt

    //     return {
    //       updateOne: {
    //         filter: { shopifyId: file.id },
    //         update: {
    //           name,
    //           shopDomain,
    //           url: file.image.originalSrc,
    //           nameWithoutExtension: name.replace(/\.[a-zA-Z0-9]{2,4}$/, ''),
    //         },
    //         upsert: true,
    //       },
    //     }
    //   })
    // )
  } catch (e) {
    errors = e as string
  }

  return { uploadedFiles, errorFiles, errors }
}
