import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { getPersonalizedBlogPosts } from '~/utils/supabase-client.server'

/**
 * API route to get personalized blog posts using RAG technique
 * Returns blog posts personalized for the specific shop based on their metadata
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const position = url.searchParams.get('position') || 'Dashboard'
  const shopDomain = url.searchParams.get('shopDomain')

  if (!shopDomain) {
    return json({ error: 'Shop domain is required' }, { status: 400 })
  }

  try {
    // Get personalized blog posts using RAG technique
    const result = await getPersonalizedBlogPosts(shopDomain, position, 2)

    // Provide default intro if missing or empty
    const defaultIntro = {
      heading: 'Explore Our Blog',
      description: 'Discover tips and insights tailored for your store',
    }

    const intro = result.intro && Object.keys(result.intro).length > 0 ? result.intro : defaultIntro

    return json({
      posts: result.posts || [],
      intro,
    })
  } catch (error) {
    console.error('Error fetching personalized blog posts:', error)

    // Return empty result on error
    return json(
      {
        posts: [],
        intro: {
          heading: 'Explore Our Blog',
          description: 'Discover tips and insights tailored for your store',
        },
      },
      { status: 500 }
    )
  }
})

// Also export as action for potential future POST requests (like syncing)
export { loader as action }
