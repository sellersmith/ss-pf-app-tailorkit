import { useBreakpoints } from '@shopify/polaris'
import { isIOS, isIPhone13, isIPod13, isMobileOnly, isMobileSafari } from 'react-device-detect'
import { isShopifyMobileApp } from '~/constants/shopify'
import { isMacOS } from '~/bootstrap/fns/os'

export type UseDevices = {
  /**
   * @description Whether the device is a mobile device
   * Either a mobile browser or a Shopify mobile app or mdDown
   */
  isMobileView: boolean
  /**
   * @description Whether the device is a desktop device
   * Opposite of isMobileView
   */
  isDesktopView: boolean
  /**
   * @description Whether the device is a small desktop device
   * Either a small desktop browser or a small desktop app
   */
  isSmallDesktopView: boolean
  /**
   * @description Whether the device is an iOS device
   * Either a iOS device or a iOS browser
   */
  isIOS: boolean
  /**
   * @description Whether the device is a small mobile device
   * Either a small mobile browser or a small mobile app
   */
  isSmallMobileView: boolean
  /**
   * @description Whether the device is macOS
   */
  isMacOS: boolean
  /**
   * @description Whether the device is a mobile device
   * Either a mobile browser or a Shopify mobile app
   */
  isMobile: boolean
}

/**
 * @description A hook to check if the device is a mobile device
 * @returns {Object} An object containing the device type and if it is a small mobile device
 */
export default function useDevices(): UseDevices {
  const { smDown, mdDown, lgDown } = useBreakpoints()

  const isMobileView = isMobileOnly || mdDown || isShopifyMobileApp()
  const isDesktopView = !isMobileView
  const isSmallDesktopView = lgDown

  ///iPad|iPhone|iPod/.test(navigator.userAgent) // || (/Mac/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  const isIOSMobile = (isIOS || isMobileSafari || isIPhone13 || isIPod13) && isMobileView

  return {
    isMobileView,
    isDesktopView,
    isSmallDesktopView,
    isIOS: isIOSMobile,
    isSmallMobileView: smDown,
    // Check if window.navigator is defined
    isMacOS: typeof window !== 'undefined' && isMacOS(),
    isMobile: isMobileOnly || isShopifyMobileApp(),
  }
}
