import type { AnnouncementDocument } from './types'
import Announcement from './models/Announcement.server'
import { FIVE_SECONDS_IN_MILLISECONDS } from '~/constants'

export async function getActiveAnnouncements(): Promise<AnnouncementDocument[]> {
  const now = new Date()

  return Announcement.find({
    $and: [
      { status: 'active' },
      {
        $or: [{ startAt: null }, { startAt: { $lte: now } }, { startAt: { $exists: false } }],
      },
      {
        $or: [{ endAt: null }, { endAt: { $gte: now } }, { endAt: { $exists: false } }],
      },
    ],
  })
}

/**
 * @description Sync announcements from TailorKit Google Sheet.
 * Apps in Ecomate can use this function to sync their announcements as well.
 *
 * @param {string} appName - The name of the app to sync announcements from.
 * @returns {Promise<void>}
 * @throws {Error} If there's a critical error during synchronization
 */
export async function syncAnnouncementsFromGoogleSheet(appName: string = 'TailorKit'): Promise<void> {
  let timeoutId: NodeJS.Timeout | undefined
  let controller: AbortController | undefined

  try {
    // Input validation
    if (!appName || typeof appName !== 'string') {
      throw new Error('Invalid app name provided')
    }

    const spreadsheetId = '1no2r3K6JH_RZ0h4aMb2uGbDnSYxLDdHfnAaoY3k1bKc'
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is not configured')
    }

    // Setup request with timeout
    controller = new AbortController()
    timeoutId = setTimeout(() => {
      controller?.abort()
      timeoutId = undefined
    }, FIVE_SECONDS_IN_MILLISECONDS)

    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${appName}&headers=1`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'text/plain,application/json',
        },
      }
    ).catch(error => {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out after 5 seconds')
      }
      throw new Error(`Network error while fetching sheet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    })

    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`)
    }

    const text = await response.text().catch(error => {
      throw new Error(`Failed to read response text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    })

    if (!text || typeof text !== 'string') {
      throw new Error('Empty or invalid response received')
    }

    // Extract the JSON data from the response
    // The response format is: /*O_o*/google.visualization.Query.setResponse({...});
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?$/)
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error('Invalid response format from Google Sheets')
    }

    let data
    try {
      data = JSON.parse(jsonMatch[1])
    } catch (error) {
      throw new Error(`Failed to parse sheet data: ${error instanceof Error ? error.message : 'JSON parse error'}`)
    }

    if (!data?.table?.rows || !Array.isArray(data.table.rows)) {
      throw new Error('Invalid sheet data structure: missing rows array')
    }

    const rows = data.table.rows

    if (rows.length === 0) {
      console.log(`No data found in the ${appName} sheet`)
      return
    }

    let successCount = 0
    let errorCount = 0

    // Process each row and create/update announcements
    for (const row of rows) {
      try {
        if (!row || !Array.isArray(row?.c)) {
          console.warn('Skipping invalid row structure:', row)
          errorCount++
          continue
        }

        const [title, description, startDateStr, endDateStr] = row.c.map((cell: any) => {
          if (cell === undefined || cell === null) return null
          return typeof cell.v === 'string' || typeof cell.v === 'number' ? String(cell.v).trim() : null
        })

        if (!title || !description) {
          console.log('Skipping row with missing required fields (title or description)')
          errorCount++
          continue
        }

        // Parse dates - assuming date format like "Date(2025,0,20)"
        const parseDate = (dateStr: string | null) => {
          if (!dateStr) return null
          const match = dateStr.match(/Date\((\d+),(\d+),(\d+)\)/)
          if (!match) {
            console.warn(`Invalid date format for "${title}": ${dateStr}`)
            return null
          }
          try {
            const [, year, month, day] = match.map(Number)
            const date = new Date(year, month, day)
            return isNaN(date.getTime()) ? null : date
          } catch (error) {
            console.warn(
              `Failed to parse date for "${title}":`,
              error instanceof Error ? error.message : 'Date parse error'
            )
            return null
          }
        }

        const startAt = startDateStr ? parseDate(startDateStr) : null
        const endAt = endDateStr ? parseDate(endDateStr) : null

        // Validate dates if both are provided
        if (startAt && endAt && startAt > endAt) {
          console.warn(`Invalid date range for "${title}": start date is after end date`)
          errorCount++
          continue
        }

        // Split description into content array (each paragraph as an element)
        const content = description
          .split('\n')
          .filter(Boolean)
          .map((line: string) => line.trim())

        // Create or update announcement
        await Announcement.findOneAndUpdate(
          { title },
          {
            title,
            content,
            startAt,
            endAt,
            status: 'active',
            tone: 'warning',
          },
          { upsert: true }
        ).catch(error => {
          console.error(
            `Failed to update announcement "${title}":`,
            error instanceof Error ? error.message : 'Database error'
          )
          throw error // This will be caught by the outer try-catch
        })

        successCount++
        console.log(`Processed announcement: ${title}`)
      } catch (error) {
        console.error('Error processing row:', error instanceof Error ? error.message : 'Unknown error')
        errorCount++
        continue
      }
    }

    console.log(`Sync completed for ${appName} sheet. Success: ${successCount}, Errors: ${errorCount}`)
  } catch (error) {
    console.error(
      `Error syncing announcements from ${appName} sheet:`,
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw error // Re-throw to allow caller to handle the error
  } finally {
    // Cleanup
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (controller) {
      controller.abort()
    }
  }
}
