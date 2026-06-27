import { decompressData } from '../../upstream/tailorkit-app/app/utils/file-types/zip'
import type { TailorKitProductEditorSavePayload } from './product-editor-save-payload'
import { resolveTailorKitCopiedRouteRequestBridge } from './product-personalizer-copied-route-request-bridge'

const TAILORKIT_INTEGRATION_ACTIONS = {
  saveProduct: 'save-product',
  publishProduct: 'publish-product',
  unpublishProduct: 'unpublish-product',
} as const

export interface TailorKitIntegrationActionRequest {
  method: 'POST' | 'PUT'
  path: string
  body: unknown
}

function formDataValue(body: unknown, key: string): string {
  const value =
    body && typeof (body as { get?: unknown }).get === 'function'
      ? (body as { get(key: string): unknown }).get(key)
      : null
  return typeof value === 'string' ? value.trim() : ''
}

function formDataBlob(body: unknown, key: string): Blob | null {
  const value =
    body && typeof (body as { get?: unknown }).get === 'function'
      ? (body as { get(key: string): unknown }).get(key)
      : null
  return value instanceof Blob ? value : null
}

function savePayloadIntegrationId(payload: TailorKitProductEditorSavePayload): string {
  const integration = payload.integration
  const id = integration && (integration._id || integration.id)
  return typeof id === 'string' || typeof id === 'number' ? String(id).trim() : ''
}

export function mapTailorKitIntegrationActionPath(body: unknown): string {
  const action = formDataValue(body, 'action')
  const integrationId = formDataValue(body, 'integrationId')

  if (action === TAILORKIT_INTEGRATION_ACTIONS.saveProduct) {
    throw new Error(
      'TailorKit save-product FormData requires async payload mapping in the PageFly ProductEditor island'
    )
  }

  const bridge = resolveTailorKitCopiedRouteRequestBridge({
    method: 'POST',
    path: '/api/integration',
    action,
    integrationId,
  })

  if (bridge.status === 'mapped' && bridge.pageflyPath) return bridge.pageflyPath

  if (action) {
    throw new Error(`Unsupported TailorKit /api/integration action in PageFly island: ${action}`)
  }

  throw new Error('TailorKit /api/integration FormData action is missing in PageFly island')
}

export async function mapTailorKitIntegrationActionRequest(
  body: unknown
): Promise<TailorKitIntegrationActionRequest> {
  const action = formDataValue(body, 'action')

  if (action === TAILORKIT_INTEGRATION_ACTIONS.saveProduct) {
    const integrationBlob = formDataBlob(body, 'integration')
    if (!integrationBlob) {
      throw new Error('TailorKit save-product FormData is missing the compressed integration payload')
    }

    const compressedData = new Uint8Array(await integrationBlob.arrayBuffer())
    const tailorkitSavePayload = decompressData<TailorKitProductEditorSavePayload>(compressedData)
    const integrationId = savePayloadIntegrationId(tailorkitSavePayload)

    if (!integrationId) {
      throw new Error('TailorKit save-product payload is missing integration._id')
    }

    return {
      method: 'PUT',
      path: `/personalized-products/${encodeURIComponent(integrationId)}`,
      body: { tailorkitSavePayload },
    }
  }

  return { method: 'POST', path: mapTailorKitIntegrationActionPath(body), body: {} }
}
