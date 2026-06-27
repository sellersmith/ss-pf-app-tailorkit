import { z } from 'zod'
import { Http } from '../core/httpClient'
import { parseWithZod } from '../core/validation'
import { AI_CREDITS_ACTIONS } from '~/routes/api.ai-credits/constants'

const API_URL = '/api/ai-credits'

// --- Schemas ---

const AiCreditPackageZ = z
  .object({
    _id: z.string(),
    packageId: z.string(),
    name: z.string(),
    credits: z.number(),
    price: z.number(),
    status: z.enum(['active', 'inactive']),
    popular: z.boolean().optional(),
    displayOrder: z.number(),
    description: z.string().optional(),
  })
  .passthrough()

const GetPackagesResponseZ = z.object({
  success: z.boolean(),
  packages: z.array(AiCreditPackageZ).default([]),
})

const PurchaseResponseZ = z
  .object({
    success: z.boolean(),
    purchase: z.any().optional(),
    confirmationUrl: z.string().optional(),
    autoCharged: z.boolean().optional(),
    requirePlanSelection: z.boolean().optional(),
    message: z.string().optional(),
  })
  .passthrough()

const HistoryResponseZ = z
  .object({
    success: z.boolean(),
    history: z.array(z.any()).default([]),
  })
  .passthrough()

// --- Types ---

export type AiCreditPackage = z.infer<typeof AiCreditPackageZ>
export type GetPackagesResponse = z.infer<typeof GetPackagesResponseZ>
export type PurchaseResponse = z.infer<typeof PurchaseResponseZ>
export type HistoryResponse = z.infer<typeof HistoryResponseZ>

// --- Service ---

export const AiCreditsService = {
  /**
   * Fetch active AI credit packages sorted by display order.
   * Cached after first successful fetch.
   */
  async getPackages(preferCache = true): Promise<AiCreditPackage[]> {
    const res = await Http.get<unknown>(API_URL, { preferCache })

    if (!res.ok || !res.data) {
      throw new Error('Failed to fetch AI credit packages')
    }

    const data = parseWithZod(GetPackagesResponseZ, res.data, 'ai-credit-packages')
    return data.packages || []
  },

  /**
   * Purchase AI credits with a given package ID and optional coupon code.
   */
  async purchase(packageId: string, couponCode?: string): Promise<PurchaseResponse> {
    const res = await Http.post<unknown>(API_URL, { action: AI_CREDITS_ACTIONS.PURCHASE, packageId, couponCode })

    if (!res.ok || !res.data) {
      throw new Error('Purchase failed')
    }

    return parseWithZod(PurchaseResponseZ, res.data, 'ai-credit-purchase')
  },

  /**
   * Get AI credit purchase history.
   */
  async getHistory(options?: { limit?: number; status?: string }): Promise<HistoryResponse> {
    const res = await Http.post<unknown>(API_URL, { action: AI_CREDITS_ACTIONS.HISTORY, ...options })

    if (!res.ok || !res.data) {
      throw new Error('Failed to fetch purchase history')
    }

    return parseWithZod(HistoryResponseZ, res.data, 'ai-credit-history') as HistoryResponse
  },
}
