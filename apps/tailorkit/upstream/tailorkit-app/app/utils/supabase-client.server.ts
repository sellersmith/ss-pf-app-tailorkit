/* eslint-disable max-lines */
/* eslint-disable max-len */
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'
import { getShopData } from '~/models/Shop.server'
import { BLOG_PROVIDER_URL, DOCUMENTATION_WEB_APP_URL } from '~/routes/api.google-sheet/constants'
import { generateEmbedding } from './openai-client.server'

// Create a Supabase client for the vector database
const supabaseClient = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)

export default supabaseClient

// Define types for documentation sync
interface DocumentationRecord {
  Title?: string
  'Supabase ID'?: string
  Content?: string
  Category?: string
  Action?: string
  // Sheet row index (1-based). Used by Apps Script callback to match stable sheet
  // row and avoid the Title-collision bug that caused duplicate Supabase inserts.
  _rowIndex?: number
}

// Define function to add/edit documentation
export async function syncDocumentation() {
  // Request new and updated documentation from the Google web app
  const response = await fetch(`${DOCUMENTATION_WEB_APP_URL}?sheet=main-documentation`)
  const documents = (await response.json()) as DocumentationRecord[]

  // Add/edit documentation in the Supabase database
  const updatedDocuments: any[] = []

  for (let i = 0; i < documents.length; i++) {
    const document = documents[i]
    const title = document['Title']
    const id = document['Supabase ID']
    const content = document['Content']
    const category = document['Category']
    const action = document['Action']
    // Forward _rowIndex from Apps Script so the callback can write the Supabase ID
    // back to the exact sheet row instead of the first Title match (the bug that
    // caused ~10x duplicate rows for titles repeated across categories).
    const rowIndex = document._rowIndex

    if (action === 'Delete') {
      if (id) {
        // Remove an existing record from Supabase.
        await supabaseClient.from('documentation').delete().eq('id', id)

        updatedDocuments.push({ _rowIndex: rowIndex, Title: title, 'Supabase ID': id })
      }
    } else if (title && content && category) {
      // Generate embedding for vector search
      const embedding = await generateEmbedding(`${title} ${content}`)

      if (!id) {
        // Insert new document
        const { data, error } = await supabaseClient
          .from('documentation')
          .insert({
            title,
            content,
            category,
            embedding,
          })
          .select()

        if (error) {
          console.error('Error creating document:', error)
          return
        }

        updatedDocuments.push({ _rowIndex: rowIndex, Title: title, 'Supabase ID': data?.[0]?.id })
      } else {
        // Update existing document
        const { error } = await supabaseClient
          .from('documentation')
          .update({
            title,
            content,
            category,
            embedding,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        if (error) {
          console.error('Error updating document:', error)
          return
        }

        updatedDocuments.push({ _rowIndex: rowIndex, Title: title, 'Supabase ID': id })
      }
    }
  }

  // Update the Google web app with the new and updated documents
  await fetch(DOCUMENTATION_WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatedDocuments),
  })
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const buildStableBlogKey = (rawKey: string | null | undefined, title: string, buttonLink: string, image?: string) => {
  const incoming = rawKey?.trim()
  if (incoming) {
    return slugify(incoming)
  }

  const titleSlug = slugify(title)
  const hashSeed = `${title}::${buttonLink}::${image ?? ''}`
  const hash = createHash('sha1').update(hashSeed).digest('hex').slice(0, 10)

  const candidate = [titleSlug, hash].filter(Boolean).join('-')
  return candidate || hash
}

/**
 * Sync blog posts from the Google web app to the Supabase database
 * Uses clear/re-insert strategy as requested by user
 */
export async function syncBlogPosts() {
  try {
    // Request blog posts from the blog provider
    const url = BLOG_PROVIDER_URL

    const response = await fetch(url)
    const responseText = await response.text()

    // Check if response is HTML (error page)
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      return {
        success: false,
        error: 'Google Apps Script returned HTML instead of JSON. Check script configuration.',
      }
    }

    let blogData: any
    try {
      blogData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError)
      return {
        success: false,
        error: `Invalid JSON response: ${parseError}`,
      }
    }

    let blogPosts = []

    if (Array.isArray(blogData)) {
      // Direct array format (like other documentation)
      blogPosts = blogData
    } else if (blogData.items) {
      blogPosts = blogData.items || []
    } else {
      console.error('Unexpected blog data format:', blogData)
      return { success: false, error: 'Unexpected data format from Google Apps Script' }
    }

    // Clear all existing blog posts (as requested - since blogs can be deleted)
    // Using TRUNCATE for maximum efficiency, but fallback to DELETE if permissions don't allow
    let deleteError
    try {
      // Try TRUNCATE first (fastest for large tables)
      const { error } = await supabaseClient.rpc('truncate_blog_posts')
      deleteError = error
    } catch {
      // Fallback to DELETE if TRUNCATE function doesn't exist or no permissions
      const { error } = await supabaseClient
        .from('blog_posts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      deleteError = error
    }

    if (deleteError) {
      console.error('Error clearing existing blog posts:', deleteError)
      return { success: false, error: deleteError }
    }

    // Process and insert new blog posts
    const insertedPosts: any[] = []

    for (const post of blogPosts) {
      const title = post.title
      const description = post.description
      const image = post.image
      const buttonText = post.buttonText
      const buttonLink = post.buttonLink
      const badgeContent = post.badgeContent
      const key = buildStableBlogKey(post.key, title, buttonLink, image)
      const position = post.position
      const startDate = post.startDate ? new Date(post.startDate).toISOString() : null
      const endDate = post.endDate ? new Date(post.endDate).toISOString() : null

      // Extract categories and tags if available (can be added to Google Sheet structure)
      const categories = post.categories ? post.categories.split(',').map((c: string) => c.trim()) : []
      const tags = post.tags ? post.tags.split(',').map((t: string) => t.trim()) : []
      const contentSummary = post.contentSummary || description

      // Skip rows that are missing required data
      if (title && description && image && buttonLink) {
        // Build embedding input combining title, description, categories, and tags
        const embeddingInput = [title, description, contentSummary, categories.join(' '), tags.join(' ')]
          .filter(Boolean)
          .join(' ')

        const embedding = await generateEmbedding(embeddingInput)

        // Insert or update blog post (idempotent on unique key)
        const { data, error } = await supabaseClient
          .from('blog_posts')
          .upsert(
            {
              title,
              description,
              image,
              button_text: buttonText,
              button_link: buttonLink,
              badge_content: badgeContent,
              key,
              position, // This will map to the "position" column (quoted in schema)
              start_date: startDate,
              end_date: endDate,
              categories,
              tags,
              content_summary: contentSummary,
              embedding,
              published_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          )
          .select()

        if (error) {
          console.error('Error inserting blog post:', error)
          continue
        }

        insertedPosts.push(data?.[0])
      }
    }

    return { success: true, count: insertedPosts.length }
  } catch (error) {
    console.error('Error syncing blog posts:', error)
    return { success: false, error }
  }
}

/**
 * Sync tutorials from Google Apps Script to local JSON file
 * Saves to public/app-tutorials/editor-tab-guide.json
 */
export async function syncTutorials() {
  try {
    // Request tutorials from the Google web app
    const url = `${DOCUMENTATION_WEB_APP_URL}?sheet=editor-tab-guide`

    const response = await fetch(url)
    const responseText = await response.text()

    // Check if response is HTML (error page)
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      return {
        success: false,
        error: 'Google Apps Script returned HTML instead of JSON. Check script configuration.',
      }
    }

    let tutorialsData: any
    try {
      tutorialsData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError)
      return {
        success: false,
        error: `Invalid JSON response: ${parseError}`,
      }
    }

    let tutorials = []

    if (Array.isArray(tutorialsData)) {
      // Direct array format (like other documentation)
      tutorials = tutorialsData
    } else if (tutorialsData.items) {
      tutorials = tutorialsData.items || []
    } else {
      console.error('Unexpected tutorials data format:', tutorialsData)
      return { success: false, error: 'Unexpected data format from Google Apps Script' }
    }

    // Process tutorials data
    const processedTutorials: any[] = []

    for (const tutorial of tutorials) {
      // Google Apps Script sheet returns columns like:
      // "Video title", "Thumbnail", "Youtube link", "CDN link", "Duration"
      const title = tutorial['Video title'] || tutorial.title || ''
      const thumbnail = tutorial['Thumbnail'] || tutorial.thumbnail || ''
      const youtubeUrl = tutorial['Youtube link'] || tutorial.youtubeUrl || tutorial.youtube || ''
      const cdnUrl = tutorial['CDN link'] || tutorial.cdnUrl || tutorial.cdn || ''
      const duration = tutorial['Duration'] || tutorial.duration || ''

      // Skip rows that are missing required data
      if (title && thumbnail) {
        processedTutorials.push({
          id: `tutorial-${processedTutorials.length + 1}`,
          title,
          thumbnail,
          youtubeUrl,
          cdnUrl,
          duration,
        })
      }
    }

    // Save to local JSON file
    const filePath = path.join(process.cwd(), 'public', 'app-tutorials', 'editor-tab-guide.json')

    // Ensure directory exists
    const dirPath = path.dirname(filePath)
    await fs.mkdir(dirPath, { recursive: true })

    // Write tutorials to file
    await fs.writeFile(filePath, JSON.stringify(processedTutorials, null, 2), 'utf-8')

    console.log(`Successfully synced ${processedTutorials.length} tutorials to ${filePath}`)
    return { success: true, count: processedTutorials.length }
  } catch (error) {
    console.error('Error syncing tutorials:', error)
    return { success: false, error }
  }
}

/**
 * Get tutorials from local JSON file (latest first)
 */
export async function getTutorials(limit: number = 10) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'app-tutorials', 'editor-tab-guide.json')

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch (accessError) {
      // File doesn't exist, return empty array
      console.error('Tutorials file not found at:', filePath)
      console.error('Access error:', accessError)
      return []
    }

    // Read and parse the file
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const tutorials = JSON.parse(fileContent)

    if (!Array.isArray(tutorials)) {
      console.error('Invalid tutorials data format, not an array')
      return []
    }

    // Sort by publishedAt (latest first) and limit
    const sortedTutorials = tutorials
      .sort((a, b) => {
        const dateA = new Date(a.publishedAt || 0).getTime()
        const dateB = new Date(b.publishedAt || 0).getTime()
        return dateB - dateA
      })
      .slice(0, limit)

    // Map to UI-friendly shape used by TutorialsToolPanel
    const mapped = sortedTutorials.map((tutorial: any) => ({
      id: tutorial.id,
      name: tutorial.title,
      thumbnail: tutorial.thumbnail,
      youtubeUrl: tutorial.youtubeUrl || '',
      duration: tutorial.duration || undefined,
    }))

    return mapped
  } catch (error) {
    console.error('Error getting tutorials:', error)
    return []
  }
}
/**
 * Get personalized blog posts for a shop using RAG technique
 */
export async function getPersonalizedBlogPosts(
  shopDomain: string,
  position: string = 'Dashboard',
  maxResults: number = 2
) {
  try {
    // Get shop metadata for personalization
    const shop = await getShopData(shopDomain)
    if (!shop || !shop.metadata) {
      // No metadata → 0 personalized → return latest 3
      const { data, error } = await supabaseClient.rpc('get_latest_blog_posts', {
        post_count: 3,
        target_position: position,
        exclude_ids: [],
      })
      if (error) {
        console.error('Error getting latest blog posts (no metadata):', error)
        return { posts: [], intro: {} }
      }
      return { posts: data || [], intro: {} }
    }

    const { shopDescription, shopCategories } = shop.metadata

    // Create embedding query from shop metadata
    const queryText = [
      shopDescription || '',
      Array.isArray(shopCategories) ? shopCategories.join(' ') : shopCategories || '',
    ]
      .filter(Boolean)
      .join(' ')

    if (!queryText.trim()) {
      // Empty metadata → latest 3
      const { data, error } = await supabaseClient.rpc('get_latest_blog_posts', {
        post_count: 3,
        target_position: position,
        exclude_ids: [],
      })
      if (error) {
        console.error('Error getting latest blog posts (empty metadata):', error)
        return { posts: [], intro: {} }
      }
      return { posts: data || [], intro: {} }
    }

    const queryEmbedding = await generateEmbedding(queryText)

    // Get up to 2 personalized blog posts using vector similarity
    const { data: personalizedPosts, error } = await supabaseClient.rpc('match_personalized_blog_posts', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5, // Adjust threshold as needed
      match_count: 2,
      target_position: position,
    })

    if (error) {
      console.error('Error getting personalized blog posts:', error)
      // Fallback to latest 3
      const { data } = await supabaseClient.rpc('get_latest_blog_posts', {
        post_count: 3,
        target_position: position,
        exclude_ids: [],
      })
      return { posts: data || [], intro: {} }
    }

    const personalizedCount = personalizedPosts?.length || 0

    if (personalizedCount >= 2) {
      return { posts: (personalizedPosts || []).slice(0, 2), intro: {} }
    }

    if (personalizedCount === 1) {
      const excludeIds = [personalizedPosts![0].id]
      const { data: latest2, error: latestErr } = await supabaseClient.rpc('get_latest_blog_posts', {
        post_count: 2,
        target_position: position,
        exclude_ids: excludeIds,
      })
      if (latestErr) {
        console.error('Error getting latest blog posts (1 personalized):', latestErr)
        return { posts: personalizedPosts || [], intro: {} }
      }
      return { posts: [...(personalizedPosts || []), ...(latest2 || [])], intro: {} }
    }

    // 0 personalized → latest 3
    const { data: latest3, error: latestErr3 } = await supabaseClient.rpc('get_latest_blog_posts', {
      post_count: 3,
      target_position: position,
      exclude_ids: [],
    })
    if (latestErr3) {
      console.error('Error getting latest blog posts (0 personalized):', latestErr3)
      return { posts: [], intro: {} }
    }
    return { posts: latest3 || [], intro: {} }
  } catch (error) {
    console.error('Error in getPersonalizedBlogPosts:', error)
    // Fallback to latest 3 on unexpected errors
    const { data } = await supabaseClient.rpc('get_latest_blog_posts', {
      post_count: 3,
      target_position: position,
      exclude_ids: [],
    })
    return { posts: data || [], intro: {} }
  }
}

/**
 * Fallback function to get latest blog posts when personalization fails
 */
export async function getLatestBlogPosts(position: string = 'Dashboard', maxResults: number = 2) {
  try {
    const { data, error } = await supabaseClient.rpc('get_latest_blog_posts', {
      post_count: maxResults,
      target_position: position,
      exclude_ids: [],
    })

    if (error) {
      console.error('Error getting latest blog posts:', error)
      return { posts: [], intro: {} }
    }

    return { posts: data || [], intro: {} }
  } catch (error) {
    console.error('Error in getLatestBlogPosts:', error)
    return { posts: [], intro: {} }
  }
}

/**
 * Sync onboarding products from Google Apps Script to local JSON file
 * Saves to public/products-onboarding.json
 */
export async function syncOnboardingProducts() {
  try {
    // Request onboarding products from the Google web app
    const url = `${DOCUMENTATION_WEB_APP_URL}?sheet=dummy-for-onboarding`

    const response = await fetch(url)
    const responseText = await response.text()

    // Check if response is HTML (error page)
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      return {
        success: false,
        error: 'Google Apps Script returned HTML instead of JSON. Check script configuration.',
      }
    }

    let onboardingData: any
    try {
      onboardingData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError)
      return {
        success: false,
        error: `Invalid JSON response: ${parseError}`,
      }
    }

    let categories = []

    if (Array.isArray(onboardingData)) {
      // Direct array format from Google Apps Script
      categories = onboardingData
    } else if (onboardingData.items) {
      categories = onboardingData.items || []
    } else {
      console.error('Unexpected onboarding data format:', onboardingData)
      return { success: false, error: 'Unexpected data format from Google Apps Script' }
    }

    // Process categories data - sort by priority and clean up products
    const processedCategories: any[] = []

    for (const category of categories) {
      const priority = category.priority || ''
      const clipartCategory = category.clipartCategory || ''
      const products = category.products || []

      // Skip categories that are missing required data
      if (clipartCategory) {
        // Filter out empty products and clean up data
        const cleanProducts = products
          .filter((product: any) => product.productTitle?.trim() || product.tailorkitClipart?.trim())
          .map((product: any) => ({
            productTitle: product.productTitle?.trim() || '',
            productCDNLink: product.productCDNLink?.trim() || '',
            productDescription: product.productDescription?.trim() || '',
            tailorkitClipart: product.tailorkitClipart?.trim() || '',
            templateId: product.templateId?.trim() || '', // Preserve Template ID if present
          }))

        processedCategories.push({
          priority: priority.trim(),
          clipartCategory: clipartCategory.trim(),
          products: cleanProducts,
        })
      }
    }

    // Sort categories by priority (assuming numeric priority, with empty/invalid as lowest)
    processedCategories.sort((a, b) => {
      const priorityA = parseInt(a.priority) || 999999
      const priorityB = parseInt(b.priority) || 999999
      return priorityA - priorityB
    })

    // Save to local JSON file
    const filePath = path.join(process.cwd(), 'public', 'products-onboarding.json')

    // Ensure directory exists
    const dirPath = path.dirname(filePath)
    await fs.mkdir(dirPath, { recursive: true })

    // Write onboarding products to file
    await fs.writeFile(filePath, JSON.stringify(processedCategories, null, 2), 'utf-8')

    console.log(`Successfully synced ${processedCategories.length} onboarding categories to ${filePath}`)
    return { success: true, count: processedCategories.length }
  } catch (error) {
    console.error('Error syncing onboarding products:', error)
    return { success: false, error }
  }
}

/**
 * Get onboarding products from local JSON file
 */
export async function getOnboardingProducts() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'products-onboarding.json')

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch (accessError) {
      // File doesn't exist, return empty array
      console.error('Onboarding products file not found at:', filePath)
      console.error('Access error:', accessError)
      return []
    }

    // Read and parse the file
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const categories = JSON.parse(fileContent)

    if (!Array.isArray(categories)) {
      console.error('Invalid onboarding products data format, not an array')
      return []
    }

    // Return categories as-is (already sorted by priority during sync)
    return categories
  } catch (error) {
    console.error('Error getting onboarding products:', error)
    return []
  }
}

/**
 * Sync the clipart documentation from the Google web app to the Supabase database
 */
export async function syncClipartDocumentation() {
  // Request new and updated clipart documentation from the Google web app
  // Pass the sheet name so the Google Apps Script can route the request
  const response = await fetch(`${DOCUMENTATION_WEB_APP_URL}?sheet=clipart-documentation`)
  const documents = (await response.json()) as Array<Record<string, unknown>>

  // Prepare array to notify Google Apps Script which rows have been processed / updated
  const updatedDocuments: any[] = []

  for (let i = 0; i < documents.length; i++) {
    const document = documents[i]

    const clipart = String(document['Clipart'] || '')
    const id = String(document['Supabase ID'] || '')
    const templateId = String(document['Template ID'] || '').trim() // Support Template ID column
    // Forward _rowIndex to avoid Clipart-name collision bug during callback matching.
    const rowIndex = typeof document._rowIndex === 'number' ? document._rowIndex : undefined
    const targetAudience = String(document['Target audience'] || '')
    const context = String(document['Context'] || '')
    const userStyle = String(document['User Style'] || '')
    const category = String(document['Category'] || '')

    // NEW: Parse Product Type column
    const productType
      = String(document['Product Type'] || '')
        .trim()
        .toLowerCase() || null

    // Skip rows that are missing required data
    if (clipart && targetAudience && context && userStyle) {
      // Build structured embedding input with labels for better semantic understanding
      const embeddingInput = `
Name: ${clipart}
Target Audience: ${targetAudience}
Context: ${context}
Style: ${userStyle}
Category: ${category || 'general'}
Product Type: ${productType || 'general'}
`.trim()

      const embedding = await generateEmbedding(embeddingInput)

      if (!id) {
        // Insert new clipart document
        const insertPayload = {
          clipart,
          target_audience: targetAudience,
          context,
          user_style: userStyle,
          category,
          product_type: productType, // NEW: Store product type
          embedding,
        }
        const { data, error } = await supabaseClient.from('clipart_documentation').insert(insertPayload).select()

        if (error) {
          console.error('Error creating clipart document:', error)
          return
        }

        updatedDocuments.push({
          _rowIndex: rowIndex,
          Clipart: clipart,
          'Supabase ID': data?.[0]?.id,
          'Template ID': templateId || undefined, // Preserve Template ID
        })
      } else {
        // Update existing clipart document
        const updatePayload = {
          clipart,
          target_audience: targetAudience,
          context,
          user_style: userStyle,
          category,
          product_type: productType, // NEW: Store product type
          embedding,
          updated_at: new Date().toISOString(),
        }
        const { error } = await supabaseClient.from('clipart_documentation').update(updatePayload).eq('id', id)

        if (error) {
          console.error('Error updating clipart document:', error)
          return
        }

        updatedDocuments.push({
          _rowIndex: rowIndex,
          Clipart: clipart,
          'Supabase ID': id,
          'Template ID': templateId || undefined, // Preserve Template ID
        })
      }
    }
  }

  // Notify Google Apps Script with processed rows so it can mark them as done
  await fetch(`${DOCUMENTATION_WEB_APP_URL}?sheet=clipart-documentation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatedDocuments),
  })
}

/**
 * Sync scenes of AI mockups from Google Apps Script to local JSON file
 * Saves to public/scenes-of-ai-mockups.json
 * Columns: Scene, Suggest prompt, Tags, Thumbnail URL
 */
export async function syncScenesOfAIMockups() {
  try {
    // Request scenes of AI mockups from the Google web app
    const url = `${DOCUMENTATION_WEB_APP_URL}?sheet=scenes-of-ai-mockups`

    const response = await fetch(url)
    const responseText = await response.text()

    // Check if response is HTML (error page)
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      return {
        success: false,
        error: 'Google Apps Script returned HTML instead of JSON. Check script configuration.',
      }
    }

    let scenesData: any
    try {
      scenesData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError)
      return {
        success: false,
        error: `Invalid JSON response: ${parseError}`,
      }
    }

    let scenes = []

    if (Array.isArray(scenesData)) {
      // Direct array format from Google Apps Script
      scenes = scenesData
    } else if (scenesData.items) {
      scenes = scenesData.items || []
    } else {
      console.error('Unexpected scenes data format:', scenesData)
      return { success: false, error: 'Unexpected data format from Google Apps Script' }
    }

    // Process scenes data
    const processedScenes: any[] = []

    for (const scene of scenes) {
      // Google Apps Script sheet returns columns: Scene, Suggest prompt, Tags, Thumbnail URL
      const sceneName = scene['Scene'] || scene.scene || ''
      const suggestPrompt = scene['Suggest prompt'] || scene.suggestPrompt || scene['suggest prompt'] || ''
      const tagsString = scene['Tags'] || scene.tags || ''
      const thumbnailUrl = scene['Thumbnail URL'] || scene.thumbnailUrl || scene['thumbnail URL'] || ''

      // Skip rows that are missing required data (at least Scene should be present)
      if (sceneName && suggestPrompt) {
        // Split tags by comma and trim each tag, filter out empty strings
        const tags = tagsString
          ? tagsString
              .split(',')
              .map((tag: string) => tag.trim())
              .filter((tag: string) => tag.length > 0)
          : []

        processedScenes.push({
          scene: sceneName.trim(),
          suggestPrompt: suggestPrompt.trim(),
          tags,
          thumbnailUrl: thumbnailUrl.trim() || undefined,
        })
      }
    }

    // Save to local JSON file
    const filePath = path.join(process.cwd(), 'public', 'scenes-of-ai-mockups.json')

    // Ensure directory exists
    const dirPath = path.dirname(filePath)
    await fs.mkdir(dirPath, { recursive: true })

    // Write scenes to file
    await fs.writeFile(filePath, JSON.stringify(processedScenes, null, 2), 'utf-8')

    console.log(`Successfully synced ${processedScenes.length} AI mockup scenes to ${filePath}`)
    return { success: true, count: processedScenes.length }
  } catch (error) {
    console.error('Error syncing scenes of AI mockups:', error)
    return { success: false, error }
  }
}

/**
 * Get scenes of AI mockups from local JSON file
 */
export async function getScenesOfAIMockups() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'scenes-of-ai-mockups.json')

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch (accessError) {
      // File doesn't exist, return empty array
      console.error('Scenes of AI mockups file not found at:', filePath)
      console.error('Access error:', accessError)
      return []
    }

    // Read and parse the file
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const scenes = JSON.parse(fileContent)

    if (!Array.isArray(scenes)) {
      console.error('Invalid scenes of AI mockups data format, not an array')
      return []
    }

    // Return scenes as-is
    return scenes
  } catch (error) {
    console.error('Error getting scenes of AI mockups:', error)
    return []
  }
}
