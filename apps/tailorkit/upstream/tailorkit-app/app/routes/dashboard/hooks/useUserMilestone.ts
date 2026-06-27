import { useCallback, useEffect, useState } from 'react'
import { getUserMilestonsData } from '../utilities/getUserMilestonsData'

/**
 * Custom hook to fetch user milestones data
 * @returns {Object} User milestones data
 */
export const useUserMilestone = () => {
  const [achieveFirstSaleEvent, setAchieveFirstSaleEvent] = useState<any>(null)

  const fetchUserMilestonesData = useCallback(async () => {
    try {
      const userMilestonesData = await getUserMilestonsData()
      if (!userMilestonesData) {
        return
      }

      setAchieveFirstSaleEvent(userMilestonesData)
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => {
    fetchUserMilestonesData()
  }, [fetchUserMilestonesData])

  return {
    achieveFirstSaleEvent,
  }
}
