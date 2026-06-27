/**
 * Shared theme promotion data used by both:
 * - ThemesPromoCard (dashboard carousel)
 * - api.whats-new/route (What's New promotions tab)
 */

export const THEMES_VIEW_ALL_URL = 'https://themes.shopify.com/designers/saleshunterthemes'

export const THEMES_UTM = [
  'utm_marketing_channel=app-partnership',
  'utm_source=tailorkit',
  'main_source=tailorkit',
  'utm_campaign=crosspromo-app',
  'utm_content=tailorkit-sht',
].join('&')

export const THEMES_CDN = 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files'

export interface ThemePromoItem {
  readonly name: string
  readonly subheading: string
  readonly description: string
  readonly buttonUrl: string
  readonly desktopMedia: string
  readonly mobileMedia: string
}

/* eslint-disable max-len */
export const THEME_CARDS: readonly ThemePromoItem[] = [
  {
    name: 'SHINE',
    subheading: '3 presets, 95% positive reviews',
    description:
      'Luxury, elegant layouts that showcase personalized products as premium gifts with emotional, story-driven visuals.',
    buttonUrl: `https://themes.shopify.com/themes/shine/presets/shine?${THEMES_UTM}`,
    desktopMedia: `${THEMES_CDN}/1_f16d5036-333c-42d2-ab20-0e2ccab36f65.png?v=1772534526`,
    mobileMedia: `${THEMES_CDN}/mobile_SHINE.png?v=1772587830`,
  },
  {
    name: 'BLUM',
    subheading: '5 presets, 99% positive reviews',
    description:
      'Clean, modern layouts that highlight personalized products clearly, keeping the focus on the product and live preview.',
    buttonUrl: `https://themes.shopify.com/themes/blum/presets/blum?${THEMES_UTM}`,
    desktopMedia: `${THEMES_CDN}/2_c59f17a5-da6d-4107-a9d8-c9ec47962fc8.png?v=1772535273`,
    mobileMedia: `${THEMES_CDN}/mobile_BLUM.png?v=1772587828`,
  },
  {
    name: 'NORMCORE',
    subheading: '5 presets, 100% positive reviews',
    description: 'Structured, scalable layouts that display personalized products consistently across large catalogs.',
    buttonUrl: `https://themes.shopify.com/themes/normcore/presets/normcore?${THEMES_UTM}`,
    desktopMedia: `${THEMES_CDN}/desktop_NORM.png?v=1772587831`,
    mobileMedia: `${THEMES_CDN}/mobile_NORM.png?v=1772587824`,
  },
  {
    name: 'ELECTRO',
    subheading: '4 presets, 99% positive reviews',
    description:
      'Bold, technical layouts that present personalized products in a precise, functional, and professional mood.',
    buttonUrl: `https://themes.shopify.com/themes/electro/presets/electro?${THEMES_UTM}`,
    desktopMedia: `${THEMES_CDN}/desktop_ELECTRO.png?v=1772587835`,
    mobileMedia: `${THEMES_CDN}/mobile_ELECTRO.png?v=1772587825`,
  },
]
/* eslint-enable max-len */
