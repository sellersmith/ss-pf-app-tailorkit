import { endOfDay, endOfQuarter, formatDate, getQuarter, startOfDay, startOfQuarter, subQuarters } from 'date-fns'
import { type TFunction } from 'i18next'

// Map for quarter names to make translation easier and more maintainable
export const quarterNames: any = {
  1: '1st quarter',
  2: '2nd quarter',
  3: '3rd quarter',
  4: '4th quarter',
}

/**
 * @author KhanhNT
 * Retrieves the last 4 quarters (excluding the current one) and formats them.
 * @param {TFunction} t - The translation function from i18next.
 * @returns {Record<string, { value: string; label: string; title: string; data: { startDate: Date; endDate: Date; }; }>}
 *   A record of quarters data with formatted quarter information and start/end dates.
 */
export const getQuartersFromNearestToFarthest = (t: TFunction) => {
  /**
   * Helper function to translate the quarter number to its corresponding name.
   * @param {number} quarter - The quarter number (1-4).
   * @returns {string} The translated quarter name (e.g., "1st quarter").
   */
  const formatQuarter = (quarter: number) => t(quarterNames[quarter] || '')

  // Object to hold data for each quarter, with the formatted label, title, and date range
  const quartersData: Record<
    string,
    { value: string; label: string; title: string; data: { startDate: Date; endDate: Date } }
  > = {}

  /**
   * Sets the quarter information into the quartersData object, with formatted labels and dates.
   * @param {Date} date - The date from which the quarter will be calculated.
   */
  const setQuarterInfo = (date: Date) => {
    const quarter = getQuarter(date)
    const year = formatDate(date, 'yyyy')
    const start = startOfQuarter(date)
    const end = endOfQuarter(date)

    // Get the translated quarter name (e.g., "1st quarter") and remove spaces for use as the key
    const formattedQuarter = formatQuarter(quarter)
    const key = formattedQuarter.replace(' ', '') // Use replace for compatibility with older browsers

    // Store the quarter information in the quartersData object, using the formatted key
    quartersData[key] = {
      value: key,
      label: `${formattedQuarter} (${year})`,
      title: `${formattedQuarter} (${year})`,
      data: {
        startDate: startOfDay(start),
        endDate: endOfDay(end),
      },
    }
  }

  const date = new Date()

  // Loop through the last 4 quarters (excluding the current one) to populate the quartersData object
  for (let i = 1; i < 5; i++) {
    // Subtract i quarters from the current date
    const pastDate = subQuarters(date, i)
    setQuarterInfo(pastDate)
  }

  return quartersData
}
