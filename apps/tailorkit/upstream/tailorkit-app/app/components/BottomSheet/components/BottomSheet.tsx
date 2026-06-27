import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActiveBottomSheet, BottomSheetDrawerProps } from '../types'
import { calculateSnapPoints, useBottomSheet } from '../hooks'
import { HEADER_HEIGHT } from '../constant'
import { createPortal } from 'react-dom'
import { BottomSheetHeader } from './BottomSheetHeader'
import { Divider, Scrollable } from '@shopify/polaris'
import backdropStyles from './backdrop.module.css'
import styles from './bottomSheet.module.css'
import isNaN from 'lodash/isNaN'

/**
 * BottomSheet Component
 * A flexible, customizable drawer component designed for responsive and dynamic UI interactions.
 *
 * Props:
 * - `children`: Content to display inside the BottomSheet.
 * - `scrollable`: Enables scrolling within the BottomSheet body.
 * - `filters`: Custom filter controls to render above the BottomSheet content.
 * - `useBackdrop`: Whether to show a backdrop behind the BottomSheet.
 * - `customBackDrop`: Custom backdrop element to override the default one.
 * - `bouncingOnShow`: Adds a bounce animation when the BottomSheet first appears.
 * - `id`: Unique identifier for the BottomSheet.
 * - `isShowing`: Controls visibility of the BottomSheet.
 * - `drawerKey`: Unique key to identify this BottomSheet instance.
 * - `activeDrawer`: Active BottomSheet object (e.g., level and state).
 * - `lazyRender`: Enables lazy rendering of the BottomSheet's content.
 *
 * Default Behavior:
 * - Provides a header with close functionality.
 * - Renders children lazily if `lazyRender` is enabled.
 * - Supports touch-based interactions with drag-to-close.
 *
 * Example Usage:
 * ```tsx
 * <BottomSheet
 *   id="exampleDrawer"
 *   isShowing={true}
 *   scrollable
 *   useBackdrop
 *   bouncingOnShow
 * >
 *   <div>Your Content</div>
 * </BottomSheet>
 * ```
 */
export const BottomSheet = ({
  children,
  scrollable,
  filters,
  useBackdrop,
  customBackDrop,
  bouncingOnShow,
  id,
  isShowing,
  drawerKey,
  activeDrawer,
  lazyRender = false,
  bodyStyles,
  defaultClose,
  ...props
}: BottomSheetDrawerProps & {
  isShowing?: boolean
  activeDrawer?: ActiveBottomSheet
}) => {
  const drawerRef = useRef<HTMLDivElement>(null)

  // State for bounce animation and lazy rendering.
  const [isBouncing, setIsBouncing] = useState(bouncingOnShow)
  const [shouldRenderBody, setShouldRenderBody] = useState(!lazyRender) // Track if the BottomSheet has been opened at least once

  // Hook to manage bottom sheet height and touch gestures.
  const { drawerHeight, updateDrawerHeight, ...touchHandler } = useBottomSheet({
    drawerRef,
    currentDrawer: activeDrawer,
    isShow: isShowing,
    defaultClose: defaultClose,
  })

  // Safely access level with a default value of 1
  const level = !isNaN(activeDrawer?.level) && activeDrawer?.level ? activeDrawer.level : 1

  const snapPoints = calculateSnapPoints()

  /**
   * Dynamically calculate z-index based on drawer level.
   */
  const drawerZIndex = useMemo(() => level * 10 + 100, [level])

  /**
   * Determine if the BottomSheet is currently open.
   */
  const isOpened = useMemo(() => {
    return drawerHeight > snapPoints.MIN && drawerHeight > HEADER_HEIGHT
  }, [drawerHeight, snapPoints.MIN])

  /**
   * Calculate body height dynamically based on drawer height.
   */
  const bodyHeight = useMemo(() => drawerHeight - HEADER_HEIGHT, [drawerHeight])

  /**
   * Memoized children for efficient re-renders.
   */
  const memoizedChildren = useMemo(() => {
    return shouldRenderBody && children
  }, [children, shouldRenderBody])

  /**
   * Calculate the transform value for bounce animation
   */
  const getTransformValue = useMemo(() => {
    const transformHeight = window.innerHeight - (drawerHeight || HEADER_HEIGHT)
    return `translateY(${isShowing ? transformHeight : 0}px)`
  }, [drawerHeight, isShowing])

  /**
   * Manage bounce animation on initial show.
   */
  useEffect(() => {
    if (bouncingOnShow && !isOpened) {
      setIsBouncing(!!children)
      const timer = setTimeout(() => {
        setIsBouncing(false)
      }, 300)

      return () => clearTimeout(timer)
    }
  }, [bouncingOnShow, children, isOpened])

  /**
   * Lazy rendering logic to improve performance for hidden drawers.
   */
  useEffect(() => {
    if (!isOpened && memoizedChildren && lazyRender) {
      setShouldRenderBody(false) // Reset when the BottomSheet is closed and children change
    }
  }, [memoizedChildren, lazyRender, isOpened])

  // Trigger visibility and track the first open
  useEffect(() => {
    if (lazyRender) {
      let timer: NodeJS.Timeout
      if (isOpened && !shouldRenderBody) {
        timer = setTimeout(() => {
          setShouldRenderBody(true)
        }, 169) // Delay rendering children by 100ms to prevent freezing
      } else {
        setShouldRenderBody(false) // Reset when closed
      }
      return () => clearTimeout(timer)
    }
  }, [isOpened, lazyRender, shouldRenderBody])

  /**
   * Handle backdrop click to close the drawer.
   */
  const handleBackdropClick = useCallback(() => {
    if ((level > 1 || useBackdrop) && touchHandler?.closeDrawer) {
      touchHandler?.closeDrawer() // Close the bottom sheet
    }
  }, [level, touchHandler, useBackdrop])

  // Construct the CSS classes for the drawer
  const drawerClasses = useMemo(() => {
    let classes = `${styles.styledDrawer} mobile-drawer`
    if (isShowing) classes += ` ${styles.styledDrawerOpen}`
    if (isBouncing && !isOpened) classes += ` ${styles.bounceAnimation}`
    return classes
  }, [isShowing, isBouncing, isOpened])

  // Set transform height CSS variable for bounce animation
  useEffect(() => {
    if (drawerRef.current) {
      let transformHeight = `${window.innerHeight - (drawerHeight || HEADER_HEIGHT)}px`

      // If drawer height is greater than half of the window height,
      // set transform height to 100vh - 24px to avoid the content overflow and make the drawer show blank content on mobile
      if (drawerHeight > window.innerHeight / 2) {
        transformHeight = `calc(100vh - 24px)`
      }

      drawerRef.current.style.setProperty('--transform-height', `${transformHeight}`)
    }
  }, [drawerHeight, isShowing])

  return createPortal(
    <>
      {isOpened && (useBackdrop || level > 1)
        ? customBackDrop || (
            <div
              className={backdropStyles.BottomSheetBackdrop}
              style={{ zIndex: (drawerZIndex || 0) - 1 }}
              onClick={handleBackdropClick}
            />
          )
        : null}
      <div
        id={id}
        className={drawerClasses}
        ref={drawerRef}
        style={{
          zIndex: drawerZIndex || 0,
          display: 'block',
          transform: getTransformValue,
        }}
      >
        {/* Drawer Header */}
        <BottomSheetHeader {...props} {...touchHandler} />
        <Divider />
        {filters ? filters : null}
        <div
          className="d-flex fdc"
          style={{
            // height: isOpened ? '100%' : bodyHeight,
            transition: 'height 0.15s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            id="mobile-inspector-container"
            className={`pr ${styles.drawerBody}`}
            style={{
              height: bodyHeight,
              transition: 'visibility 0.2s ease, opacity 0.2s ease',
              visibility: isOpened || shouldRenderBody ? 'visible' : 'hidden', // Persistent rendering
              opacity: isOpened ? 1 : 0, // Smooth fade-out effect
              transform: isOpened ? 'translateY(0)' : 'translateY(20px)', // Offscreen positioning
              ...bodyStyles,
            }}
          >
            {scrollable ? <Scrollable style={{ flex: 1 }}>{memoizedChildren}</Scrollable> : memoizedChildren}
          </div>
        </div>
      </div>
    </>,
    document?.body
  )
}
