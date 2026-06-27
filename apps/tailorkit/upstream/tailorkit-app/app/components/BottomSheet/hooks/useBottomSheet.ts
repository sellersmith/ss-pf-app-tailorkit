import debounce from 'lodash/debounce'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { BottomSheet } from '../types'
import { useStore } from '~/libs/external-store'
import { BottomSheetStore } from '../store'
import { SubInspectorStore } from '~/stores/canvas/subInspector'
import { HEADER_HEIGHT } from '../constant'
import { clearBottomSheetByLevel } from '../utils'

// Global variables for consistent height management across bottom sheets of the same level
let nativeSnapHeight = 0

// Constants for height ratios and offsets
const DEFAULT_SNAP_HEIGHT_RATIO = 0.5
const MIN_SNAP_HEIGHT_RATIO = 0.3
const MAX_SNAP_HEIGHT_OFFSET = 50

/**
 * Utility function to calculate snap points for the BottomSheet.
 * @returns {object} Snap points for `DEFAULT`, `MIN`, and `MAX` heights.
 */
export const calculateSnapPoints = (): { DEFAULT: number; MIN: number; MAX: number } => {
  const windowHeight = window?.innerHeight || 600
  return {
    DEFAULT: windowHeight * DEFAULT_SNAP_HEIGHT_RATIO,
    MIN: windowHeight * MIN_SNAP_HEIGHT_RATIO,
    MAX: windowHeight - MAX_SNAP_HEIGHT_OFFSET,
  }
}

/**
 * Custom hook to manage the BottomSheet behavior, including touch gestures, height updates, and snapping.
 * @param {Object} options - Configuration for the BottomSheet behavior.
 * @param {React.RefObject<HTMLDivElement>} options.drawerRef - Ref for the BottomSheet DOM element.
 * @param {BottomSheet} options.currentDrawer - Current BottomSheet instance properties.
 * @param {boolean} options.isShow - Flag indicating if the BottomSheet is visible.
 * @returns {object} Handlers and state for managing the BottomSheet.
 */
export const useBottomSheet = ({
  drawerRef,
  currentDrawer = {} as BottomSheet,
  isShow,
  defaultClose,
}: {
  currentDrawer?: BottomSheet
  drawerRef?: React.RefObject<HTMLDivElement>
  isShow?: boolean
  defaultClose?: boolean
}) => {
  const { level, expandOnActive = true, drawerKey } = currentDrawer
  const root = useStore(BottomSheetStore, state => state.root)
  const subInspectorKey = useStore(SubInspectorStore, state => state.key)

  const snapPoints = calculateSnapPoints() // Calculate dynamic snap points
  const touchState = useRef({ startY: 0, startHeight: 0, velocity: 0, lastTouchY: 0, lastTouchTime: 0 })
  const isDragging = useRef(false)

  const [, startTransition] = useTransition()

  // State to manage the drawer's current height
  const [drawerHeight, setDrawerHeight] = useState(
    expandOnActive ? Math.max(nativeSnapHeight, HEADER_HEIGHT) : HEADER_HEIGHT
  )

  /**
   * Updates the height of the bottom sheet using CSS transitions.
   * @param height - Target height for the bottom sheet.
   * @param updateRealHeight - Whether to update the real height value.
   */
  const updateDrawerHeight = useCallback(
    (newHeight: number, updateRealHeight?: boolean) => {
      if (drawerRef?.current) {
        drawerRef.current.style.transform = `translateY(${window.innerHeight - (isShow ? newHeight : 0)}px)`
      }
      setDrawerHeight(newHeight)

      if (level === 1 && nativeSnapHeight !== newHeight && updateRealHeight) {
        startTransition(() => {
          nativeSnapHeight = newHeight
        })
      }
    },
    [drawerRef, level, isShow]
  )

  /**
   * Finds the closest snap point based on the current height and swipe velocity.
   * @param {number} height - Current height of the BottomSheet.
   * @param {number} velocity - Current swipe velocity.
   * @returns {number} Closest snap point.
   */
  const findClosestSnapPoint = useCallback(
    (height: number, velocity: number) => {
      const { DEFAULT, MAX } = snapPoints
      const threshold = 32
      const upward = velocity > 0
      const downward = velocity < 0

      if (upward) {
        if (height > DEFAULT + threshold) return MAX
        if (height > HEADER_HEIGHT + threshold) return DEFAULT
        return DEFAULT
      }

      if (downward) {
        if (height < MAX - threshold && height > DEFAULT) return DEFAULT
        if (height < DEFAULT - threshold) return HEADER_HEIGHT
        return HEADER_HEIGHT
      }

      const snapPointsArray = [HEADER_HEIGHT, DEFAULT, MAX]
      return snapPointsArray.reduce(
        (closest, point) => (Math.abs(point - height) < Math.abs(closest - height) ? point : closest),
        HEADER_HEIGHT
      )
    },
    [snapPoints]
  )

  /**
   * Handles the start of a touch gesture to begin dragging.
   */
  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      isDragging.current = true
      const { clientY } = event.touches?.[0]
      touchState.current = {
        startY: clientY,
        startHeight: drawerHeight,
        velocity: 0,
        lastTouchY: clientY,
        lastTouchTime: Date.now(),
      }
    },
    [drawerHeight]
  )

  /**
   * Handles touch movement to adjust the BottomSheet's height.
   */
  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!isDragging.current) return

      const { clientY } = event.touches[0]
      const diffY = touchState.current?.startY - clientY
      const newHeight = Math.max(HEADER_HEIGHT, Math.min(snapPoints.MAX, touchState.current?.startHeight + diffY))

      const now = Date.now()
      const timeDelta = now - touchState.current?.lastTouchTime

      if (timeDelta > 0) {
        touchState.current.velocity = (touchState.current?.lastTouchY - clientY) / timeDelta
        touchState.current.lastTouchY = clientY
        touchState.current.lastTouchTime = now
      }

      updateDrawerHeight(newHeight)
    },
    [snapPoints.MAX, updateDrawerHeight]
  )

  /**
   * Close the drawer with height reset and optional cleanup.
   */
  const closeDrawer = useCallback(() => {
    if (level && level > 1 && drawerHeight > HEADER_HEIGHT) {
      updateDrawerHeight(0)
      debounce(() => clearBottomSheetByLevel(level), 50)()
    } else {
      updateDrawerHeight(HEADER_HEIGHT, true)
    }
  }, [drawerHeight, level, updateDrawerHeight])

  /**
   * Toggle drawer state (open/close).
   */
  const onToggleDrawer = useCallback(() => {
    if (drawerHeight <= HEADER_HEIGHT) {
      updateDrawerHeight(snapPoints.DEFAULT, true)
    } else {
      closeDrawer()
    }
  }, [drawerHeight, closeDrawer, updateDrawerHeight, snapPoints.DEFAULT])

  /**
   * Handles the end of a touch gesture and snaps the bottom sheet to the closest position.
   */
  const onTouchEnd = useCallback(() => {
    isDragging.current = false

    const targetHeight = findClosestSnapPoint(drawerHeight, touchState.current?.velocity)
    updateDrawerHeight(targetHeight, true)

    if (level && level > 1 && targetHeight <= HEADER_HEIGHT + 50) {
      closeDrawer()
    }
  }, [closeDrawer, drawerHeight, findClosestSnapPoint, level, updateDrawerHeight])

  useEffect(() => {
    // Update the drawer height when the window height changes
    if (drawerHeight) {
      updateDrawerHeight(Math.min(drawerHeight, snapPoints.MAX), true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.innerHeight])

  /**
   * Synchronizes height when `isShow` or `nativeHeight` changes.
   * Also expands to DEFAULT height when SubInspector opens.
   */
  useEffect(() => {
    if (drawerHeight <= HEADER_HEIGHT && expandOnActive && isShow && drawerKey !== root) {
      // Expand to DEFAULT height when drawer opens (whether SubInspector is open or not)
      updateDrawerHeight(Math.max(nativeSnapHeight, snapPoints.DEFAULT), true)
    } else if (subInspectorKey && isShow && drawerHeight < snapPoints.DEFAULT) {
      // If drawer is already open but collapsed, and SubInspector opens, expand to DEFAULT
      updateDrawerHeight(snapPoints.DEFAULT, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandOnActive, isShow, root, drawerKey, subInspectorKey])

  useEffect(() => {
    if (defaultClose) {
      closeDrawer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultClose])

  return {
    drawerHeight,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onToggleDrawer,
    closeDrawer,
    updateDrawerHeight, // Expose for programmatic height control
  }
}
