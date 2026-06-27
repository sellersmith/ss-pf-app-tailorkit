import { sleep } from '~/utils/sleep'
import type { CatalogMethods } from './catalog'
import Catalog from './catalog'
import { API_VERSION, BASE_URL } from './constants'
import type { OrdersMethods } from './orders'
import Orders from './orders'
import type { ProductsMethods } from './products'
import Products from './products'
import type { ShopsMethods } from './shops'
import Shops from './shops'
import type { UploadsMethods } from './uploads'
import Uploads from './uploads'
import type { WebhookMethods } from './webhooks'
import Webhooks from './webhooks'
import { isJSON } from 'extensions/tailorkit-src/src/assets/fns/is-json'
import { CommonError } from '~/constants/errors'
import { FIVE_SECONDS } from '~/constants/time'

export interface PrintifyConfig {
  shopId: string
  accessToken: string
  apiVersion?: 'v1' | 'v2'
  enableLogging?: boolean
}

export interface FetchDataOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
}

export type FetchDataFunc = <T = any>(url: string, options?: FetchDataOptions) => Promise<T>

/**
 * Welcome to Printify API
 * @example
 * const printify = new Printify({
    shopId: '123456', // global query by shop_id
    accessToken: 'access_token', // pass personal access token
    enableLogging: false, // false by default
  });
 */

class Printify {
  /** ID of shop */
  private readonly shopId: PrintifyConfig['shopId']

  /** Personal access token */
  private readonly accessToken: PrintifyConfig['accessToken']

  /** API version, generally most endpoints using v1 */
  private readonly apiVersion: PrintifyConfig['apiVersion']

  /** Property to enable debug logs */
  private readonly enableLogging: PrintifyConfig['enableLogging']

  catalog: CatalogMethods
  orders: OrdersMethods
  products: ProductsMethods
  shops: ShopsMethods
  uploads: UploadsMethods
  webhooks: WebhookMethods;

  [key: string]: any // Allow dynamic access to properties

  constructor(config: PrintifyConfig) {
    this.shopId = config.shopId
    this.accessToken = config.accessToken
    this.apiVersion = config.apiVersion || API_VERSION
    this.enableLogging = config.enableLogging ?? true

    // Initialize API modules
    this.catalog = new Catalog(this.fetchData.bind(this))

    this.orders = new Orders(this.fetchData.bind(this), this.shopId)

    this.products = new Products(this.fetchData.bind(this), this.shopId)

    this.shops = new Shops(this.fetchData.bind(this), this.shopId)

    this.uploads = new Uploads(this.fetchData.bind(this), this.shopId)

    this.webhooks = new Webhooks(this.fetchData.bind(this), this.shopId)
  }

  /**
   * Get api endpoint
   * @param url '/${url}' // Start with a slash
   * @returns
   */
  private getEndpoint(url: string) {
    // Define request endpoint
    return `${BASE_URL}/${this.apiVersion}${url}`
  }

  /**
   * Logs an error if logging is enabled.
   */
  private logError(message: string): void {
    if (this.enableLogging) {
      console.error(message)
    }
  }

  /**
   * Logs request details if logging is enabled.
   */
  private logRequest(method: string, url: string): void {
    if (this.enableLogging) {
      console.log(`Requesting ${method.toUpperCase()} ${this.getEndpoint(url)}`)
    }
  }

  /**
   * Fetch data using native fetch API with retry logic.
   */
  private async fetchData<T = any>(url: string, options: FetchDataOptions = {}): Promise<T> {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
    }

    const finalOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
      body: options.body,
    }

    // Define request url
    const requestUrl = this.getEndpoint(url)
    // Request's method
    const method = finalOptions.method?.toUpperCase() || 'GET'

    this.logRequest(method, url)

    // Retry logic
    const maxRetries = 1
    // Sleep time
    const sleepTime = FIVE_SECONDS
    // Current attempts retried
    let attempts = 0

    while (attempts < maxRetries) {
      try {
        const response = await fetch(requestUrl, finalOptions)

        if (!response.ok) {
          const error = await response.text()
          const message = `Printify - Error: ${response.status} ${response.statusText} - ${error}`
          this.logError(message)

          throw new Error(error)
        }

        const result = await response.json()

        return result
      } catch (error) {
        // Sleep a time to prevent throttle
        await sleep(sleepTime)

        // Increase attempt
        attempts++

        if (attempts >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const message = `Printify - Error: Failed after ${maxRetries} attempts - ${errorMessage}`
          this.logError(message)

          if (isJSON(errorMessage)) {
            const error = JSON.parse(errorMessage)

            throw new Error(error.errors?.reason || error.error || CommonError)
          }

          throw new Error(errorMessage)
        }
      }
    }

    // This point should never be reached, added to satisfy TypeScript.
    throw new Error('Unexpected error during fetch operation.')
  }
}

export default Printify
