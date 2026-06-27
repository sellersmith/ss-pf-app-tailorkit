export type TemplateEditorMode = 'unified' | 'standalone'

export interface TemplateEnvParams {
  mockupId: string
  printAreaId: string
  templateId?: string
}

export interface TemplateEnvAdapter {
  getMode(): TemplateEditorMode
  getUnifiedParams(): TemplateEnvParams | null
}

let currentAdapter: TemplateEnvAdapter | null = null

export function setTemplateEnvAdapter(adapter: TemplateEnvAdapter) {
  currentAdapter = adapter
}

export function clearTemplateEnvAdapter() {
  currentAdapter = null
}

export function getTemplateEnvAdapter(): TemplateEnvAdapter | null {
  return currentAdapter
}
