import type { LoaderFunctionArgs } from '@remix-run/node'
import { catchAsync } from '~/utils/catchAsync'
import https from 'https'
import { type ProductType, PREVIEW_PAGE_URLS, DEFAULT_PRODUCT } from '~/constants/products'

const PREVIEW_PAGE_PASSWORD = process.env.TAILORKIT_PREVIEW_PAGE_PASSWORD || ''

/**
 * Proxy a remote HTML page so it can be embedded inside the Shopify admin app iframe.
 * Handles X-Frame-Options by serving content from our domain and modifying URLs.
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  // Get the product from the query parameters
  const url = new URL(request.url)
  const product = url.searchParams.get('product') as ProductType
  const PREVIEW_PAGE_URL = PREVIEW_PAGE_URLS[product] || PREVIEW_PAGE_URLS[DEFAULT_PRODUCT]

  const remoteUrlObj = new URL(PREVIEW_PAGE_URL)
  let pageData: Response | null = null

  try {
    // First attempt to fetch the page directly
    pageData = await fetch(PREVIEW_PAGE_URL, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
      },
    })

    // If we hit the password page, handle authentication
    if (pageData.url?.includes('/password')) {
      const userAgent = request.headers.get('User-Agent')
      const passwordParams = {
        method: 'POST',
        host: remoteUrlObj.hostname,
        port: 443,
        path: '/password',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
      }

      const cookies = await getThemeRequestCookies(passwordParams, PREVIEW_PAGE_PASSWORD)

      // Fetch again with authentication cookies
      pageData = await fetch(PREVIEW_PAGE_URL, {
        headers: {
          Cookie: cookies,
          'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
        },
      })
    }

    if (!pageData) {
      throw new Error('Failed to fetch page data')
    }

    // Get the original response content
    let content = await pageData.text()

    // Add base tag to handle relative URLs
    const baseTag = `<base href="${remoteUrlObj.origin}/">`

    // Add CSS to show only product info
    const styleTag = `
      <style>
        .shopify-section-group-footer-group, .section-header {
          display: none !important;
        }
      </style>
      <script>
        document.addEventListener('DOMContentLoaded', function () {
          const sections = document.querySelectorAll('main#MainContent > section, .shopify-section, .section');

          sections.forEach((section) => {
            const hasProductInfo = section.querySelector('product-info');
            section.style.display = hasProductInfo ? 'block' : 'none';
            if (hasProductInfo) {
              hasProductInfo.style.display = 'block';
            }
          });

          document.dispatchEvent(new CustomEvent('tailorkit-demo-loaded', { bubbles: true }));
        });
      </script>
    `

    content = content.replace('</head>', `${baseTag}${styleTag}</head>`)
    // Create a new response with modified headers that allow iframe embedding
    return new Response(content, {
      headers: {
        'Content-Type': 'text/html',
        'X-Frame-Options': 'ALLOWALL',
        'Content-Security-Policy': `
          frame-ancestors https://*;
          default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;
          connect-src *;
          img-src * data: blob:;
          style-src * 'unsafe-inline';
          font-src * data:;
          script-src * 'unsafe-inline' 'unsafe-eval';
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    })
  } catch (error: any) {
    console.error('Proxy page error:', error.message)
    return new Response('Failed to load page', { status: 500 })
  }
})

function getThemeRequestCookies(params: any, storefrontPassword: string): Promise<string> {
  return new Promise((resolve: any, reject: any) => {
    const passwordReq = https.request(params, response => {
      const headerCookies = response.headers['set-cookie']
      const cookies = headerCookies ? headerCookies[0] : ''
      if (cookies) resolve(cookies)
    })

    passwordReq.write(`password=${storefrontPassword}`)
    passwordReq.on('error', err => {
      reject(err)
    })

    /**
     * Fallback: resolve with no cookies to prevent the canvas become blank
     * Sometimes the request is not able to get the cookies or getting 429 error from Shopify
     * Timeout duration: 15 seconds
     * */
    const TIMEOUT_DURATION = 15000
    setTimeout(() => {
      resolve('')
    }, TIMEOUT_DURATION)

    passwordReq.end()
  })
}
