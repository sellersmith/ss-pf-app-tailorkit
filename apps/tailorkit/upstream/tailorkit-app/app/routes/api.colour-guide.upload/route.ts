import type { ActionFunctionArgs } from '@remix-run/node'
import fs from 'fs'
import path from 'path'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { uploadFileToAmazonS3 } from '~/utils/amazon-s3'
import { sanitizeFileName } from '~/utils/file-types'
import { uuid } from '~/utils/uuid'

/**
 * Upload a Colour Guide reference image to S3 and return the public URL.
 *
 * Route: POST /api/colour-guide/upload
 * Body : multipart/form-data with a single `file` field
 *
 * Constraints (locked 2026-05-18):
 *  - ≤ 5MB
 *  - MIME ∈ { image/jpeg, image/png, image/webp }
 *
 * Stored at: `${shopDomain}/colour-guide/<uuid>-<safe-filename>` in S3.
 * The same endpoint serves both the global Storefront Setup card and the
 * per-template ColorOptionSet upload field — keep it generic.
 */

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
// Extension allowlist guards against MIME spoofing: a file claiming
// `type: image/jpeg` but named `xss.svg` would otherwise pass the MIME check
// then be stored in S3 with `ContentType: image/svg+xml` (S3 helper sniffs
// extension), letting SVG scripts execute when served back.
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 })
  }

  const { session } = await authenticate.admin(request)
  const shopDomain = session.shop

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return json({ success: false, error: 'file required' }, { status: 400 })
  }
  if (file.size === 0) {
    return json({ success: false, error: 'file is empty' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return json({ success: false, error: 'file too large (max 5MB)' }, { status: 413 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return json({ success: false, error: 'unsupported file type' }, { status: 415 })
  }
  // Defence-in-depth: also validate by file extension. Defeats the case where
  // a SVG/HTML payload is sent with a forged `image/jpeg` MIME header.
  const extFromName = path.extname(file.name).toLowerCase()
  if (!ALLOWED_EXT.has(extFromName)) {
    return json({ success: false, error: 'unsupported file extension' }, { status: 415 })
  }

  const cacheFolder = path.resolve('./cache')
  if (!fs.existsSync(cacheFolder)) {
    fs.mkdirSync(cacheFolder)
  }

  const safeName = sanitizeFileName(file.name) || 'colour-guide'
  const prefix = uuid().split('-')[0]
  const tmpPath = path.resolve(`${cacheFolder}/${prefix}-${safeName}`)

  try {
    fs.writeFileSync(tmpPath, Buffer.from(await file.arrayBuffer()))
    const url = await uploadFileToAmazonS3(tmpPath, `${shopDomain}/colour-guide`)
    if (!url) {
      return json({ success: false, error: 'upload failed' }, { status: 502 })
    }
    return json({ success: true, url })
  } catch (err) {
    console.error('[colour-guide.upload] S3 upload failed', err)
    return json({ success: false, error: 'upload failed' }, { status: 502 })
  } finally {
    try {
      fs.rmSync(tmpPath, { force: true })
    } catch {
      // best-effort cleanup; do not fail the response on tmp file rm error
    }
  }
})
