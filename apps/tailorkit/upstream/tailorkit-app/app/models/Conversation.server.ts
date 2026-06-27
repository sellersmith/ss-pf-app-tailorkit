import mongoose from '~/bootstrap/db/connect-db.server'
import { type ConversationDocument, type ConversationInput } from './Conversation'
import { ConversationMessageModel } from './ConversationMessage.server'

const ConversationSchema = new mongoose.Schema<ConversationDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    messages: {
      type: [String],
      ref: 'ConversationMessage',
      default: [],
    },
    lastUpdated: {
      type: Date,
      index: true,
      default: Date.now,
    },
    metadata: {
      keywords: {
        type: [String],
        default: [],
        index: true,
      },
      summary: {
        type: String,
        default: '',
        index: true,
      },
    },
  },
  { timestamps: true }
)

export const ConversationModel
  = mongoose.models.Conversation || mongoose.model<ConversationDocument>('Conversation', ConversationSchema)

const paramsPopulateToMessages = {
  path: 'messages',
  model: ConversationMessageModel,
  localField: 'messages',
  foreignField: 'id',
}

export default class Conversation {
  /**
   * Create a new conversation or update if exists
   * @param shopDomain - The shop's domain
   * @param conversation - The conversation data to upsert
   * @returns Promise<ConversationDocument>
   */
  static upsert = async (shopDomain: string, conversation: ConversationInput) => {
    // Update conversation
    await ConversationModel.updateOne(
      { id: conversation.id, shopDomain },
      {
        ...conversation,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    )
  }

  /**
   * Get all conversations for a shop with full message data and pagination
   * @param shopDomain - The shop's domain
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   */
  static findByShopDomainWithMessages = async (args: {
    shopDomain: string
    query?: string
    page: number
    limit: number
  }) => {
    const { shopDomain, query: queryString, page = 1, limit = 10 } = args
    const query = { shopDomain, ...(queryString ? { title: { $regex: queryString, $options: 'i' } } : {}) }
    const skip = (page - 1) * limit

    const [conversations, total] = await Promise.all([
      ConversationModel.find(query)
        .populate(paramsPopulateToMessages)
        .lean()
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit),
      ConversationModel.countDocuments(query),
    ])

    return {
      conversations,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get a single conversation
   * @param id - Conversation ID
   * @param shopDomain - The shop's domain
   */
  static findByIdAndShopDomain = async (id: string, shopDomain: string) => {
    const conversation = await ConversationModel.findOne({ id, shopDomain }).populate(paramsPopulateToMessages)

    return conversation?.toObject()
  }
}
