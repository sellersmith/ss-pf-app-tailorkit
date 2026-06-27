import { decompressData } from '../../upstream/tailorkit-app/app/utils/file-types/zip'
import { resolveTailorKitCopiedRouteRequestBridge } from './product-personalizer-copied-route-request-bridge'

const TAILORKIT_TEMPLATE_ACTIONS = {
  saveTemplate: 'saveTemplate',
} as const

export interface TailorKitTemplateSaveActionRequest {
  method: 'POST'
  path: string
  body: {
    templateData: Record<string, unknown>
    useAiFeature: boolean
  }
}

function formDataValue(body: unknown, key: string): string {
  const value = bodyValue(body, key)
  return typeof value === 'string' ? value.trim() : ''
}

function formDataBlob(body: unknown, key: string): Blob | null {
  const value = bodyValue(body, key)
  return value instanceof Blob ? value : null
}

function bodyValue(body: unknown, key: string): unknown {
  if (!body || typeof body !== 'object') return null
  if (typeof (body as { get?: unknown }).get === 'function') {
    return (body as { get(key: string): unknown }).get(key)
  }
  return (body as Record<string, unknown>)[key]
}

function templateIdFromPath(path: string): string {
  const url = new URL(path, 'https://tailorkit.local')
  const id = url.pathname.split('/').filter(Boolean)[2] || ''
  return decodeURIComponent(id).trim()
}

export function isTailorKitTemplateSaveAction(path: string, body: unknown): boolean {
  const url = new URL(path, 'https://tailorkit.local')
  return (
    url.pathname.startsWith('/api/templates/') &&
    formDataValue(body, 'type') === TAILORKIT_TEMPLATE_ACTIONS.saveTemplate
  )
}

export async function mapTailorKitTemplateSaveActionRequest(
  path: string,
  body: unknown
): Promise<TailorKitTemplateSaveActionRequest> {
  const templateId = templateIdFromPath(path)
  if (!templateId) throw new Error('TailorKit save-template FormData is missing template id')

  const bridge = resolveTailorKitCopiedRouteRequestBridge({
    method: 'POST',
    path: `/api/templates/${encodeURIComponent(templateId)}`,
    action: TAILORKIT_TEMPLATE_ACTIONS.saveTemplate,
  })

  if (bridge.status !== 'mapped' || bridge.pageflyMethod !== 'POST' || !bridge.pageflyPath) {
    throw new Error('Unsupported TailorKit save-template action in PageFly island')
  }

  const templateBlob = formDataBlob(body, 'templateData')
  if (!templateBlob) throw new Error('TailorKit save-template FormData is missing compressed templateData')

  const compressedData = new Uint8Array(await templateBlob.arrayBuffer())
  const templateData = decompressData<Record<string, unknown>>(compressedData)

  return {
    method: 'POST',
    path: bridge.pageflyPath,
    body: {
      templateData: {
        ...templateData,
        _id: typeof templateData._id === 'string' && templateData._id.trim() ? templateData._id : templateId,
      },
      useAiFeature: formDataValue(body, 'use_ai_feature') === '1',
    },
  }
}
