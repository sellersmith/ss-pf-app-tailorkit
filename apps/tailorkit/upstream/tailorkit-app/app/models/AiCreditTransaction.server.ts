import type {
  AiCreditTransactionDocument,
  CreateAiCreditTransactionInput,
  TransactionHistorySummary,
} from './AiCreditTransaction'
import mongoose from '~/bootstrap/db/connect-db.server'

const aiCreditTransactionSchema = new mongoose.Schema<AiCreditTransactionDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      enum: ['monthly', 'purchased'],
      index: true,
    },
    reason: {
      type: String,
      required: true,
      index: true,
    },
    purchaseId: {
      type: String,
      index: true,
    },
    packageName: String,
    packagePrice: Number,
    feature: {
      type: String,
      index: true,
    },
    balanceBefore: {
      monthly: { type: Number, default: 0 },
      purchased: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    balanceAfter: {
      monthly: { type: Number, default: 0 },
      purchased: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    description: {
      type: String,
      required: true,
    },
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
)

// Compound indexes for efficient queries
aiCreditTransactionSchema.index({ shopDomain: 1, createdAt: -1 })
aiCreditTransactionSchema.index({ shopDomain: 1, type: 1, createdAt: -1 })
aiCreditTransactionSchema.index({ shopDomain: 1, reason: 1, createdAt: -1 })

const AiCreditTransaction
  = mongoose.models.AiCreditTransaction
  || mongoose.model<AiCreditTransactionDocument>(
    'AiCreditTransaction',
    aiCreditTransactionSchema,
    'ai_credit_transactions'
  )

export default AiCreditTransaction

/**
 * Create AI credit transaction
 *
 * @param input - Transaction input data
 * @returns Created transaction document
 */
export async function createAiCreditTransaction(
  input: CreateAiCreditTransactionInput
): Promise<AiCreditTransactionDocument> {
  return AiCreditTransaction.create(input)
}

/**
 * Get AI credit transaction history
 *
 * @param shopDomain - Shop domain
 * @param options - Query options
 * @returns Array of transactions
 */
export async function getAiCreditTransactionHistory(
  shopDomain: string,
  options: {
    startDate?: Date
    endDate?: Date
    type?: 'credit'
    reason?: string
    feature?: string
    limit?: number
  } = {}
): Promise<AiCreditTransactionDocument[]> {
  const { startDate, endDate, type, reason, feature, limit = 100 } = options

  const query: any = { shopDomain }

  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = startDate
    if (endDate) query.createdAt.$lte = endDate
  }

  if (type) query.type = type
  if (reason) query.reason = reason
  if (feature) query.feature = feature

  return AiCreditTransaction.find(query).sort({ createdAt: -1 }).limit(limit)
}

/**
 * Get transaction history summary
 *
 * @param shopDomain - Shop domain
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Summary with totals and transactions
 */
export async function getTransactionHistorySummary(
  shopDomain: string,
  startDate?: Date,
  endDate?: Date
): Promise<TransactionHistorySummary> {
  const transactions = await getAiCreditTransactionHistory(shopDomain, {
    startDate,
    endDate,
    limit: 1000,
  })

  const summary = transactions.reduce(
    (acc, txn) => {
      if (txn.type === 'credit') {
        acc.totalCredits += txn.amount
      } else {
        acc.totalDebits += txn.amount
      }
      return acc
    },
    { totalCredits: 0, totalDebits: 0 }
  )

  return {
    ...summary,
    netChange: summary.totalCredits - summary.totalDebits,
    transactions,
    dateRange: {
      start: startDate || new Date(0),
      end: endDate || new Date(),
    },
  }
}

/**
 * Get current balance from latest transaction
 *
 * @param shopDomain - Shop domain
 * @returns Current balance or null if no transactions
 */
export async function getCurrentBalanceFromTransactions(shopDomain: string): Promise<{
  monthly: number
  purchased: number
  total: number
} | null> {
  const latest = await AiCreditTransaction.findOne({ shopDomain }).sort({ createdAt: -1 }).limit(1)

  return latest ? latest.balanceAfter : null
}

/**
 * Get daily transaction summary
 *
 * @param shopDomain - Shop domain
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Daily aggregated data
 */
export async function getDailyTransactionSummary(
  shopDomain: string,
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    date: string
    credits: number
    debits: number
    netChange: number
    balanceEnd: { monthly: number; purchased: number; total: number }
  }>
> {
  const result = await AiCreditTransaction.aggregate([
    {
      $match: {
        shopDomain,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $sort: { createdAt: 1 },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        credits: {
          $sum: {
            $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0],
          },
        },
        debits: {
          $sum: {
            $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0],
          },
        },
        lastBalance: { $last: '$balanceAfter' },
      },
    },
    {
      $project: {
        date: '$_id',
        credits: 1,
        debits: 1,
        netChange: { $subtract: ['$credits', '$debits'] },
        balanceEnd: '$lastBalance',
      },
    },
    {
      $sort: { date: 1 },
    },
  ])

  return result.map(r => ({
    date: r.date,
    credits: r.credits,
    debits: r.debits,
    netChange: r.netChange,
    balanceEnd: r.balanceEnd,
  }))
}
