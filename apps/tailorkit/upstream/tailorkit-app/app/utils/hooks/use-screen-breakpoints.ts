/**
 * Real pixel-based breakpoints derived from window.innerWidth.
 *
 * Polaris useBreakpoints() measures the Shopify Admin iframe width which can
 * diverge from the actual viewport on Windows (visible scrollbars ~17px, DPI
 * scaling). This hook reads real window.innerWidth via useWindowSize and derives
 * the same breakpoint booleans, ensuring JS-driven responsive logic matches
 * CSS @media queries.
 *
 * Drop-in replacement for useDevices() — returns the same UseDevices shape.
 */

import { isMobileOnly, isIOS, isIPhone13, isIPod13, isMobileSafari } from 'react-device-detect'
import { isShopifyMobileApp } from '~/constants/shopify'
import { isMacOS } from '~/bootstrap/fns/os'
import useWindowSize from './useWindowSize'
import type { UseDevices } from './useDevice'

/** Polaris-equivalent pixel thresholds */
const SM_BREAKPOINT = 490
const MD_BREAKPOINT = 768
const LG_BREAKPOINT = 1040

/**
 * Derives Polaris-compatible breakpoint booleans from real window.innerWidth.
 * Combines pixel measurement with UA device detection (same as useDevices).
 */
export default function useScreenBreakpoints(): UseDevices {
  const { width } = useWindowSize()

  const smDown = width < SM_BREAKPOINT
  const mdDown = width < MD_BREAKPOINT
  const lgDown = width < LG_BREAKPOINT

  const isMobileView = isMobileOnly || mdDown || isShopifyMobileApp()
  const isIOSMobile = (isIOS || isMobileSafari || isIPhone13 || isIPod13) && isMobileView

  return {
    isMobileView,
    isDesktopView: !isMobileView,
    isSmallDesktopView: lgDown,
    isIOS: isIOSMobile,
    isSmallMobileView: smDown,
    isMacOS: typeof window !== 'undefined' && isMacOS(),
    isMobile: isMobileOnly || isShopifyMobileApp(),
  }
}
