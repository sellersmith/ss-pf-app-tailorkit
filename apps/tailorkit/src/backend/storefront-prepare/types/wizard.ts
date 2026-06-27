export interface WizardStepItem {
  /** Index into the collectCustomizationItems() output array (matches storefront DOM order) */
  elementIndex: number
  /** Stable customization item ID for admin UI tracking (survives layer reordering) */
  itemId: string
  /** Snapshot of label at assignment time (display only, not used for matching) */
  label?: string
}

export interface WizardStep {
  /** Unique step ID */
  id: string
  /** Merchant-editable display name */
  label: string
  /** Option sets grouped in this step */
  items: WizardStepItem[]
}

export interface WizardConfig {
  enabled: boolean
  steps: WizardStep[]
}
