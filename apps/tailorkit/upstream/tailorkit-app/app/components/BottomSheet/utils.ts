import { BottomSheetStore } from './store'
import type { ActiveBottomSheet, BottomSheet } from './types'

function registerBottomSheet(key: string, props?: Partial<BottomSheet>) {
  const bsState = BottomSheetStore.getState()

  if (bsState.bottomSheets?.[key]) {
    return
  }

  BottomSheetStore.dispatch({
    type: 'SET_BOTTOM_SHEET',
    payload: {
      bottomSheets: {
        ...bsState.bottomSheets,
        [key]: {
          ...props,
        },
      },
    },
  })
}

function updateBottomSheetState(updater: (state: any) => any) {
  // bottomSheetStore.setState(state => updater({ ...state }))
  BottomSheetStore.dispatch({
    type: 'SET_BOTTOM_SHEET',
    payload: {
      ...updater({ ...BottomSheetStore.getState() }),
    },
  })
}

function getBottomSheetState(): BottomSheetStore {
  return BottomSheetStore.getState() || ({} as BottomSheetStore)
}

/**
 * Finds the minimum active level from a record of active bottom sheets.
 * @param record - A record of active bottom sheets.
 * @returns The minimum active level or undefined if the record is empty.
 */
function findMinActiveLevel(record: Record<number, ActiveBottomSheet>): number | undefined {
  const levels = Object.keys(record).map(Number)
  return levels.length ? Math.min(...levels) : undefined
}

/**
 * Activates or snaps a bottom sheet to a specific key and manages its level in the hierarchy.
 * @param drawerKey - The key of the bottom sheet to activate.
 * @param fromKey - The key of the current active bottom sheet (optional).
 * @param overlap - Whether the new sheet overlaps the current one (default: true).
 * @param force - Forces an update even if the drawer is already overridden (default: false).
 */
function snapBottomSheet(
  drawerKey: string,
  fromKey: string = '',
  options?: {
    overlap?: boolean
    force?: boolean
    expandOnActive?: boolean
  }
): void {
  try {
    const { bottomSheets = {}, active = {}, root } = getBottomSheetState()
    const { overlap = true, force = false, expandOnActive = true } = options || {}
    // Handle activation from an existing bottom sheet
    if (fromKey) {
      const activeState = isBottomSheetActive(fromKey)
      if (!activeState?.level) return

      const newLevel = overlap ? activeState.level + 1 : activeState.level

      updateActiveState(
        newLevel,
        drawerKey,
        {
          ...activeState,
          drawerKey: fromKey,
        },
        { expandOnActive }
      )
      return
    }

    // Determine the base level for activation
    const minActiveLevel = findMinActiveLevel(active) || 1
    const currentActiveDrawer = active[minActiveLevel]?.drawerKey

    // Skip if the drawer is already overridden and force is not enabled
    if (!force && bottomSheets[currentActiveDrawer]?.override === drawerKey) return

    const metadata = bottomSheets[drawerKey]

    if (metadata) {
      updateActiveState(
        minActiveLevel,
        drawerKey,
        {
          drawerKey: metadata.defaultPrevious || root,
        },
        { expandOnActive }
      )
    }
  } catch (error) {
    console.error('Error in snapBottomSheet:', error)
  }
}

/**
 * Updates the active state of a specific bottom sheet level.
 * @param level - The level to update.
 * @param drawerKey - The key of the bottom sheet to activate.
 * @param previousState - The previous active state to attach (optional).
 */
function updateActiveState(
  level: number,
  drawerKey: string | null,
  previousState?: ActiveBottomSheet,
  otherActiveParams?: Partial<ActiveBottomSheet>
): void {
  updateBottomSheetState(state => ({
    ...state,
    active: {
      ...state.active,
      [level]: drawerKey
        ? {
            drawerKey,
            previous: previousState,
            ...otherActiveParams,
          }
        : undefined,
    },
  }))
}

/**
 * Retrieves detailed data for a specific bottom sheet drawer key.
 * @param drawerKey - The key of the bottom sheet.
 * @returns Combined metadata and active state for the specified drawer key.
 */
function getBottomSheet(drawerKey: string) {
  try {
    const { bottomSheets = {} } = BottomSheetStore.getState()
    const activeData = isBottomSheetActive(drawerKey)
    return { ...bottomSheets[drawerKey], ...activeData, isActive: !!activeData }
  } catch (error) {
    console.error('Error in getBottomSheet:', error)
    return null
  }
}

/**
 * Checks if a bottom sheet is active by key.
 * @param key - The key of the bottom sheet to check.
 * @returns The active state and level, or null if inactive.
 */
function isBottomSheetActive(key: string) {
  try {
    const { active = {} } = getBottomSheetState()

    for (const [level, sheet] of Object.entries(active)) {
      if (sheet.drawerKey === key) {
        return { ...sheet, level: Number(level) }
      }
    }
    return null
  } catch (error) {
    console.error('Error in isBottomSheetActive:', error)
    return null
  }
}

/**
 * Closes a bottom sheet by its key and restores the previous drawer if applicable.
 * @param drawerKey - The key of the bottom sheet to close.
 */
function closeBottomSheetByKey(drawerKey: string): void {
  try {
    const { active = {}, root } = BottomSheetStore.getState() || {}

    // Find the active level for the given key
    const activeLevel = Object.keys(active).find(level => active[level as unknown as number]?.drawerKey === drawerKey)

    if (!activeLevel) {
      console.warn(`Drawer with key "${drawerKey}" is not active.`)
      return
    }

    const level = parseInt(activeLevel, 10)
    const previousState = active[level]?.previous

    if (!previousState) {
      // No previous drawer, simply remove the active entry
      updateActiveState(level, null)
    } else if (level !== previousState.level || root === previousState?.drawerKey) {
      // Restore the previous drawer at the same level
      findAndCloseByKey(drawerKey)
    } else {
      // Restore the previous drawer at the same level
      updateActiveState(level, previousState.drawerKey, previousState.previous, {
        expandOnActive: previousState.expandOnActive ?? true,
      })
    }
  } catch (error) {
    console.error(`Error in closeBottomSheetByKey for drawer "${drawerKey}":`, error)
  }
}

/**
 * Clears a bottom sheet by its key.
 * @param key - The key of the bottom sheet to clear.
 */
function findAndCloseByKey(key: string) {
  const activeState = isBottomSheetActive(key)
  if (activeState?.level) {
    clearBottomSheetByLevel(activeState.level)
  }
}

/**
 * Clears a bottom sheet by its level or multiple levels.
 * @param level - The level(s) of the bottom sheet(s) to clear.
 */
function clearBottomSheetByLevel(level: number | number[]) {
  try {
    const { active = {}, root } = BottomSheetStore.getState()

    if (Array.isArray(level)) {
      level.forEach(l => clearBottomSheetByLevel(l))
      return
    }

    if (!active[level]) return

    const updatedActive = { ...active }
    const { previous } = updatedActive[level]

    delete updatedActive[level]

    if (previous?.drawerKey && previous.drawerKey !== root) {
      if (!isBottomSheetActive(previous.drawerKey)) {
        snapBottomSheet(previous.drawerKey)
      }
    } else if (level === 1 && root) {
      updatedActive[1] = { drawerKey: root, expandOnActive: true }
    }

    BottomSheetStore.dispatch({
      type: 'SET_BOTTOM_SHEET',
      payload: {
        active: updatedActive,
      },
    })
  } catch (error) {
    console.error('Error in clearBottomSheetByLevel:', error)
  }
}

/**
 * Retrieves all active drawer keys from the bottom sheet store.
 * @returns An array of active drawer keys, ordered by their level.
 */
function getAllActiveDrawerKeys(): string[] {
  try {
    const { active = {} } = getBottomSheetState()
    return Object.keys(active)
      .map(Number)
      .sort((a, b) => a - b) // Sort levels in ascending order
      .map(level => active[level]?.drawerKey)
      .filter((key): key is string => !!key) // Ensure valid keys only
  } catch (error) {
    console.error('Error in getAllActiveDrawerKeys:', error)
    return []
  }
}

export {
  closeBottomSheetByKey,
  getBottomSheet,
  registerBottomSheet,
  snapBottomSheet,
  isBottomSheetActive,
  clearBottomSheetByLevel,
  getAllActiveDrawerKeys,
}
