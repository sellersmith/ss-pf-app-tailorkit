/**
 * Demo customizer config used by PageFly editor preview when a shop has not
 * installed TailorKit yet, or has installed but not configured a customizer
 * for the requested product. Mirrors the storefront-shape produced by
 * `prepareMetafieldDataBeforePublishingIntegrationV2()` so the WC preview
 * mode can render it without server fetch.
 */
export const PAGEFLY_DEMO_CONFIG = {
  settings: {
    personalized_design_title: 'Personalized Design',
    always_render_live_preview: true,
    featured_image_container_selector: '#pf-tailorkit-preview',
  },
  productImage: {
    u: 'https://placehold.co/800x800/f5f5f5/cccccc?text=Product',
    w: 800,
    h: 800,
  },
  mockup: {
    _id: 'demo-mockup',
    pi: {
      u: 'https://placehold.co/800x800/f5f5f5/cccccc?text=Product',
      w: 800,
      h: 800,
    },
    printAreas: [
      {
        i: 'pa-demo',
        name: 'Front',
        templateName: 'Front',
        vsb: true,
        ls: [
          {
            i: 'layer-text',
            t: 'text',
            ds: { l: 200, t: 320, w: 400, h: 100, r: 0, originalScaleX: 1, originalScaleY: 1 },
            s: {
              text: 'Your Name',
              textCreatedBy: 'customers',
              fontSize: 48,
              fontFamily: 'Playfair Display',
              fill: '#333',
              storefrontLabel: 'Your Text',
            },
            ss: { shape: 'rectangle', enableForCustomers: true },
            osl: [
              { i: 'os-text', t: 'text_option', l: 'Your Text', ol: [] },
              {
                i: 'os-font',
                t: 'font_option',
                l: 'Font Style',
                ol: [
                  { i: 'f1', l: 'Playfair Display', v: '{"family":"Playfair Display"}', s: 1 },
                  { i: 'f2', l: 'Great Vibes', v: '{"family":"Great Vibes"}' },
                  { i: 'f3', l: 'Montserrat', v: '{"family":"Montserrat"}' },
                ],
              },
            ],
            preRender: true,
          },
        ],
      },
    ],
    lis: [
      {
        i: 'li-demo',
        t: 'template',
        vsb: true,
        data: {
          printAreaId: 'pa-demo',
          l: 0,
          t: 0,
          w: 800,
          h: 800,
          r: 0,
          ls: [
            {
              i: 'layer-text',
              t: 'text',
              ds: { l: 200, t: 320, w: 400, h: 100, r: 0, originalScaleX: 1, originalScaleY: 1 },
              s: {
                text: 'Your Name',
                textCreatedBy: 'customers',
                fontSize: 48,
                fontFamily: 'Playfair Display',
                fill: '#333',
              },
              ss: { shape: 'rectangle', enableForCustomers: true },
              osl: [],
            },
          ],
        },
      },
    ],
    eot: true,
    views: [
      {
        _id: 'view-front',
        title: 'Front',
        layers: ['li-demo'],
        overrides: {},
        baseImage: {
          url: 'https://placehold.co/800x800/f5f5f5/cccccc?text=Product',
          width: 800,
          height: 800,
        },
      },
    ],
  },
} as const

/**
 * Centralized UTM tags for any PageFly-bound URL we hand back to the editor.
 * Update here when attribution scheme changes — every PF link picks it up.
 */
export const PAGEFLY_UTM_PARAMS = {
  utm_source: 'pagefly_editor',
  utm_medium: 'element',
  utm_campaign: 'personalize-product',
} as const

/**
 * Appends PAGEFLY_UTM_PARAMS to the given URL, preserving any existing
 * query params and hash fragment. Uses the URL API so encoding is correct
 * for both `?key=val` and `?a=1&b=2` inputs.
 */
export function withPageflyUtm(url: string): string {
  const u = new URL(url)
  for (const [key, value] of Object.entries(PAGEFLY_UTM_PARAMS)) {
    u.searchParams.set(key, value)
  }
  return u.toString()
}

export const PAGEFLY_INSTALL_URL = withPageflyUtm('https://apps.shopify.com/tailorkit')

export const PAGEFLY_ADMIN_URL = withPageflyUtm('https://admin.shopify.com/apps/tailorkit')
