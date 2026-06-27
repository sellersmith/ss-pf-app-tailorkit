import mongoose from '~/bootstrap/db/connect-db.server'
import { THIRTY_MINUTES_IN_MILLISECONDS } from '~/constants'

/**
 * Interface for Cache document
 */
export interface CacheDocument extends mongoose.Document {
  key: string
  value: any
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * MongoDB Cache Schema with TTL index
 * Documents will be automatically deleted when expiresAt is reached
 */
const CacheSchema = new mongoose.Schema<CacheDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Create TTL index - MongoDB will automatically delete documents when expiresAt is reached
CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const Cache = mongoose.models.Cache || mongoose.model<CacheDocument>('Cache', CacheSchema)

export default Cache

/**
 * Centralized cache storage using MongoDB
 * Works across multiple servers in a distributed environment
 */
export class MongoDBCacheStorage {
  /**
   * Stores data in cache with optional expiration time
   * @param {string} key - Cache key
   * @param {any} value - Data to store
   * @param {number} [ttl] - Time in milliseconds until cache expires (default: 30 minutes)
   * @returns {Promise<void>}
   */
  async set(key: string, value: any, ttl: number = THIRTY_MINUTES_IN_MILLISECONDS): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl)

      await Cache.findOneAndUpdate(
        { key },
        {
          key,
          value,
          expiresAt,
        },
        {
          upsert: true,
          new: true,
        }
      )
    } catch (error) {
      console.error(`Error setting cache for key ${key}:`, error)
    }
  }

  /**
   * Retrieves data from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached data or null if not found/expired
   */
  async get(key: string): Promise<any | null> {
    try {
      const cacheEntry = await Cache.findOne({
        key,
        expiresAt: { $gt: new Date() }, // Only return non-expired entries
      }).lean<{ value: any }>()

      if (!cacheEntry) {
        return null
      }

      return cacheEntry.value
    } catch (error) {
      console.error(`Error getting cache for key ${key}:`, error)
      return null
    }
  }

  /**
   * Checks if key exists in cache and is not expired
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    try {
      const count = await Cache.countDocuments({
        key,
        expiresAt: { $gt: new Date() },
      })

      return count > 0
    } catch (error) {
      console.error(`Error checking cache for key ${key}:`, error)
      return false
    }
  }

  /**
   * Deletes data from cache
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  async delete(key: string): Promise<void> {
    try {
      await Cache.deleteOne({ key })
    } catch (error) {
      console.error(`Error deleting cache for key ${key}:`, error)
    }
  }

  /**
   * Clear cache for a specific shop domain
   * @param {string} shopDomain - Shop domain
   * @returns {Promise<void>}
   */
  async clearCacheForShopDomain(shopDomain: string): Promise<void> {
    try {
      // Delete all cache entries that contain the shop domain in the key
      await Cache.deleteMany({
        key: { $regex: shopDomain, $options: 'i' },
      })
    } catch (error) {
      console.error(`Error clearing cache for shop domain ${shopDomain}:`, error)
    }
  }

  /**
   * Clear all cache entries
   * @returns {Promise<void>}
   */
  async clearAllCache(): Promise<void> {
    try {
      await Cache.deleteMany({})
    } catch (error) {
      console.error('Error clearing all cache:', error)
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<{total: number, expired: number, active: number}>}
   */
  async getStats(): Promise<{ total: number; expired: number; active: number }> {
    try {
      const now = new Date()
      const [total, expired] = await Promise.all([
        Cache.countDocuments({}),
        Cache.countDocuments({ expiresAt: { $lte: now } }),
      ])

      return {
        total,
        expired,
        active: total - expired,
      }
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return { total: 0, expired: 0, active: 0 }
    }
  }

  /**
   * Clean up expired cache entries manually (MongoDB TTL does this automatically, but can be slow)
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await Cache.deleteMany({
        expiresAt: { $lte: new Date() },
      })

      return result.deletedCount || 0
    } catch (error) {
      console.error('Error cleaning up expired cache:', error)
      return 0
    }
  }
}

export const mongoDBCacheStorage = new MongoDBCacheStorage()
