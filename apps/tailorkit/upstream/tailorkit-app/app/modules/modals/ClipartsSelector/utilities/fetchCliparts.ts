import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { TemplatesService } from '~/api/services/templates'
import { BASE_CLICK_COUNT } from '~/routes/api.cliparts/constants'
import type { Template } from '~/types/psd'

interface IClipartsQueryProps {
  queryString: string
  page?: number
  clipartSource?: TEMPLATE_TYPE[]
  categories?: string[]
  limit?: number
  /**
   * Sort order: 'clicks' (high-to-low, then name A-Z - default), 'name' (A-Z), or 'createdAt'
   */
  sortBy?: 'clicks' | 'name' | 'createdAt'
}

interface ClipartItem extends Template {
  clickCount?: number
}

// Default pagination for cliparts
export const DEFAULT_CLIPARTS_PAGINATION = {
  // Current page
  page: 1,
  // Number of items per page
  limit: 35,
  // Total number of items
  total: 0,
  // Total number of pages
  pages: 1,
}

// Constant for "your cliparts" category name
const YOUR_CLIPARTS_CATEGORY = 'your cliparts'

/**
 * Fetch cliparts list
 *
 * @param {IClipartsQueryProps} props
 * @returns {Promise<{ cliparts: ClipartItem[]; pagination: { total: number; page: number } }>}
 */
export const fetchCliparts = async ({
  queryString,
  page = 1,
  clipartSource = [],
  categories = [],
  limit = DEFAULT_CLIPARTS_PAGINATION.limit,
  sortBy = 'clicks',
}: IClipartsQueryProps): Promise<{ cliparts: ClipartItem[]; pagination: { total: number; page: number } }> => {
  try {
    const validClipartSources = clipartSource.map(source =>
      source === TEMPLATE_TYPE.PREMADE_TEMPLATE ? TEMPLATE_TYPE.TEMPLATE : source
    )

    // Check if "your cliparts" category is selected
    const hasYourClipartsCategory = categories.includes(YOUR_CLIPARTS_CATEGORY)

    let filterType: string | undefined
    let filterCategories: string | undefined

    if (hasYourClipartsCategory) {
      // Add TEMPLATE_TYPE.CLIPART to filter__type if not already present
      const clipartTypeSet = new Set(validClipartSources)
      if (!clipartTypeSet.has(TEMPLATE_TYPE.CLIPART)) {
        clipartTypeSet.add(TEMPLATE_TYPE.CLIPART)
      }
      filterType = Array.from(clipartTypeSet).join(',')

      // Backend requires no category filter (!hasCategoryFilter) to fetch "your cliparts"
      // So we must set filter__categories to undefined, even if other categories are selected
      // This ensures backend can fetch user's own cliparts via type filter
      filterCategories = undefined
    } else {
      // Normal flow: use categories filter if provided
      filterCategories = categories.length ? categories.join(',') : undefined
      filterType = validClipartSources.length ? validClipartSources.join(',') : undefined
    }

    // Server now handles click sorting and pagination
    // We just need to specify the correct sort parameter
    let sortParam: string
    if (sortBy === 'clicks') {
      sortParam = 'clicks__desc'
    } else if (sortBy === 'name') {
      sortParam = 'name__asc'
    } else {
      sortParam = 'createdAt__desc'
    }

    const response = await TemplatesService.listCliparts({
      page,
      limit,
      sort: sortParam,
      filter__name: queryString || undefined,
      filter__type: filterType,
      filter__categories: filterCategories,
    })

    let cliparts: ClipartItem[] = (response.items || []) as ClipartItem[]
    const total = response.total || 0
    const currentPage = response.page || page

    // Always fetch click counts for display badges if not already in response
    if (cliparts.length > 0) {
      const hasClickCounts = cliparts.some(item => item.clickCount !== undefined)

      if (!hasClickCounts) {
        const clipartIds = cliparts.map((item: ClipartItem) => item._id)
        const clickCounts = await TemplatesService.getClipartClickCounts(clipartIds)

        cliparts = cliparts.map((item: ClipartItem) => ({
          ...item,
          clickCount: clickCounts[item._id] || BASE_CLICK_COUNT,
        }))
      }
    }

    return {
      cliparts,
      pagination: {
        total,
        page: currentPage,
      },
    }
  } catch (err) {
    console.error(err)
    return {
      cliparts: [],
      pagination: DEFAULT_CLIPARTS_PAGINATION,
    }
  }
}
