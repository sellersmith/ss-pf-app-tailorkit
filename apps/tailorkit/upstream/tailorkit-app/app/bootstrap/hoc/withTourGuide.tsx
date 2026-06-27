import { useNavigate, useSearchParams } from '@remix-run/react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TOUR_FLOWS } from '~/constants/tours'
import type { UserJourneyDocument } from '~/models/UserJourney'
import { tourGuideComponents } from '~/modules/TourGuides'
import { authenticatedFetch } from '~/shopify/fns.client'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import useDevices from '~/utils/hooks/useDevice'

// Flag for enabling tour guide when needed
const enableTourGuide = true

/**
 * HOC is served for tour guide.
 * In order to enable this feature, we wrap this HOC to the screen that we need.
 * By default, we just searchParams to check if a specific tour should be enable, we can pass the tourId manually btw.
 *
 * @param Component
 * @param tourId
 * @returns
 */

export default function withTourGuide<T extends React.ElementType>(Component: T, tour_id?: string) {
  return function WithTourGuide(props: React.ComponentProps<T>) {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const deviceData = useDevices()
    const isMobileView = deviceData.isMobileView

    // Journey state
    const [tourJourney, setTourJourney] = useState<UserJourneyDocument | undefined | null>(undefined)
    const [loaded, setLoaded] = useState(false)

    // Get tour id on params
    const tourId = searchParams.get('tour') || tour_id || ''

    const flow = useMemo(() => {
      // Get render flow function
      const render = TOUR_FLOWS[tourId]

      return typeof render === 'function' ? render({ t, navigate, deviceData }) : null
    }, [tourId, t, navigate, deviceData])

    const TourGuideComponent = useMemo(() => tourGuideComponents[tourId], [tourId])

    useEffect(() => {
      ;(async () => {
        try {
          const userJourney = await getUserJourneyOfTourGuide(tourId)

          // Set tour journey
          if (userJourney) {
            setTourJourney(userJourney)
          } else {
            setTourJourney(null)
          }

          setLoaded(true)
        } catch (e) {
          console.log(formatErrorMessage(e))
        }
      })()
    }, [tourId])

    return (
      <Fragment>
        <Component {...props} />

        {flow && enableTourGuide && loaded && !isMobileView && (
          <TourGuideComponent key={tourJourney?.type || tourId} flow={flow} tourJourney={tourJourney} />
        )}
      </Fragment>
    )
  }
}

/**
 * Hook for returning tour guide information
 *
 * @returns {tour: string}
 */
export function useTourGuide() {
  const [searchParams] = useSearchParams()

  const tour = searchParams.get('tour') || ''

  return {
    tour,
  }
}

/**
 * Get user journey of tour guide
 *
 * @param tourId
 * @returns
 */
export async function getUserJourneyOfTourGuide(tourId: string, preferCache = false, version = '1') {
  try {
    const response = await authenticatedFetch(`/api/user-journey?type=${tourId}&version=${version}`, {
      preferCache,
    })

    if (!response.success) {
      throw new Error(response.message)
    }

    return response.userJourney
  } catch (e) {
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Check if the tour is a tutorial guide
 *
 * @param tourId
 * @returns
 */
export function isTutorialGuide(tourId: string) {
  return tourId.includes('tutorial')
}
