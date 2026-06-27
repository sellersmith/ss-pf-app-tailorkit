// Body parsers for the TailorKit storefront proxy dispatcher. The PageFly proxy boundary marshals
// multipart uploads into `body.files` / `body.<field>` as upstream upload entries ({ name, type,
// dataBase64 }) and leaves string fields (action, eventName, properties, body) on the JSON body. These
// helpers read each action's payload from that normalized body so the dispatcher stays declarative.
import type { ShopifyFileUploadInput } from '../../../../web/server/src/app-platform/contracts'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function isUploadEntry(value: unknown): value is ShopifyFileUploadInput {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.name === 'string' && typeof entry.dataBase64 === 'string' && Boolean(entry.dataBase64)
}

/** Reads the multi-file `files` array (upload-image, upload-svg) the proxy boundary normalized. */
export function parseUploadFiles(body: unknown): ShopifyFileUploadInput[] {
  const value = asRecord(body).files
  if (!Array.isArray(value)) return []
  return value.filter(isUploadEntry).map(entry => ({
    name: entry.name,
    type: typeof entry.type === 'string' ? entry.type : '',
    dataBase64: entry.dataBase64,
  }))
}

/** Reads the single-file field (e.g. `image` for remove-background) the proxy boundary normalized. */
export function parseSingleUploadFile(body: unknown, field: string): ShopifyFileUploadInput | null {
  const value = asRecord(body)[field]
  return isUploadEntry(value) ? { name: value.name, type: value.type ?? '', dataBase64: value.dataBase64 } : null
}

/** Reads `track-event` fields. `properties` arrives as a JSON string (FormData) or object (JSON body). */
export function parseTrackEvent(body: unknown): { eventName: string; properties: Record<string, unknown> } {
  const record = asRecord(body)
  const eventName = typeof record.eventName === 'string' ? record.eventName : ''

  let properties: Record<string, unknown> = {}
  const raw = record.properties
  if (typeof raw === 'string') {
    try {
      properties = asRecord(JSON.parse(raw))
    } catch {
      properties = {}
    }
  } else if (raw && typeof raw === 'object') {
    properties = raw as Record<string, unknown>
  }

  return { eventName, properties }
}
