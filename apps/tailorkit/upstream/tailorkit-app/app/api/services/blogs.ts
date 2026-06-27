import { z } from 'zod'
import { Http } from '../core/httpClient'
import { parseWithZod } from '../core/validation'

const BlogPostZ = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string(),
    image: z.string(),
    button_text: z.string().optional(),
    button_link: z.string(),
    badge_content: z.string().optional(),
    key: z.string().optional(),
    position: z.string().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    categories: z.array(z.string()).optional().default([]),
    tags: z.array(z.string()).optional().default([]),
    published_at: z.string().optional(),
    similarity: z.number().optional(),
  })
  .passthrough()

const IntroZ = z.object({ heading: z.string().optional(), description: z.string().optional() }).passthrough()
const BlogsResponseZ = z.object({ posts: z.array(BlogPostZ).default([]), intro: IntroZ.default({}) })

export type BlogPost = z.infer<typeof BlogPostZ>
export type BlogsResponse = z.infer<typeof BlogsResponseZ>

export const BlogsService = {
  async list(params: { position?: string; shopDomain: string; maxResults?: number }) {
    const query = new URLSearchParams()
    if (params.position) query.set('position', params.position)
    query.set('shopDomain', params.shopDomain)
    if (params.maxResults) query.set('maxResults', String(params.maxResults))

    const res = await Http.get<unknown>(`/api/blog-posts?${query.toString()}`, { preferCache: true })
    const data = parseWithZod(BlogsResponseZ, res.data, 'blogs-response')
    return data
  },
}
