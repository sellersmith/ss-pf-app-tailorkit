import { ONE_MINUTE_IN_MILLISECONDS, ONE_SECOND_IN_MILLISECONDS } from '../constants'
import { sleep } from './index'

export interface PollConfig {
  maxTimeout: number // Maximum time to wait in milliseconds
  initialDelay: number // Initial delay between retries in milliseconds
}
function formatErrorMessage(e: Error | any) {
  return e instanceof Error ? e.message : (e as string)
}

const DEFAULT_POLL_CONFIG: PollConfig = {
  maxTimeout: ONE_MINUTE_IN_MILLISECONDS * 5, // 5 minutes
  initialDelay: ONE_SECOND_IN_MILLISECONDS * 5, // 5 seconds
}

export async function poll<T>(
  checkCondition: () => Promise<T | null>,
  config: PollConfig = DEFAULT_POLL_CONFIG
): Promise<T> {
  const startTime = Date.now()
  const currentDelay = config.initialDelay
  let attempts = 0

  while (Date.now() - startTime < config.maxTimeout) {
    try {
      const result = await checkCondition()

      if (result) {
        console.log(`Condition met after ${attempts} attempts`)
        return result
      }

      // Exponential backoff with max delay
      await sleep(currentDelay)
      attempts++

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, currentDelay))
    } catch (error) {
      console.error('Error during polling:', error)
      throw new Error(`Failed during polling: ${formatErrorMessage(error)}`)
    }
  }

  throw new Error(`Timeout after ${config.maxTimeout}ms waiting for condition to be met`)
}
