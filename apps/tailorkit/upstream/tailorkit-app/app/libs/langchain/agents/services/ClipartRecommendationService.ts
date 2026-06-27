import { findRelevantDocumentation } from '~/utils/openai-client.server'
import Template from '~/models/Template.server'
// import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { getClipartsDetailsByIds, loadTemplatesIndex } from '~/services/cliparts.server'
import type { ChatInvoker } from './ProductIntentAnalyzer'
// New: utilities for smarter positioning post-processing
import type { ClipartPositioning } from './ClipartPositionUtils'
import fetch from 'node-fetch'
import { detectPrintableArea } from '~/utils/printableArea'

export interface ClipartDocumentation {
  // name of the clipart
  clipart: string
  // Target audience of the clipart
  'Target audience': string
  // Product of the clipart
  Product: string
  // User Style of the clipart
  'User Style': string
  // supabase id of the clipart
  'Supabase ID': string
}

export interface ClipartRecommendation {
  templateId: string // The template _id for the clipart
  url: string
  alt: string
  position: {
    x: number // percentage from left
    y: number // percentage from top
  }
  dimensions: {
    width: number // percentage of product image width
    height: number // percentage of product image height
  }
  rotation: number // degrees
  reasoning: string
  /** True when we could not find a matching document and selected a random clipart from DB */
  isFallback?: boolean
}

/**
 * Service responsible for recommending clipart based on product data and determining optimal positioning
 */
export class ClipartRecommendationService {
  // eslint-disable-next-line no-useless-constructor
  constructor(private chatInvoker: ChatInvoker) {}

  /**
   * Get clipart recommendation for a product with AI-determined positioning
   */
  async recommendClipartForProduct(
    productData: {
      title?: string
      personalizationStyle?: string
      provider?: string
      variants?: string[]
    },
    productImageDimensions?: {
      width: number
      height: number
    },
    productImageUrl?: string,
    shop?: string,
    shopDescription?: string,
    shopData?: any,
    userQuery?: string
  ): Promise<ClipartRecommendation | null> {
    try {
      // Build search query from product data and user query - prioritize user intent
      const searchQuery = this.buildClipartSearchQuery(productData, shopDescription, userQuery)

      if (!searchQuery.trim()) {
        return null
      }

      // Find relevant clipart using RAG
      const { documents, searchError } = await findRelevantDocumentation(
        'match_clipart_documents',
        searchQuery,
        shop,
        shopData,
        {
          match_threshold: 0.2, // Lower threshold for more results
          match_count: 3, // Get top 3 matches
        }
      )

      // Decide which clipart to use: matched from RAG or fallback to a random template
      let actualClipart: any | null = null
      let isFallback = false

      if (!searchError && documents && documents.length > 0) {
        // Use first/best document from RAG, resolve to real template via name
        const matchedDoc = documents[0] as ClipartDocumentation
        actualClipart = await this.findActualClipart(matchedDoc.clipart)

        if (!actualClipart) {
          isFallback = true
          actualClipart = await this.pickRandomClipartTemplate()
        }
      } else {
        // No documents found: pick a random clipart/premade template from DB
        isFallback = true
        actualClipart = await this.pickRandomClipartTemplate()
      }

      if (!actualClipart) {
        return null
      }

      // Generate positioning based on product and clipart context. Use real dimensions when available.
      const positioning = await this.generateClipartPositioning(
        {
          productWidth: productImageDimensions?.width,
          productHeight: productImageDimensions?.height,
          clipartWidth: (actualClipart as any)?.dimension?.width,
          clipartHeight: (actualClipart as any)?.dimension?.height,
        },
        {
          product: productImageUrl || actualClipart.previewUrl, // fallback to clipart when no product image
          clipart: actualClipart.previewUrl,
        }
      )

      if (!positioning) {
        return null
      }

      return {
        templateId: actualClipart._id,
        url: actualClipart.previewUrl,
        alt: `${actualClipart.name} clipart for ${productData.title || 'product'}`,
        ...positioning,
        isFallback,
      }
    } catch (error) {
      console.error('[CLIPART] Error recommending clipart:', error)
      return null
    }
  }

  /**
   * Find the actual clipart template in the database
   */
  private async findActualClipart(clipartName: string): Promise<any> {
    try {
      // Prefer file-based index for exact/startsWith/contains
      const { index } = loadTemplatesIndex()
      if (Array.isArray(index) && index.length) {
        const name = (clipartName || '').trim()
        const exact = index.find(
          i => typeof i?.name === 'string' && new RegExp(`^${this.escapeRegex(name)}$`, 'i').test(i.name)
        )
        if (exact) {
          const [tpl] = await getClipartsDetailsByIds([], [String(exact._id || exact.id)], '')
          if (tpl) return tpl
        }
        const starts = index.find(
          i => typeof i?.name === 'string' && new RegExp(`^${this.escapeRegex(name)}`, 'i').test(i.name)
        )
        if (starts) {
          const [tpl] = await getClipartsDetailsByIds([], [String(starts._id || starts.id)], '')
          if (tpl) return tpl
        }
        const contains = index.find(
          i => typeof i?.name === 'string' && new RegExp(this.escapeRegex(name), 'i').test(i.name)
        )
        if (contains) {
          const [tpl] = await getClipartsDetailsByIds([], [String(contains._id || contains.id)], '')
          if (tpl) return tpl
        }
        // Word search
        for (const q of this.buildWordSearchQueries(name)) {
          const word = (q?.name?.$regex as string) || ''
          const hit = index.find(i => typeof i?.name === 'string' && new RegExp(word, 'i').test(i.name))
          if (hit) {
            const [tpl] = await getClipartsDetailsByIds([], [String(hit._id || hit.id)], '')
            if (tpl) return tpl
          }
        }
      }

      // Fallback to DB search (legacy)
      const cliparts = await Template.find({
        $and: [{ deletedAt: { $eq: null } }, { name: { $regex: this.escapeRegex(clipartName), $options: 'i' } }],
      })
        .select('_id name previewUrl type category dimension metadata')
        .sort({ createdAt: -1 })
        .limit(1)
        .lean()
      return cliparts?.[0] || null
    } catch (error) {
      console.error('[CLIPART] Error finding actual clipart:', error)
      return null
    }
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Build search queries for individual words
   */
  private buildWordSearchQueries(clipartName: string): any[] {
    const words = clipartName
      .split(/\s+/)
      .filter(word => word.length > 2) // Skip very short words
      .slice(0, 3) // Limit to first 3 words

    return words.map(word => ({
      name: { $regex: this.escapeRegex(word), $options: 'i' },
    }))
  }

  /**
   * Build search query prioritizing user query, then product data and personalization style
   */
  private buildClipartSearchQuery(
    productData: {
      title?: string
      personalizationStyle?: string
      provider?: string
      variants?: string[]
    },
    shopDescription?: string,
    userQuery?: string
  ): string {
    const parts: string[] = []

    // Primary: user query (highest priority - specific user intent)
    if (userQuery && userQuery.trim()) {
      parts.push(`${userQuery.trim()}`)
    }

    // Secondary: personalization style (if no user query or as additional context)
    if (productData.personalizationStyle) {
      parts.push(productData.personalizationStyle)
    }

    // Quinary: shop description
    if (shopDescription) {
      parts.push(`.Shop description: ${shopDescription}`)
    }

    return parts.join(' ').trim()
  }

  /**
   * NEW: Fast, deterministic placement based on lowest-edge-energy region.
   * If for any reason the local heuristic fails we fall back to the old
   * (costly) OpenAI Vision routine.
   */
  private async generateClipartPositioning(
    imageDimensions?: {
      productWidth?: number
      productHeight?: number
      clipartWidth?: number
      clipartHeight?: number
    },
    imageUrls?: {
      product: string
      clipart: string
    }
  ): Promise<ClipartPositioning | null> {
    // 0A. Try silhouette-based largest inscribed rect (background detection + LIR) ---
    if (imageUrls?.product) {
      try {
        const buf = Buffer.from(await (await fetch(imageUrls.product)).arrayBuffer())
        const printable = await detectPrintableArea(buf, undefined, { debug: false })

        /**
         * Preserve clipart aspect-ratio:
         * 1. Work out how much we can scale the original clipart down so that it
         *    fits inside the printable rectangle.
         * 2. Centre it within that rectangle.
         * 3. Return the resulting absolute position/dimensions.
         */

        let targetWidth = printable.width
        let targetHeight = printable.height

        // Preserve aspect ratio and avoid distortion when clipart dimensions are known
        if (imageDimensions?.clipartWidth && imageDimensions?.clipartHeight) {
          const fitMargin = 0.96 // small inset so artwork stays inside the printable body
          const widthScale = (printable.width * fitMargin) / imageDimensions.clipartWidth
          const heightScale = (printable.height * fitMargin) / imageDimensions.clipartHeight

          // Use the smaller scale to make sure we fit on both axes (never upscale)
          const scale = Math.min(widthScale, heightScale, 1)

          targetWidth = Math.round(imageDimensions.clipartWidth * scale)
          targetHeight = Math.round(imageDimensions.clipartHeight * scale)
        }

        // Anchor horizontally centered, vertically top-aligned to preserve Y when resizing
        // Preserve anchors: left-aligned and top-aligned inside printable rect
        let offsetX = printable.x
        let offsetY = printable.y
        // Clamp to keep inside boundaries
        const maxX = printable.x + printable.width - targetWidth
        const maxY = printable.y + printable.height - targetHeight
        if (offsetX > maxX) offsetX = Math.max(printable.x, maxX)
        if (offsetY > maxY) offsetY = Math.max(printable.y, maxY)

        const positioning: ClipartPositioning = {
          position: { x: offsetX, y: offsetY },
          dimensions: { width: targetWidth, height: targetHeight },
          rotation: 0,
          reasoning: 'Inside product silhouette (background detection + largest-rect approach, aspect-ratio preserved)',
        }

        return positioning
      } catch (err) {
        console.warn('[CLIPART] Silhouette positioning failed, fallback:', err)
        // Continue to flat-region fallback
      }
    }

    return null
  }

  /**
   * Pick a random clipart/premade template from the database to use as fallback
   */
  private async pickRandomClipartTemplate(): Promise<any | null> {
    try {
      // Prefer a random file-based item from list
      // Use local file-based index for randomness
      const index = loadTemplatesIndex().index
      const all = Array.isArray(index) ? index : []
      if (all.length) {
        const pick = all[Math.floor(Math.random() * all.length)]
        const [tpl] = await getClipartsDetailsByIds([], [String(pick._id || pick.id)], '')
        if (tpl) return tpl
      }

      // Fallback to latest DB
      const latest = await Template.find({ deletedAt: { $eq: null } })
        .select('_id name previewUrl type category dimension metadata')
        .sort({ createdAt: -1 })
        .limit(1)
        .lean()
      return latest?.[0] || null
    } catch (error) {
      console.error('[CLIPART] Error picking random clipart template:', error)
      return null
    }
  }
}
