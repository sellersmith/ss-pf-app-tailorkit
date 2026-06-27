import { useEffect } from 'react'
import type { BottomSheet } from '~/components/BottomSheet'
import { BottomSheetStore } from '~/components/BottomSheet'
import { EMPTY_ARRAY } from '~/constants'

// Utility to create the bottom sheet dictionary from the array
const createBottomSheetDictionary = (bottomSheets: BottomSheet[]) =>
  bottomSheets.reduce(
    (acc, drawer) => ({
      ...acc,
      [drawer.drawerKey]: drawer,
    }),
    {} as Record<string, BottomSheet>
  )

/**
 * Initializes the bottom sheet state with a given list of registered bottom sheets.
 * - Registers all provided bottom sheets into the state.
 * - Sets the default active bottom sheet and root if not already defined.
 *
 * @param {BottomSheet[]} registeredBottomSheets - List of bottom sheets to initialize.
 */
export const useInitiateBottomSheet = (registeredBottomSheets: BottomSheet[] = EMPTY_ARRAY) => {
  useEffect(() => {
    // Find the default drawer if defined
    const initialDrawer = registeredBottomSheets?.find(({ isDefault }) => isDefault)

    const state = BottomSheetStore.getState()
    const bottomSheetDictionary = createBottomSheetDictionary(registeredBottomSheets)

    const initialState = {
      ...state,
      bottomSheets: {
        ...state.bottomSheets,
        ...bottomSheetDictionary,
      },
    }

    if (initialDrawer) {
      if (!state.active[`1`]) {
        initialState.active[`1`] = { drawerKey: initialDrawer.drawerKey }
      }

      if (!state.root) {
        initialState.root = initialDrawer.drawerKey
      }
    }

    BottomSheetStore.dispatch({
      type: 'SET_BOTTOM_SHEET',
      payload: {
        ...initialState,
      },
    })
  }, [registeredBottomSheets])
}
