// PageFly island bridge for the copied TailorKit ImageSelector upload. The copied `useUploadFiles` posts a
// multipart FormData of File blobs to `/api/templates?action=uploadFiles`, but the app-platform boundary is
// JSON-only. This helper converts each File to base64 so the upload can cross the boundary as JSON; the
// PageFly `/files/upload` route decodes it and runs the real Shopify staged-upload (or S3) flow server-side.

interface TailorKitUploadFileEntry {
  name: string
  type: string
  dataBase64: string
}

export interface TailorKitImageUploadRequestBody {
  files: TailorKitUploadFileEntry[]
  fileUploadType: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

async function fileToUploadEntry(file: File): Promise<TailorKitUploadFileEntry> {
  const buffer = await file.arrayBuffer()
  return {
    name: file.name,
    type: file.type,
    dataBase64: arrayBufferToBase64(buffer),
  }
}

/**
 * True when the copied request is the ImageSelector multipart upload that must be base64-bridged.
 */
export function isTailorKitImageUploadRequest(path: string, body: unknown): boolean {
  const url = new URL(path, 'https://tailorkit.local')
  if (url.pathname !== '/api/templates') return false
  if (url.searchParams.get('action') !== 'uploadFiles') return false
  return typeof FormData !== 'undefined' && body instanceof FormData
}

/**
 * Converts the copied upload FormData (File entries under `files`, plus `fileUploadType`) into the JSON body
 * the PageFly `/files/upload` route accepts.
 */
export async function buildTailorKitImageUploadRequestBody(
  formData: FormData
): Promise<TailorKitImageUploadRequestBody> {
  const files = formData.getAll('files').filter((entry): entry is File => typeof File !== 'undefined' && entry instanceof File)
  const fileUploadTypeValue = formData.get('fileUploadType')
  const fileUploadType = typeof fileUploadTypeValue === 'string' ? fileUploadTypeValue : ''

  const uploadEntries = await Promise.all(files.map(fileToUploadEntry))
  return { files: uploadEntries, fileUploadType }
}

/**
 * True when the copied request is the Colour Guide single-file multipart upload that must be base64-bridged.
 */
export function isTailorKitColourGuideUploadRequest(path: string, body: unknown): boolean {
  const url = new URL(path, 'https://tailorkit.local')
  if (url.pathname !== '/api/colour-guide/upload') return false
  return typeof FormData !== 'undefined' && body instanceof FormData
}

/**
 * Converts the copied Colour Guide FormData (single `file` entry) into the JSON body the PageFly
 * `/files/colour-guide-upload` route accepts (reuses the shared upload entry shape under `files`).
 */
export async function buildTailorKitColourGuideRequestBody(
  formData: FormData
): Promise<{ files: TailorKitUploadFileEntry[] }> {
  const file = formData.get('file')
  if (typeof File === 'undefined' || !(file instanceof File)) return { files: [] }
  return { files: [await fileToUploadEntry(file)] }
}
