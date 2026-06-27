/**
 * AI Credit Transaction Document
 * Unified history for both purchases (credit) and usage (debit)
 */
export interface AiCreditTransactionDocument {
  _id: string
  shopDomain: string
  type: 'credit' | 'debit' // credit = mua thêm, debit = tiêu dùng
  amount: number // Positive for credit, positive for debit (always positive)
  source?: 'monthly' | 'purchased' // Which pool? For credit: always 'purchased'. For debit: 'monthly' or 'purchased' based on consumption order
  reason: string // 'purchase' | 'usage' | 'refund' | 'adjustment'

  // For purchases (type = 'credit')
  purchaseId?: string // Reference to AiCreditPurchase
  packageName?: string
  packagePrice?: number

  // For usage (type = 'debit')
  feature?: string // 'ai_chat' | 'image_generation' | 'background_removal'

  // Balance tracking
  balanceBefore: {
    monthly: number
    purchased: number
    total: number
  }
  balanceAfter: {
    monthly: number
    purchased: number
    total: number
  }

  description: string // Human-readable description
  metadata?: Record<string, any>
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Input for creating transaction
 */
export interface CreateAiCreditTransactionInput {
  shopDomain: string
  type: 'credit' | 'debit'
  amount: number
  source?: 'monthly' | 'purchased'
  reason: string
  purchaseId?: string
  packageName?: string
  packagePrice?: number
  feature?: string
  balanceBefore: {
    monthly: number
    purchased: number
    total: number
  }
  balanceAfter: {
    monthly: number
    purchased: number
    total: number
  }
  description: string
  metadata?: Record<string, any>
}

/**
 * Transaction history summary
 */
export interface TransactionHistorySummary {
  totalCredits: number
  totalDebits: number
  netChange: number
  transactions: AiCreditTransactionDocument[]
  dateRange: {
    start: Date
    end: Date
  }
}
