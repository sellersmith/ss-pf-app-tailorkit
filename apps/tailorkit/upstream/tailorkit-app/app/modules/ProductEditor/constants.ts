import { NavMenuItems } from '~/bootstrap/app-config'

export const INTEGRATION_SCREEN_ERRORS = {
  PRINT_AREA_NAME_IS_REQUIRED: 'Print area name is required',
  PRINT_AREA_NAME_EXISTED: 'Print area name existed',
  TEMPLATE_IS_NOT_AVAILABLE: 'Template is not available',
}

export const INTEGRATION_EDITOR_TRANSMISSION_EVENTS = {
  MAIN_APP_MESSAGE: 'integration-editor-main-app-message',
  UPDATE_TRANSFORMER: 'integration-editor-update-transformer',
}

export const INTEGRATION_EDITOR_DRAWER_KEYS = {
  INTEGRATION_EDITOR: 'integration-editor-drawer',
}

/**
 * Unified editor tab constants
 */
export const EDITOR_TABS = {
  DESIGN: 'design',
  MOCKUP: 'mockup',
  /** @deprecated Preview is now always visible in the right panel. Kept for backward compatibility. */
  PREVIEW: 'preview',
} as const

export type EditorTab = (typeof EDITOR_TABS)[keyof typeof EDITOR_TABS]

/**
 * Generate integration editor URL with params
 */
export function generateIntegrationEditorUrl(params: {
  integrationId: string
  mockupId: string
  tab?: EditorTab
  printAreaId?: string
  templateId?: string
}): string {
  const { integrationId, mockupId, tab = EDITOR_TABS.DESIGN, printAreaId, templateId } = params
  const searchParams = new URLSearchParams({ mockup: mockupId, tab })
  if (printAreaId) searchParams.set('printAreaId', printAreaId)
  if (templateId) searchParams.set('templateId', templateId)
  return `${NavMenuItems.PERSONALIZED_PRODUCTS}/${integrationId}?${searchParams.toString()}`
}
