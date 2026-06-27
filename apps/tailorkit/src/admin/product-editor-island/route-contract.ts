export const EDITOR_TABS = {
  DESIGN: 'design',
  MOCKUP: 'mockup',
  PREVIEW: 'preview',
} as const

export type EditorTab = (typeof EDITOR_TABS)[keyof typeof EDITOR_TABS]

export const PRODUCT_EDITOR_TABS = [
  { id: EDITOR_TABS.DESIGN, content: 'Design', panelID: 'tailorkit-design-panel' },
  { id: EDITOR_TABS.MOCKUP, content: 'Mockup', panelID: 'tailorkit-mockup-panel' },
  { id: EDITOR_TABS.PREVIEW, content: 'Preview', panelID: 'tailorkit-preview-panel' },
]

interface GenerateProductEditorPathParams {
  integrationId: string
  mockupId?: string
  tab?: EditorTab
  printAreaId?: string
  templateId?: string
}

/** PageFly routeBase equivalent of TailorKit's ProductEditor query contract. */
export function generateProductEditorPath(params: GenerateProductEditorPathParams): string {
  const { integrationId, mockupId = '', tab = EDITOR_TABS.DESIGN, printAreaId, templateId } = params
  const searchParams = new URLSearchParams({ mockup: mockupId, tab })

  if (printAreaId) searchParams.set('printAreaId', printAreaId)
  if (templateId) searchParams.set('templateId', templateId)

  return `${integrationId}?${searchParams.toString()}`
}

export function parseEditorTab(value?: string | null): EditorTab {
  if (value === EDITOR_TABS.DESIGN || value === EDITOR_TABS.MOCKUP || value === EDITOR_TABS.PREVIEW) return value
  return EDITOR_TABS.DESIGN
}
