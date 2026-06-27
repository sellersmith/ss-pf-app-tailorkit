import { useState, useEffect } from 'react'
import { fetchPurchasedCreditsInCycle } from '../fns'

/**
 * Custom hook to fetch purchased AI credits data in current billing cycle
 *
 * Returns:
 * - total: Total purchased credits at start of cycle
 * - used: Purchased credits used in cycle
 * - remaining: Purchased credits available
 *
 * Single Source of Truth: AiCreditTransaction collection (queried via API)
 *
 * @returns Object containing purchased credits data and loading state
 */
export function usePurchasedCredits() {
  const [data, setData] = useState({
    total: 0,
    used: 0,
    remaining: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const purchasedCreditsData = await fetchPurchasedCreditsInCycle()
        setData(purchasedCreditsData)
      } catch (error) {
        console.error('Failed to fetch purchased credits:', error)
        setData({ total: 0, used: 0, remaining: 0 })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading }
}
