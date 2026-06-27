import { serverCacheStorage } from '~/bootstrap/fns/serverCacheStorage'
import { CACHE_KEYS } from '~/constants/cache'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { GOOGLE_SHEET_APIS } from './constants'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'

export enum GoogleSheetAction {
  GET = 'GET_GOOGLE_SHEET_DATA',
  SET = 'SET_GOOGLE_SHEET_DATA',
}

/**
 * Handle Google Sheet data
 * @param {Object} params - The parameters for the function
 * @param {GoogleSheetAction} params.action - The action to perform (GET or SET)
 * @returns {Promise<any>} - The response from the Google Sheet data
 */
export const handleGoogleSheetData = async ({
  action = GoogleSheetAction.GET,
}: {
  action: GoogleSheetAction
}): Promise<any> => {
  try {
    const googleSheetContent: Record<string, any> = {}

    // Fetch and cache Google Sheet content
    const fetchAndCacheGoogleSheetContent = async () => {
      // Fetch data from all Google Sheet APIs concurrently
      const dataArray = await Promise.allSettled(GOOGLE_SHEET_APIS.map(api => fetch(api).then(res => res.json())))

      // Loop through the dataArray and add the data to the googleSheetContent
      GOOGLE_SHEET_APIS.forEach((api, index) => {
        const result = dataArray[index]

        // If the data is fulfilled, add it to the googleSheetContent
        if (result.status === 'fulfilled' && result.value) {
          googleSheetContent[api] = result.value
        }
      })

      // Cache the fetched data
      await serverCacheStorage.set(CACHE_KEYS.GOOGLE_SHEET_DATA, googleSheetContent, ONE_DAY_IN_MILLISECONDS)
    }

    switch (action) {
      case GoogleSheetAction.GET: {
        const cachedData = await serverCacheStorage.get(CACHE_KEYS.GOOGLE_SHEET_DATA)

        // If cached data is available, return it
        if (cachedData && Object.keys(cachedData).length) {
          return cachedData
        }

        // If cached data is not available, fetch and set the data
        await fetchAndCacheGoogleSheetContent()
        return googleSheetContent
      }

      case GoogleSheetAction.SET: {
        await fetchAndCacheGoogleSheetContent()
        return googleSheetContent
      }
    }
  } catch (error: any) {
    console.error(`===> Failed to process Google Sheet data: ${error.message}`)
    return { error: formatErrorMessage(error) }
  }
}
