import mongoose from '~/bootstrap/db/connect-db.server'
import { type ConversationMessageDocument } from './ConversationMessage'
import { FeedbackType, ConversationRole } from '~/enums/conversationMessage'
import { Schema } from 'mongoose'

const ConversationMessageSchema = new mongoose.Schema<ConversationMessageDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    id: {
      type: String,
      required: true,
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(ConversationRole),
      required: true,
    },
    metadata: {
      // Prepare for future use
      // Remember define the type of the metadata to ensure type safety
      type: Schema.Types.Mixed,
      default: {},
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    feedback: {
      type: Schema.Types.Mixed,
      enum: [...Object.values(FeedbackType), null],
      default: null,
    },
  },
  { timestamps: true }
)

export const ConversationMessageModel
  = mongoose.models.ConversationMessage
  || mongoose.model<ConversationMessageDocument>('ConversationMessage', ConversationMessageSchema)

export default class ConversationMessage {
  /**
   * Upsert messages for a conversation
   * @param shopDomain - The shop's domain
   * @param conversationId - The conversation's id
   * @param messages - The messages to upsert
   * @returns Promise<ConversationDocument>
   */
  static insertMany = async (args: {
    shopDomain: string
    conversationId: string
    messages: ConversationMessageDocument[]
  }) => {
    const { shopDomain, conversationId, messages } = args
    return ConversationMessageModel.bulkWrite(
      messages.map(message => ({
        updateOne: {
          filter: { shopDomain, conversationId, id: message.id },
          update: { $set: message },
          upsert: true,
        },
      }))
    )
  }

  /**
   * Get all messages for a conversation with pagination
   * @param shopDomain - The shop's domain
   * @param conversationId - The conversation's id
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   */
  static findByShopDomainAndConversationId = async (
    shopDomain: string,
    conversationId: string,
    page = 1,
    limit = 10
  ) => {
    const query = { shopDomain, conversationId }
    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      ConversationMessageModel.find(query)
        .lean() // Convert Mongoose documents to plain JS objects
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit),
      ConversationMessageModel.countDocuments(query),
    ])

    return {
      messages,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get a single message
   * @param id - Message ID
   * @param shopDomain - The shop's domain
   */
  static findByIdAndShopDomain = async (id: string, shopDomain: string) => {
    return ConversationMessageModel.findOne({ id, shopDomain })
  }

  /**
   * Search messages by content (generic, reusable)
   * - Uses MongoDB text index when available; falls back to case-insensitive regex
   * - Always sorted by newest first (lastUpdated desc)
   */
  static searchByContent = async (args: {
    shopDomain: string
    conversationId: string
    query: string
    role?: ConversationRole
    page?: number
    limit?: number
  }) => {
    const { shopDomain, conversationId, query, role = ConversationRole.ASSISTANT, page = 1, limit = 1 } = args
    const skip = (page - 1) * limit

    const baseFilter = role ? { shopDomain, conversationId, role } : { shopDomain, conversationId }

    // Attempt text search first
    try {
      const textFilter = {
        ...baseFilter,
        $text: { $search: query },
      } as any

      const [messages, total] = await Promise.all([
        ConversationMessageModel.find(textFilter)
          .lean()
          .sort({ score: { $meta: 'textScore' }, lastUpdated: -1 })
          .skip(skip)
          .limit(limit)
          .select({ score: { $meta: 'textScore' } } as any),
        ConversationMessageModel.countDocuments(textFilter),
      ])

      if (Array.isArray(messages) && messages.length > 0) {
        return {
          messages,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        }
      }
    } catch {
      // Ignore and fallback to regex
    }

    // Fallback: case-insensitive regex search
    const regexFilter = {
      ...baseFilter,
      content: { $regex: query, $options: 'i' },
    }

    const [messages, total] = await Promise.all([
      ConversationMessageModel.find(regexFilter).lean().sort({ lastUpdated: -1 }).skip(skip).limit(limit),
      ConversationMessageModel.countDocuments(regexFilter),
    ])

    return {
      messages,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Update message feedback
   * @param id - Message ID
   * @param shopDomain - The shop's domain
   * @param feedback - The feedback value ('like' or 'dislike')
   */
  static updateFeedback = async (id: string, shopDomain: string, feedback: FeedbackType | null) => {
    return ConversationMessageModel.findOneAndUpdate({ id, shopDomain }, { feedback }, { new: true })
  }
}
