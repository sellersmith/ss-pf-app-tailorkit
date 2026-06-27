import type { TailorKitIntegrationRecord, TailorKitIntegrationStatus } from './product-personalizer'

export interface TailorKitListQueryInput {
  q?: unknown
  status?: unknown
  [key: string]: unknown
}

export interface TailorKitMockupListItem {
  _id: string
  id: string
  integrationId: string
  label: string
  title: string
  status: TailorKitIntegrationStatus
  createdAt: string
  updatedAt: string
  views: ReturnType<typeof toViewListItem>[]
  denormalizedData: {
    integration: {
      _id: string
      id: string
      name: string
      title: string
      publishedAt: string | null
    }
    variants: ReturnType<typeof toVariantListItem>[]
    templates: ReturnType<typeof toTemplateListItem>[]
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstValue(value: string): string {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)[0] || ''
}

function parseStringHasFilter(value: unknown): string {
  const raw = text(value)
  const prefix = 'string__has__'
  if (!raw) return ''
  if (raw.startsWith(prefix)) return decodeURIComponent(raw.slice(prefix.length)).trim()
  return decodeURIComponent(raw).trim()
}

function parseStatus(value: unknown): TailorKitIntegrationStatus | undefined {
  const raw = firstValue(text(value)).toLowerCase()
  if (raw === 'published' || raw === 'unpublished' || raw === 'outdated') return raw
  return undefined
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(1, Math.floor(parsed))
}

export function parseTailorKitListOptions(query: TailorKitListQueryInput) {
  return {
    q: text(query.q) || parseStringHasFilter(query.filter__title),
    status: parseStatus(query.status) || parseStatus(query.filter__status),
    cursor: text(query.cursor),
    page: positiveNumber(query.page),
    limit: positiveNumber(query.limit),
    sort: text(query.sort),
    productId: text(query.productId) || undefined,
  }
}

function toTemplateListItem(template: TailorKitIntegrationRecord['templates'][number]) {
  return {
    ...template,
    _id: template.id,
    name: template.name || 'Untitled template',
    updatedAt: template.updatedAt || null,
  }
}

function toPrintAreaListItem(printArea: NonNullable<TailorKitIntegrationRecord['draft']['editorState']>['printAreas'][number]) {
  return {
    ...printArea,
    _id: printArea.id,
    name: printArea.label || 'Print area',
    template: printArea.templateId,
  }
}

function toVariantListItem(
  variant: TailorKitIntegrationRecord['variants'][number],
  printAreas: ReturnType<typeof toPrintAreaListItem>[]
) {
  return {
    ...variant,
    _id: variant.id,
    printAreas,
  }
}

function toViewListItem(view: NonNullable<TailorKitIntegrationRecord['draft']['editorState']>['mockupViews'][number]) {
  return {
    ...view,
    _id: view.id,
  }
}

/** Converts PageFly app-data integration records into the Mockup-shaped list rows copied TailorKit expects. */
export function createTailorKitPersonalizedProductListItem(
  record: TailorKitIntegrationRecord
): TailorKitMockupListItem {
  const editorState = record.draft.editorState
  const mockup = record.mockups[0]
  const mockupId = mockup?.id || editorState?.mockupId || record.id
  const printAreas = (editorState?.printAreas || [])
    .filter(printArea => !printArea.mockupId || printArea.mockupId === mockupId)
    .map(toPrintAreaListItem)
  const templateSnapshots = record.templates.length ? record.templates : editorState?.templateSnapshots || []
  const templates = templateSnapshots.map(toTemplateListItem)
  const views = (editorState?.mockupViews || []).filter(view => view.mockupId === mockupId).map(toViewListItem)

  return {
    _id: mockupId,
    id: mockupId,
    integrationId: record.id,
    label: mockup?.label || record.title,
    title: record.title,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    views,
    denormalizedData: {
      integration: {
        _id: record.id,
        id: record.id,
        name: record.title,
        title: record.title,
        publishedAt: record.publishedAt,
      },
      variants: record.variants.map(variant => toVariantListItem(variant, printAreas)),
      templates,
    },
  }
}
