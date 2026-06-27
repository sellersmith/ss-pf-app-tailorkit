import { PrintifyService } from './PrintifyService'
import { ShopifyService } from './ShopifyService'
import { ContextBuilder } from './ContextBuilder'
import { ClipartRecommendationService } from './ClipartRecommendationService'
import type { ChatInvoker } from './ProductIntentAnalyzer'
import { getImageSizeFromUrl } from '~/shopify/graphql/files/fns.server'
import { ChatOpenAI } from '@langchain/openai'
import Provider from '~/models/Provider.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import type { ProviderDocument } from '~/models/Provider'
import { findRelevantDocumentation } from '~/utils/openai-client.server'

// Status messages for streaming
const STATUS_MESSAGES = {
  ANALYZING_STORE_AND_PRODUCTS: 'analyzing-your-store',
  CREATING_PERSONALIZED_PRODUCT_RECOMMENDATION: 'creating-personalized-product-recommendation',
  FINDING_PERFECT_CLIPART_FOR_YOUR_PRODUCT: 'finding-perfect-clipart-for-your-product',
} as const

/**
 * Service responsible for orchestrating the entire product recommendation flow
 */
export class ProductRecommendationService {
  private printifyService: PrintifyService
  private contextBuilder: ContextBuilder
  private clipartService: ClipartRecommendationService
  private chatInvoker: ChatInvoker

  constructor(chatInvoker: ChatInvoker) {
    this.printifyService = new PrintifyService(chatInvoker)
    this.contextBuilder = new ContextBuilder()
    this.clipartService = new ClipartRecommendationService(chatInvoker)
    this.chatInvoker = chatInvoker
  }

  /**
   * Handle product recommendation with full orchestration
   */
  async handleProductRecommendation(
    query: string,
    context: any,
    isStreaming: boolean,
    searchQuery: string,
    onChunk?: (chunk: string) => void,
    chatInvoker?: ChatInvoker
  ): Promise<string> {
    // Status handling for streaming
    if (isStreaming && onChunk) {
      await this.emitStatus(onChunk, STATUS_MESSAGES.ANALYZING_STORE_AND_PRODUCTS, 200)
    }

    // Create ShopifyService instance with context
    const shopifyService = new ShopifyService(context?.shopifyAdmin, context?.shopDomain, context?.accessToken)
    // Get comprehensive shop information for analysis
    let shopDescription = ''
    if (shopifyService.isAvailable) {
      const shopInfo = await shopifyService.getShopInfo()
      shopDescription = shopifyService.combineShopContext(context?.shopData || {}, shopInfo)
    } else {
      shopDescription = this.combineShopContext(context?.shopData || {})
    }

    // Enhanced product fetching with Printify fallback
    const { topProduct, hasProducts, productSource, provider, matchedSearch } = await this.fetchProductByQuery(
      shopifyService,
      shopDescription,
      searchQuery
    )
    const caseType = hasProducts ? 1 : 2
    const analysisData = this.contextBuilder.generateProductAnalysis(
      context?.shopData,
      caseType,
      topProduct,
      productSource
    )

    if (isStreaming && onChunk) {
      await this.emitStatus(onChunk, STATUS_MESSAGES.CREATING_PERSONALIZED_PRODUCT_RECOMMENDATION, 200)
    }

    // Generate AI response with source context
    const cardId = `product_${Date.now()}`
    const contextMessage = this.contextBuilder.buildProductContext(
      analysisData,
      cardId,
      !isStreaming,
      searchQuery,
      productSource,
      matchedSearch
    )

    // Parallelize AI response generation and user style fetching for better performance
    const [aiResponse, userStyleResult] = await Promise.allSettled([
      this.generateAIResponse(query, contextMessage, isStreaming, onChunk, chatInvoker),
      this.fetchAndProcessUserStyle({
        query: searchQuery || query,
        shopDescription,
        shopDomain: context?.shopData?.shopDomain,
        shopData: context?.shopData,
        topProductTitle: analysisData.topProduct?.title,
      }),
    ])

    // Handle AI response result
    let finalAiResponse = ''
    if (aiResponse.status === 'fulfilled') {
      finalAiResponse = aiResponse.value
    } else {
      console.error('[PRODUCT_RECOMMENDATION] AI response generation failed:', aiResponse.reason)
      finalAiResponse = "I'll help you create a personalized product."
    }

    // Handle user style result
    let userStyle: string | null = null
    if (userStyleResult.status === 'fulfilled') {
      userStyle = userStyleResult.value
    } else {
      console.error('[PRODUCT_RECOMMENDATION] User style processing failed:', userStyleResult.reason)
    }

    // If user requested something specific and we didn't match it, append a clear notice
    if (searchQuery && matchedSearch === false) {
      // const fallbackNotice = this.contextBuilder.buildProductFallbackNotice({
      //   searchQuery,
      //   productSource,
      //   fallbackTitle: analysisData.topProduct?.title,
      // })
      // if (isStreaming && onChunk) {
      //   onChunk(`\n${fallbackNotice}\n`)
      // } else {
      //   finalAiResponse += `\n${fallbackNotice}`
      // }
    }

    // Build product data with fetched user style
    const productData = this.contextBuilder.buildProductCardData(
      cardId,
      analysisData,
      topProduct,
      caseType,
      provider,
      userStyle
    )

    // Add clipart recommendation
    if (topProduct && (topProduct.title || topProduct.description || productData.personalizationStyle)) {
      if (isStreaming && onChunk) {
        await this.emitStatus(onChunk, STATUS_MESSAGES.FINDING_PERFECT_CLIPART_FOR_YOUR_PRODUCT, 200)
      }

      try {
        // Determine actual image dimensions with optimized approach
        let productImageDimensions: { width: number; height: number }

        if (topProduct?.featuredImage?.width && topProduct?.featuredImage?.height) {
          productImageDimensions = {
            width: topProduct.featuredImage.width,
            height: topProduct.featuredImage.height,
          }
        } else {
          // Skip slow URL probing and use intelligent defaults based on product source
          if (productSource === EPROVIDER.PRINTIFY) {
            // Printify products typically use 800x800 for apparel, 600x600 for accessories
            productImageDimensions = { width: 800, height: 800 }
          } else {
            // Standard default for Shopify products
            productImageDimensions = { width: 400, height: 400 }
          }

          // Optional: Add URL probing as a non-blocking background task for future optimization
          // This won't delay the current response but can be used for caching
          const probeUrl = topProduct?.featuredImage?.url || topProduct?.mockupImage?.url
          if (probeUrl) {
            // Fire and forget - don't await this
            this.probeDimensionsInBackground(probeUrl).catch(() => {
              // Silently ignore errors in background task
            })
          }
        }

        const productImageUrl = topProduct?.featuredImage?.url || topProduct?.mockupImage?.url

        const clipartData = await this.clipartService.recommendClipartForProduct(
          {
            title: productData.title,
            personalizationStyle: productData.personalizationStyle,
            provider: productSource === EPROVIDER.PRINTIFY ? EPROVIDER.PRINTIFY : undefined,
            variants: productData.variants,
          },
          productImageDimensions,
          productImageUrl,
          context?.shopData?.shopDomain,
          shopDescription,
          context?.shopData,
          query
        )

        if (clipartData) {
          // Add clipart data to product
          productData.clipart = {
            templateId: clipartData.templateId,
            url: clipartData.url,
            alt: clipartData.alt,
            position: clipartData.position,
            dimensions: clipartData.dimensions,
            rotation: clipartData.rotation,
            reasoning: clipartData.reasoning,
            isFallback: clipartData.isFallback,
          }

          // If we fell back to a random clipart, transparently inform the user
          if (clipartData.isFallback) {
            const fallbackNotice = this.contextBuilder.buildClipartFallbackNotice({
              requestedStyle: productData.personalizationStyle,
              userQuery: searchQuery || query,
            })
            if (isStreaming && onChunk) {
              onChunk(`\n${fallbackNotice}\n`)
            } else {
              finalAiResponse += `\n${fallbackNotice}`
            }
          }
        }
      } catch (error) {
        console.error('[CLIPART] Error getting clipart recommendation:', error)
      }
    }

    if (isStreaming && onChunk) {
      onChunk('[STATUS][COMPLETE][/STATUS]')
    }

    const productDataChunk = `\nPRODUCT_DATA:${JSON.stringify(productData)}`

    if (isStreaming && onChunk) {
      onChunk(productDataChunk)
    }

    return finalAiResponse + productDataChunk
  }

  /**
   * Fetch user style from RAG and process it with AI summarization in one optimized call
   */
  private async fetchAndProcessUserStyle(args: {
    query?: string
    shopDescription?: string
    shopDomain?: string
    shopData?: any
    topProductTitle?: string
  }): Promise<string | null> {
    const { query, shopDescription, shopDomain, shopData, topProductTitle } = args

    try {
      // Fetch user style from RAG
      const userStyle = await this.fetchUserStyleFromRAG({
        query,
        shopDescription,
        shopDomain,
        shopData,
      })

      // If no style found, return null early
      if (!userStyle || !userStyle.trim()) {
        return null
      }

      // Post-process user style via AI to produce a concise evaluation
      const conciseStyle = await this.summarizePersonalizationStyle({
        userStyle,
        shopDescription,
        query,
        topProductTitle,
      })

      return conciseStyle && conciseStyle.trim() ? conciseStyle.trim() : userStyle
    } catch (error) {
      console.error('[PRODUCT_RECOMMENDATION] Error in fetchAndProcessUserStyle:', error)
      return null
    }
  }

  /**
   * Use AI to evaluate and summarize raw personalization style tags into a concise, natural prose description.
   */
  private async summarizePersonalizationStyle(args: {
    userStyle: string
    shopDescription?: string
    query?: string
    topProductTitle?: string
  }): Promise<string | null> {
    const { userStyle, shopDescription, query, topProductTitle } = args

    if (!this.chatInvoker) return userStyle

    const prompt = `You are evaluating a store's personalization style.

INPUTS:
- Raw style tags/phrases (may be bullet points or comma-separated):
${userStyle}
${
  topProductTitle
    ? `- Product: ${topProductTitle}
`
    : ''
}${
      shopDescription
        ? `- Store description: ${shopDescription}
`
        : ''
    }${
      query
        ? `- User intent: ${query}
`
        : ''
    }

TASK:
- Write a short, marketable style evaluation in 1–2 sentences (roughly 25–60 words).
- Capture the mood/feel and who it's perfect for (audience/occasion), and why it makes a thoughtful gift or keepsake.
- Use natural prose. No bullets, no lists, no headings, no emojis.

OUTPUT:
- Return ONLY the prose (no surrounding quotes).`

    try {
      const messages = this.chatInvoker.buildMessages(prompt)
      // Use a smaller, faster model instance specifically for this summarization
      const fastChat = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4.1-nano', // Use faster, cheaper model for simple summarization
        temperature: 0.2,
        maxTokens: 180, // Reduce token limit for faster response
      })
      const result = await fastChat.invoke(messages)
      const response = (result as any)?.content
      const raw
        = typeof response === 'string'
          ? response.trim()
          : Array.isArray(response)
            ? response
                .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
                .join(' ')
                .trim()
            : ''
      if (!raw) return null
      // Take first paragraph, strip leading bullets/dashes/quotes, trim
      const firstParagraph = raw.split(/\n{2,}/)[0]
      const cleaned = firstParagraph
        .replace(/^\s*["'`]+/, '')
        .replace(/["'`]+\s*$/, '')
        .replace(/^\s*[-•\s]+/, '')
        .trim()
      return cleaned || null
    } catch (err) {
      console.error('[PRODUCT_RECOMMENDATION] summarizePersonalizationStyle error:', err)
      return null
    }
  }

  /**
   * Enhanced product fetching with Printify integration
   */
  private async fetchProductByQuery(
    shopifyService: ShopifyService,
    shopDescription: string,
    searchQuery?: string
  ): Promise<{
    topProduct: any
    hasProducts: boolean
    productSource: 'shopify' | EPROVIDER
    provider: ProviderDocument | null
    matchedSearch: boolean
  }> {
    try {
      // First try Shopify
      if (shopifyService.isAvailable) {
        const shopifyResult = await shopifyService.fetchProductByQuery(searchQuery)
        if (shopifyResult.hasProducts) {
          return { ...shopifyResult, provider: null }
        }

        // Guard: If the store has any Shopify products (regardless of search), do not fallback to Printify
        const anyProducts = await shopifyService.getAnyProduct()
        if (anyProducts) {
          return {
            topProduct: anyProducts,
            hasProducts: true,
            productSource: 'shopify',
            provider: null,
            matchedSearch: false,
          }
        }
      }

      // No Shopify products found - search Printify based on shop metadata
      console.log('No Shopify products found, searching Printify...')

      const printifyProduct = await this.printifyService.searchPrintifyProducts(searchQuery || '', shopDescription)
      const provider = await Provider.findOne({ name: EPROVIDER.PRINTIFY })

      if (printifyProduct) {
        return {
          topProduct: printifyProduct,
          hasProducts: false, // No Shopify products, but we found Printify
          productSource: EPROVIDER.PRINTIFY,
          provider,
          matchedSearch: false,
        }
      }

      return { topProduct: null, hasProducts: false, productSource: 'shopify', provider: null, matchedSearch: false }
    } catch (error) {
      console.error('Error fetching product:', error)
      return { topProduct: null, hasProducts: false, productSource: 'shopify', provider: null, matchedSearch: false }
    }
  }

  /**
   * Generate AI response (centralized)
   */
  private async generateAIResponse(
    query: string,
    contextMessage: string,
    isStreaming: boolean,
    onChunk?: (chunk: string) => void,
    chatInvoker?: ChatInvoker
  ): Promise<string> {
    if (!chatInvoker) {
      throw new Error('ChatInvoker is required for AI response generation')
    }

    const messages = chatInvoker.buildMessages(query)
    messages.push({ role: 'system', content: contextMessage } as any)

    if (isStreaming && onChunk && chatInvoker.streamChat) {
      let fullResponse = ''
      try {
        const stream = await chatInvoker.streamChat(messages)
        for await (const chunk of stream) {
          const content = chunk.content
          if (typeof content === 'string' && content) {
            fullResponse += content
            onChunk(content)
          }
        }
        return fullResponse
      } catch (error) {
        console.error('Streaming error:', error)
        const fallback = `I'll help you create a personalized product.`
        onChunk(fallback)
        return fallback
      }
    } else {
      return chatInvoker.invokeChat(messages)
    }
  }

  /**
   * Status emission helper with reduced delays for better performance
   */
  private async emitStatus(onChunk: (chunk: string) => void, message: string, delay: number): Promise<void> {
    onChunk(`[STATUS]${message}[/STATUS]`)
    // Reduce delay from 200ms to 50ms for faster response
    await new Promise(resolve => setTimeout(resolve, Math.min(delay, 50)))
  }

  /**
   * Background task to probe image dimensions for future caching (non-blocking)
   */
  private async probeDimensionsInBackground(imageUrl: string): Promise<void> {
    try {
      const dimensions = await getImageSizeFromUrl(imageUrl)
      // Here you could store dimensions in a cache for future use
      console.log(`[BACKGROUND] Probed dimensions for ${imageUrl}:`, dimensions)
    } catch (error) {
      // Silently fail - this is a background optimization
    }
  }

  /**
   * Fallback shop context combining method
   */
  private combineShopContext(shopData: any): string {
    const shopDescription = shopData?.shopDescription || ''
    const shopName = shopData?.shopName || ''
    const shopDomain = shopData?.shopDomain || ''

    return [shopDescription, shopName, shopDomain].filter(desc => desc && desc.trim().length > 0).join(' ')
  }

  /**
   * Fetch user style from clipart RAG based on query parameters
   */
  private async fetchUserStyleFromRAG(args: {
    query?: string
    shopDescription?: string
    shopDomain?: string
    shopData?: any
    matchOptions?: {
      match_threshold?: number
      match_count?: number
    }
  }): Promise<string | null> {
    const { query, shopDescription, shopDomain, shopData, matchOptions = {} } = args

    try {
      // Build search query from available parameters
      const searchQuery = this.buildStyleSearchQuery({ query, shopDescription })

      if (!searchQuery.trim()) {
        return null
      }

      // Find relevant clipart documentation using RAG
      const { documents, searchError } = await findRelevantDocumentation(
        'match_clipart_documents',
        searchQuery,
        shopDomain,
        shopData,
        {
          match_threshold: matchOptions.match_threshold || 0.2,
          match_count: matchOptions.match_count || 1, // Only need the best match for style
        }
      )

      if (searchError || !documents || documents.length === 0) {
        return null
      }

      // Return the user_style from the best matching document
      const bestDocument = documents[0]
      return bestDocument['User Style'] || bestDocument.user_style || null
    } catch (error) {
      console.error('[PRODUCT_RECOMMENDATION] Error fetching user style from RAG:', error)
      return null
    }
  }

  /**
   * Build search query for style-focused RAG retrieval
   */
  private buildStyleSearchQuery(params: { query?: string; shopDescription?: string }): string {
    const { query, shopDescription } = params
    const parts: string[] = []

    // Primary: explicit query if provided
    if (query) {
      parts.push(query)
    }

    // Secondary: shop description for context
    if (shopDescription) {
      parts.push(shopDescription)
    }

    // Add style-specific keywords to improve matching
    if (parts.length > 0) {
      parts.push('personalization style customization')
    }

    return parts.join(' ').trim()
  }
}
