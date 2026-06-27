/**
 * Capability context for the planning agent.
 * Describes what element types can do, their display styles, and limitations.
 * Injected JIT into the planning prompt — NOT loaded globally.
 *
 * Pattern: Shopify JIT Instructions — only costs tokens when planning skill runs.
 */

/** Element capabilities — source of truth for what the AI can create */
const ELEMENT_CAPABILITIES = {
  imageless: {
    description: 'Visual option picker shown on storefront (colors, sizes, materials)',
    displayStyles: [
      'imageless_dropdown_list — dropdown menu (DEFAULT — use for all option counts unless swatch explicitly requested)',
      'imageless_checkbox — toggle on/off (use for yes/no toggles only)',
      'imageless_swatch — radio-button style circles (use only when merchant explicitly requests swatch/radio)',
    ],
    capabilities: [
      'pricing per value (+$5, +$10)',
      'required/optional flag',
      'conditional logic: can be SOURCE (trigger show/hide) AND TARGET (be shown/hidden)',
    ],
    optionSetType: 'imageless_option',
  },
  text_customer: {
    description: 'Free text input where buyer types custom text (engraving, personalization, notes)',
    displayStyles: ['text input field on storefront'],
    capabilities: [
      'placeholder text',
      'character limit',
      'multi-line toggle',
      'required/optional flag',
      'fontOptions: built-in font selection (use Google Font family names)',
      'colorOptions: built-in color selection (use hex values)',
      'conditional logic: TARGET only (can be shown/hidden, cannot trigger conditions)',
    ],
    optionSetType: null,
    note: 'Uses settings (textCreatedBy=customers). Font and color are SUB-PROPERTIES — use fontOptions/colorOptions fields, NOT separate elements.',
  },
  text: {
    description: 'Admin-defined text presets buyer can choose from (predefined messages)',
    displayStyles: ['text option list'],
    capabilities: ['pricing per value', 'conditional logic: TARGET only'],
    optionSetType: 'text_option',
  },
  image: {
    description: 'Buyer image upload for custom photos, logos, or artwork',
    displayStyles: ['image uploader on storefront'],
    capabilities: [
      'buyer upload toggle (MUST be enabled — set settings.allowBuyerUpload: true)',
      'conditional logic: TARGET only',
    ],
    optionSetType: 'image_option',
    note: 'ALWAYS set settings.allowBuyerUpload: true so buyers can upload their photos/logos',
  },
} as const

/** How conditional logic works in TailorKit */
const CONDITIONAL_LOGIC_DESCRIPTION = `Conditional logic shows or hides elements based on option selection in another element.

Rules:
- SOURCE: Only "imageless" elements can trigger conditions (they have selectable options)
- TARGET: Any element type can be shown/hidden by a condition
- Mechanism: When a specific option value is selected in the source, the target becomes visible
- Single-level only: A → B is supported. Chained A → B → C is NOT supported in V1.

Example: "Add Sparkling Finish?" (checkbox) = SOURCE → "Finish Color" (swatch) = TARGET
When "Yes" is selected in "Add Sparkling Finish", "Finish Color" becomes visible.`

/** Element property ownership rules — what belongs to what */
const ELEMENT_PROPERTY_RULES = [
  'Font selection FOR a text element → use fontOptions on the text_customer step (sub-property, NOT a separate element)',
  'Color selection FOR a text element → use colorOptions on the text_customer step (sub-property, NOT a separate element)',
  'Product-level options (size, material, product color NOT tied to text) → separate imageless elements',
  'Image upload → always a separate element',
  'Generate ONLY what the user explicitly asked for — do NOT add extra steps',
]

/** Known limitations the AI should be aware of */
const LIMITATIONS = [
  'Charm builder (multi-select product grid) requires manual product catalog setup — cannot be fully configured by AI',
  'Multi-layout (design layout options) requires manual template setup '
    + '— cannot be auto-generated. Guide merchant to the template editor',
  'Print areas are template-level concepts — cannot be created via '
    + 'customization options. Guide merchant to use the template editor',
  'Variant-specific filtering not supported — all product variants share the same '
    + 'elements. Workaround: create a "Product Type" option and use conditional logic',
  'Multi-select is only available via charm builder. Standard option sets are single-select only',
  'Maximum recommended: 15 elements per plan to ensure reliable generation',
]

/** Build capability context string for LLM injection */
export function buildCapabilityContext(): string {
  const sections: string[] = []

  sections.push('## Available Element Types\n')
  for (const [type, cap] of Object.entries(ELEMENT_CAPABILITIES)) {
    sections.push(`### ${type}`)
    sections.push(cap.description)
    sections.push(`Display styles: ${cap.displayStyles.join(', ')}`)
    sections.push(`Capabilities: ${cap.capabilities.join('; ')}`)
    if (cap.optionSetType) sections.push(`Option set type: ${cap.optionSetType}`)
    if ('note' in cap) sections.push(`Note: ${cap.note}`)
    sections.push('')
  }

  sections.push('## Conditional Logic\n')
  sections.push(CONDITIONAL_LOGIC_DESCRIPTION)

  sections.push('\n## Element Property Rules\n')
  ELEMENT_PROPERTY_RULES.forEach(r => sections.push(`- ${r}`))

  sections.push('\n## Limitations\n')
  LIMITATIONS.forEach(l => sections.push(`- ${l}`))

  return sections.join('\n')
}
