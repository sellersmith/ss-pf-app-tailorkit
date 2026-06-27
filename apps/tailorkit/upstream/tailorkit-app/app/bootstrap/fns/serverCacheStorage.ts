import fs from 'fs/promises'
import path from 'path'
import { ONE_HOUR_IN_MILLISECONDS } from '~/constants'

/**
 * Class for handling server caching with simple string storage
 */
class ServerCacheStorage {
  private cacheDir: string

  constructor() {
    // Path to the caches directory
    this.cacheDir = path.join(process.cwd(), 'caches')

    // Ensure the caches directory exists
    fs.mkdir(this.cacheDir, { recursive: true }).catch(error => {
      console.error(`Error creating cache directory at ${this.cacheDir}:`, error)
    })
  }

  /**
   * Stores data in cache with optional expiration time
   * @param {string} key - Cache key
   * @param {any} data - Data to store
   * @param {number} [expirationTime] - Time in milliseconds until cache expires (default: 1 hour)
   * @returns {Promise<void>}
   */
  public async set(key: string, data: any, expirationTime: number = ONE_HOUR_IN_MILLISECONDS): Promise<void> {
    try {
      const expiredAt = new Date(Date.now() + expirationTime)
      const cacheData = {
        data: data,
        expiredAt: expiredAt,
      }

      // Create caches directory if it does not exist
      await fs.mkdir(this.cacheDir, { recursive: true })

      // Store cache data as a JSON string
      await fs.writeFile(path.join(this.cacheDir, `${key}.json`), JSON.stringify(cacheData))
    } catch (error) {
      console.error(`Error setting cache for key ${key}:`, error)
    }
  }

  /**
   * Retrieves data from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached data or null if not found/expired
   */
  public async get(key: string): Promise<any | null> {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      const now = new Date()
      const { data: cachedData, expiredAt } = JSON.parse(data)

      // Check if the cache has expired
      if (now > new Date(expiredAt)) {
        this.delete(key)
        return null
      }

      return cachedData
    } catch (error) {
      return null
    }
  }

  /**
   * Checks if key exists in cache and is not expired
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists and is not expired
   */
  public async has(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      const { expiredAt } = JSON.parse(data)

      return new Date() <= new Date(expiredAt)
    } catch (error) {
      return false
    }
  }

  /**
   * Deletes data from cache
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  public async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`)
      await fs.unlink(filePath)
    } catch (error) {
      // Do nothing
    }
  }

  /**
   * Clear cache for a specific shop domain
   * @param {string} shopDomain - Shop domain
   * @returns {Promise<void>}
   */
  public async clearCacheForShopDomain(shopDomain: string) {
    const cacheFiles = await fs.readdir(this.cacheDir)
    const cacheFilesForShopDomain = cacheFiles.filter(file => file.includes(shopDomain))

    for (const file of cacheFilesForShopDomain) {
      await fs.unlink(path.join(this.cacheDir, file))
    }
  }

  /**
   * Clear all server cache
   * @returns {Promise<void>}
   */
  public async clearAllCache() {
    const cacheFiles = await fs.readdir(this.cacheDir)

    for (const file of cacheFiles) {
      await fs.unlink(path.join(this.cacheDir, file))
    }
  }
}

export const serverCacheStorage = new ServerCacheStorage()
