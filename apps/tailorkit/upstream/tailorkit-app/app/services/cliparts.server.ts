import type { LoaderFunctionArgs } from '@remix-run/node'
import fs from 'fs'
import path from 'path'
import { TEMPLATE_TYPE, isClipart } from '~/routes/api.templates/constants'
import type { TClipartsSelected } from '~/routes/api.templates/constants'
import { getTemplateDetails } from '~/models/Template.server'
import ShopAssetAnalyticsModel from '~/models/ShopAssetAnalytics.server'
import { BASE_CLICK_COUNT } from '~/routes/api.cliparts/constants'
import { getExcludedShopDomains } from '~/routes/api.cliparts/helpers.server'

export type ClipartListItem = {
  _id: string
  name?: string
  previewUrl?: string
  createdAt?: string | Date
  updatedAt?: string | Date
  type?: string
  metadata?: any
  dimension?: any
  categories?: string[]
  clickCount?: number
  productPageUrl?: string
}

// In-memory cache for onboarding priority map to avoid reading disk on every request
let cachedPriorityMap: Map<string, number> | null = null
let cachedPriorityMapMtimeMs = 0

function normalizeCategoryName(name: string): string {
  return (name || '').trim().toLowerCase()
}

/**
 * Fetch click counts for clipart IDs from ShopAssetAnalytics
 * @param assetIds - Array of asset IDs
 * @param assetType - Asset type (default: 'clipart')
 * @returns Map of assetId to click count
 */
async function fetchClickCounts(assetIds: string[], assetType: string = 'clipart'): Promise<Record<string, number>> {
  if (assetIds.length === 0) {
    return {}
  }

  try {
    const excludedShopDomains = await getExcludedShopDomains()

    const aggregates = await ShopAssetAnalyticsModel.aggregate([
      {
        $match: {
          assetId: { $in: assetIds },
          assetType,
          shopDomain: { $nin: excludedShopDomains },
        },
      },
      {
        $group: {
          _id: '$assetId',
          totalClicks: { $sum: '$totalClicks' },
        },
      },
    ])

    const clickCounts: Record<string, number> = {}

    aggregates.forEach((agg: any) => {
      clickCounts[agg._id] = BASE_CLICK_COUNT + agg.totalClicks
    })

    assetIds.forEach(id => {
      if (!clickCounts[id]) {
        clickCounts[id] = BASE_CLICK_COUNT
      }
    })

    return clickCounts
  } catch (error) {
    console.error('[fetchClickCounts] Error:', error)
    return {}
  }
}

function getProductsOnboardingPath(): string {
  return path.resolve(process.cwd(), 'public', 'products-onboarding.json')
}

function buildPriorityMapUnsafe(): Map<string, number> {
  const filePath = getProductsOnboardingPath()
  if (!fs.existsSync(filePath)) return new Map<string, number>()
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const item of parsed) {
      const cat = normalizeCategoryName(String(item?.clipartCategory || ''))
      const pr = parseInt(String(item?.priority || ''), 10)
      if (!cat) continue
      const priority = Number.isFinite(pr) ? pr : Number.MAX_SAFE_INTEGER
      // Keep the lowest priority if duplicates exist
      const existing = map.get(cat)
      if (existing === null || existing === undefined || priority < existing) map.set(cat, priority)
    }
    return map
  } catch {
    return new Map<string, number>()
  }
}

function getOnboardingPriorityMap(): Map<string, number> {
  try {
    const filePath = getProductsOnboardingPath()
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null
    const mtimeMs = stat ? stat.mtimeMs : 0

    if (!cachedPriorityMap || mtimeMs !== cachedPriorityMapMtimeMs) {
      cachedPriorityMap = buildPriorityMapUnsafe()
      cachedPriorityMapMtimeMs = mtimeMs
    }
    return cachedPriorityMap || new Map<string, number>()
  } catch {
    return new Map<string, number>()
  }
}

export function loadTemplatesIndex(): { index: any[]; idToJson: Map<string, string> } {
  const candidatePaths = [path.resolve('public', 'templates.json')]

  for (const p of candidatePaths) {
    if (!fs.existsSync(p)) continue
    try {
      const raw = fs.readFileSync(p, 'utf8')
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed)) {
        const idToJson = new Map<string, string>()
        for (const item of parsed) {
          const id = item?._id || item?.id
          const jsonPath = item?.json || item?.file
          if (id && typeof jsonPath === 'string') {
            idToJson.set(String(id), jsonPath)
          }
        }
        return { index: parsed, idToJson }
      }
    } catch {}
  }

  return { index: [], idToJson: new Map() }
}

export async function getClipartsDetailsByIds(
  clipartIds: string[],
  premadeTemplateIds: string[],
  shopDomain: string
): Promise<any[]> {
  const publicDir = path.resolve('public')
  const { idToJson } = loadTemplatesIndex()

  // Fetch cliparts from DB
  const fetchCliparts = clipartIds.length ? getTemplateDetails({ ids: clipartIds, shopDomain }) : Promise.resolve([])

  // Fetch premade templates from files if available
  const fileResults: any[] = []
  const missingIds: string[] = []
  for (const id of premadeTemplateIds) {
    const jsonPath = idToJson.get(id)
    if (!jsonPath) {
      missingIds.push(id)
      continue
    }
    const localPath = path.resolve(publicDir, jsonPath.replace(/^\/+/, ''))
    if (!fs.existsSync(localPath)) {
      missingIds.push(id)
      continue
    }
    try {
      const content = JSON.parse(fs.readFileSync(localPath, 'utf8'))
      if (content && content._id) fileResults.push(content)
    } catch {}
  }

  // Fallback to DB for any missing premade ids
  const storeAssetDomain = process.env.STORE_ASSET_DOMAIN || ''
  const fetchPremadeFallback
    = missingIds.length && storeAssetDomain
      ? getTemplateDetails({ ids: missingIds, shopDomain: storeAssetDomain })
      : Promise.resolve([])

  const [cliparts, premadeFallback] = await Promise.all([fetchCliparts, fetchPremadeFallback])
  return [...cliparts, ...fileResults, ...premadeFallback]
}

export async function getClipartsDetailsBySelection(
  clipartsSelected: TClipartsSelected[],
  shopDomain: string
): Promise<any[]> {
  const { clipartIds, premadeTemplateIds } = clipartsSelected.reduce(
    (acc, item) => {
      if (isClipart(item.type)) acc.clipartIds.push(item._id)
      else acc.premadeTemplateIds.push(item._id)
      return acc
    },
    { clipartIds: [] as string[], premadeTemplateIds: [] as string[] }
  )

  return getClipartsDetailsByIds(clipartIds, premadeTemplateIds, shopDomain)
}

function parseListParams(request: LoaderFunctionArgs['request']) {
  const { searchParams } = new URL(request.url)
  const limit = Math.max(0, Math.min(Number(searchParams.get('limit') || 250), 250))
  const page = Math.max(Number(searchParams.get('page') || 1), 1)
  const sort = searchParams.get('sort')
  const [sortBy, sortDir] = sort?.split('__') || []
  const filterNameHas = (searchParams.get('filter__name') || '').startsWith('string__has__')
    ? (searchParams.get('filter__name') || '').replace('string__has__', '')
    : ''
  const filterType = (searchParams.get('filter__type') || '').split(',').filter(Boolean)
  const filterCategories = (searchParams.get('filter__categories') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return { limit, page, sortBy, sortDir, filterNameHas, filterType, filterCategories }
}

function applyArrayFilters(
  items: ClipartListItem[],
  opts: { nameHas?: string; types?: string[]; categories?: string[] }
) {
  const nameHas = (opts.nameHas || '').trim().toLowerCase()
  const types = opts.types || []
  const categories = opts.categories || []
  let result = items
  if (nameHas) {
    result = result.filter(i => (i.name || '').toLowerCase().includes(nameHas))
  }
  if (types.length) {
    result = result.filter(i => (i.type ? types.includes(i.type) : true))
  }
  if (categories.length) {
    result = result.filter(i => {
      const cats = Array.isArray(i.categories) ? i.categories : []
      // match if any selected category exists in item categories
      return cats.some(c => categories.includes(c))
    })
  }
  return result
}

function sortItems(items: ClipartListItem[], sortBy?: string, sortDir?: string) {
  if (!sortBy) {
    return items.sort((a, b) => {
      const aTime = new Date((a.updatedAt || a.createdAt || 0) as any).getTime()
      const bTime = new Date((b.updatedAt || b.createdAt || 0) as any).getTime()
      return bTime - aTime
    })
  }
  const dir = sortDir?.toLowerCase() === 'desc' ? -1 : 1
  return items.sort((a: any, b: any) => {
    const av = a?.[sortBy]
    const bv = b?.[sortBy]
    if (av === bv) return 0
    // Special handling for string fields like 'name' to use case-insensitive comparison
    if (sortBy === 'name' && typeof av === 'string' && typeof bv === 'string') {
      return av.toLowerCase().localeCompare(bv.toLowerCase()) * dir
    }
    return av > bv ? dir : -dir
  })
}

export const EXCLUDED_CLIPART_CATEGORIES = ['🎄X-mas picks', 'Onboarding', '💖 One of one']

/**
 * Get cliparts list from index
 * @param request - The request object
 * @returns The cliparts list
 */
export async function getClipartsListFromIndex(
  request: LoaderFunctionArgs['request']
): Promise<{ items: ClipartListItem[]; total: number; page: number }> {
  const { limit, page, sortBy, sortDir, filterNameHas, filterType, filterCategories } = parseListParams(request)

  const { index } = loadTemplatesIndex()
  const fileItems: ClipartListItem[] = Array.isArray(index)
    ? index
        .map((item: any) => ({
          _id: String(item._id || item.id),
          name: item.name,
          previewUrl: item.previewUrl,
          thumbnailUrl: item.thumbnailUrl,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          type: item.type || TEMPLATE_TYPE.TEMPLATE,
          metadata: item.metadata,
          dimension: item.dimension,
          categories: Array.isArray(item.categories) ? item.categories : [],
          productPageUrl: item.productPageUrl || undefined,
        }))
        .filter(Boolean)
        .filter(item => {
          // Filter out items that have any excluded category
          const categories = Array.isArray(item.categories) ? item.categories : []
          return !categories.some(cat => EXCLUDED_CLIPART_CATEGORIES.includes(cat))
        })
    : []

  let combined = applyArrayFilters(fileItems, {
    nameHas: filterNameHas,
    types: filterType,
    categories: filterCategories,
  })

  // If sorting by clicks, fetch click counts first
  const isSortingByClicks = sortBy === 'clicks' || sortBy === 'clickCount'

  if (isSortingByClicks && combined.length > 0) {
    const assetIds = combined.map(item => item._id)
    const clickCounts = await fetchClickCounts(assetIds)

    // Merge click counts into items
    combined = combined.map(item => ({
      ...item,
      clickCount: clickCounts[item._id] || BASE_CLICK_COUNT,
    }))
  }

  // Preserve build-time order (templates.json is pre-sorted by priority). Only sort when client specifies.
  if (sortBy) {
    if (isSortingByClicks) {
      // Sort by clicks (high to low for desc, low to high for asc), then by name (A-Z) for ties
      const isAsc = sortDir?.toLowerCase() === 'asc'
      combined = combined.sort((a, b) => {
        const aClicks = a.clickCount ?? BASE_CLICK_COUNT
        const bClicks = b.clickCount ?? BASE_CLICK_COUNT
        if (aClicks !== bClicks) {
          // For desc: high clicks first (b - a), for asc: low clicks first (a - b)
          return isAsc ? aClicks - bClicks : bClicks - aClicks
        }
        // Tie-breaker: sort by name A-Z
        const aName = (a.name || a._id || '').toLowerCase()
        const bName = (b.name || b._id || '').toLowerCase()
        return aName.localeCompare(bName)
      })
    } else {
      combined = sortItems(combined, sortBy, sortDir)
    }
  }

  const total = combined.length
  const start = Math.max(0, (page - 1) * (limit || 0))
  const end = limit ? start + limit : undefined
  const pageItems = limit ? combined.slice(start, end) : combined

  return { items: pageItems, total, page }
}

/**
 * Get cliparts categories from index
 * @returns The cliparts categories
 */
export async function getClipartsCategoriesFromIndex(): Promise<string[]> {
  const { index } = loadTemplatesIndex()
  if (!Array.isArray(index)) return []
  const set = new Set<string>()
  for (const item of index) {
    const cats = Array.isArray(item?.categories) ? item.categories : []
    for (const c of cats) {
      if (typeof c === 'string' && c.trim() && !EXCLUDED_CLIPART_CATEGORIES.includes(c)) {
        set.add(c)
      }
    }
  }
  // Sort by onboarding priority if available, fallback to alpha for ties/unmapped
  const prioMap = getOnboardingPriorityMap()
  return Array.from(set).sort((a, b) => {
    const aKey = (a || '').trim().toLowerCase()
    const bKey = (b || '').trim().toLowerCase()
    const aPr = prioMap.get(aKey)
    const bPr = prioMap.get(bKey)
    if (aPr === null || aPr === undefined) {
      if (bPr === null || bPr === undefined) return a.localeCompare(b)
      return 1
    }
    if (bPr === null || bPr === undefined) return -1
    if (aPr !== bPr) return aPr - bPr
    return a.localeCompare(b)
  })
}
