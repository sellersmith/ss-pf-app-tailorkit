import { useCallback, useLayoutEffect } from 'react'
import { useTourGuide } from '~/bootstrap/hoc/withTourGuide'
import { useStore } from '~/libs/external-store'
import { tourStore } from '~/stores/tour'

/**
 * Use template editor tour
 *
 * @param mount - Whether to mount the tour, it should only true in one component to avoid side effects
 * @returns {tourId: string, active: boolean}
 */
export function useTourStatus(mount: boolean = false) {
  const { tour: tourId } = useTourGuide()
  const tourState = useStore(tourStore, state => state)

  const onSetTour = useCallback((tourId: string, active: boolean) => {
    tourStore.dispatch({ type: 'SET_TOUR', payload: { key: tourId, active } })
  }, [])

  useLayoutEffect(() => {
    if (tourId && mount) {
      onSetTour(tourId, true)
      return () => onSetTour(tourId, false)
    }
  }, [mount, onSetTour, tourId])

  const currentTourActive = tourState[tourId]?.active

  return {
    tourId,
    active: currentTourActive === undefined && !!tourId ? true : currentTourActive,
    onSetTour,
  }
}
