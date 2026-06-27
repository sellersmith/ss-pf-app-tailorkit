import type { LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'

export async function fetchProxyImage(stringUrl: string | URL | null) {
  try {
    const url = typeof stringUrl === 'string' ? new URL(stringUrl) : stringUrl

    if (!url) {
      return new Response('No url provided', { status: 400 })
    }

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Error fetching image: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    return new Response('Error fetching image', { status: 500 })
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate user
    await authenticate.admin(request)
    const url = new URL(request.url).searchParams.get('url')

    const response = await fetchProxyImage(url)
    return response
  } catch (e) {
    return new Response('Error fetching image', { status: 500 })
  }
}
