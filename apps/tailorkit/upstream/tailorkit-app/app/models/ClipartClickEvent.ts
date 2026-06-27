export enum AssetType {
  CLIPART = 'clipart',
}

export enum ClickContext {
  MODAL_TEMPLATE_LISTING = 'modal-template-listing', // Modal in template listing page
  MODAL_TEMPLATE_SELECTOR_EDITOR = 'modal-template-selector-editor', // Modal in clipart selector in template editor page
  MODAL_TEMPLATE_EDITOR_MULTI_LAYOUT = 'modal-template-editor-multi-layout', // Modal in clipart selector in template editor multi layout page
  EDITOR_CLIPART_PANEL = 'editor-clipart-panel', // Editor clipart tool panel
  EDITOR_TEXT_PANEL_FONTS_COMBINED = 'editor-text-panel-fonts-combined', // Editor text panel - combined fonts
  EDITOR_TEXT_PANEL_FONTS_COMBINED_SUGGESTED = 'editor-text-panel-fonts-combined-suggested', // Editor text panel - suggested combined fonts
  DASHBOARD_CLIPART_SHOWCASE = 'dashboard-clipart-showcase', // Dashboard clipart showcase
}

export interface ClipartClickEventDocument {
  // Core identifiers
  assetId: string
  assetType: AssetType
  shopDomain: string

  // Context tracking
  clickedAt: Date
  context: ClickContext // Where the click happened
  category?: string // From filter/search context
  searchQuery?: string

  createdAt?: Date
  updatedAt?: Date
}
