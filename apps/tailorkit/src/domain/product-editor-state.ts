import type {
  TailorKitIntegrationRecord,
  TailorKitMockupSnapshot,
  TailorKitTemplateSnapshot,
  TailorKitVariantSnapshot,
} from './product-personalizer'

export interface TailorKitPrintAreaSnapshot {
  id: string
  label: string
  mockupId: string
  templateId?: string
  widthPx?: number
  heightPx?: number
}

export interface TailorKitLayerIntegrationSnapshot {
  id: string
  printAreaId?: string
  templateId?: string
  type: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  visible?: boolean
  mask?: unknown
  data?: Record<string, unknown>
}

export interface TailorKitMockupViewSnapshot {
  id: string
  mockupId: string
  title: string
  layerIds: string[]
  baseImage?: unknown
  backgroundImage?: unknown
  maskImage?: unknown
  enableClippingMask?: boolean
  overrides?: Record<string, unknown>
}

export interface TailorKitEditorState {
  activeTab?: 'design' | 'mockup' | 'preview'
  mockupId?: string
  printAreaId?: string
  selectedVariantIds: string[]
  templateIds: string[]
  printAreas: TailorKitPrintAreaSnapshot[]
  templateSnapshots: TailorKitTemplateSnapshot[]
  layerIntegrations: TailorKitLayerIntegrationSnapshot[]
  mockupViews: TailorKitMockupViewSnapshot[]
  lastSavedAt?: string
}

export interface TailorKitStorefrontSnapshot {
  integrationId: string
  title: string
  status: TailorKitIntegrationRecord['status']
  generatedAt: string
  variants: TailorKitVariantSnapshot[]
  mockups: TailorKitMockupSnapshot[]
  templates: TailorKitTemplateSnapshot[]
  printAreas: TailorKitPrintAreaSnapshot[]
  layerIntegrations: TailorKitLayerIntegrationSnapshot[]
  mockupViews: TailorKitMockupViewSnapshot[]
}

export function createEditorStateSnapshot(
  record: TailorKitIntegrationRecord,
  input?: Partial<TailorKitEditorState>
): TailorKitEditorState {
  const current = record.draft.editorState
  const templateSnapshots = input?.templateSnapshots?.length
    ? input.templateSnapshots
    : current?.templateSnapshots?.length
    ? current.templateSnapshots
    : record.templates
  const templateIds = input?.templateIds?.length
    ? input.templateIds
    : current?.templateIds?.length
    ? current.templateIds
    : templateSnapshots.map(template => template.id)
  const mockupId = input?.mockupId || current?.mockupId || record.mockups[0]?.id
  const mockupViews = input?.mockupViews ?? current?.mockupViews ?? []

  return {
    selectedVariantIds: input?.selectedVariantIds?.length
      ? input.selectedVariantIds
      : current?.selectedVariantIds?.length
      ? current.selectedVariantIds
      : record.variants.map(variant => variant.id),
    templateIds,
    printAreas: input?.printAreas ?? current?.printAreas ?? [],
    templateSnapshots,
    layerIntegrations: input?.layerIntegrations ?? current?.layerIntegrations ?? [],
    mockupViews,
    activeTab: input?.activeTab ?? current?.activeTab,
    mockupId,
    printAreaId: input?.printAreaId ?? current?.printAreaId,
    lastSavedAt: input?.lastSavedAt ?? current?.lastSavedAt,
  }
}

export function createStorefrontSnapshot(record: TailorKitIntegrationRecord, generatedAt: string) {
  const editorState = createEditorStateSnapshot(record, record.draft.editorState)

  return {
    integrationId: record.id,
    title: record.title,
    status: record.status,
    generatedAt,
    variants: record.variants,
    mockups: record.mockups,
    templates: editorState.templateSnapshots,
    printAreas: editorState.printAreas,
    layerIntegrations: editorState.layerIntegrations,
    mockupViews: editorState.mockupViews,
  } satisfies TailorKitStorefrontSnapshot
}
