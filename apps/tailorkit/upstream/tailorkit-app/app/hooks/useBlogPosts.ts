import { useLayoutEffect, useMemo, useState } from 'react'
import { useRootLoaderData } from '~/root'
import { authenticatedFetch } from '~/shopify/fns.client'

interface BlogPost {
  id?: string
  title: string
  description: string
  image: string
  buttonText?: string
  buttonLink: string
  badgeContent?: string
  key?: string
  position?: string
  startDate?: string
  endDate?: string
  categories?: string[]
  tags?: string[]
  publishedAt?: string
  similarity?: number
}

interface BlogIntro {
  heading?: string
  description?: string
}

interface BlogResponse {
  posts: BlogPost[]
  intro: BlogIntro
  message?: string // For handling authenticatedFetch error responses
}

export default function useBlogPosts(props: { position: string }) {
  const { position } = props
  const { shopData } = useRootLoaderData()
  const shopDomain = shopData?.shopDomain

  // State for personalized blog posts
  const [loading, setLoading] = useState(false)
  const [intro, setIntro] = useState<BlogIntro>({})
  const [items, setItems] = useState<BlogPost[]>([])

  useLayoutEffect(() => {
    if (!shopDomain) return

    const abortController = new AbortController()
    setLoading(true)

    // Call our new personalized blog API
    authenticatedFetch(
      `/api/blog-posts?position=${encodeURIComponent(position)}&shopDomain=${encodeURIComponent(shopDomain)}`,
      {
        signal: abortController.signal,
      }
    )
      .then((data: BlogResponse | null) => {
        // authenticatedFetch returns parsed JSON directly, not a Response object
        if (data && typeof data === 'object' && !data.message?.includes('aborted')) {
          setIntro(data.intro || {})
          setItems(data.posts || [])
        } else if (!data) {
          console.error('No data received from blog posts API')
        }
        setLoading(false)
      })
      .catch(error => {
        if (!abortController.signal.aborted) {
          console.error('Personalized blog posts fetch error:', error)
          setLoading(false)
        }
      })

    return () => abortController.abort()
  }, [shopDomain, position])

  // Convert Supabase blog posts to the expected format
  const activeBlogPosts = useMemo(() => {
    return items.map(post => ({
      title: post.title,
      description: post.description,
      image: post.image,
      buttonText: post.buttonText || (post as any).button_text,
      buttonLink: post.buttonLink || (post as any).button_link,
      badgeContent: post.badgeContent || (post as any).badge_content,
      key: post.key || post.title,
      position: post.position,
      startDate: post.startDate || (post as any).start_date,
      endDate: post.endDate || (post as any).end_date,
      categories: post.categories,
      tags: post.tags,
      publishedAt: post.publishedAt || (post as any).published_at,
      similarity: post.similarity,
    }))
  }, [items])

  return {
    intro,
    items: activeBlogPosts, // For backward compatibility
    activeBlogPosts,
    loading,
  }
}
