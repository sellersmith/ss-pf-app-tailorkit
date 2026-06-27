export const EFFECT_CATEGORIES = [
  { id: 'all', label: 'all' },
  { id: 'engraved', label: 'engraved' },
  { id: 'illustrative', label: 'illustrative' },
  { id: 'festive', label: 'festive' },
] as const

export type EffectCategory = (typeof EFFECT_CATEGORIES)[number]['id']

export type PromptCategory = 'engraved' | 'illustrative' | 'festive' | null
