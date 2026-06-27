import { useNavigate } from '@remix-run/react'
import { useAppBridge } from '@shopify/app-bridge-react'
import { useCallback } from 'react'

/**
 * @author: KhanhNT
 * @description
 * The useNavigateAppBridge hook is used to display the discardConfirmation modal when there is a SaveBar before performing navigation.
 *  @param {string} path - The path to navigate to.
 *  @param {function} onLeavePage - The function to call when the page is left.
 */
export const useNavigateAppBridge = () => {
  const shopify = useAppBridge()
  const navigateRemix = useNavigate()

  const navigate = useCallback(
    async (path: string, onLeavePage?: () => void) => {
      await shopify.saveBar
        .leaveConfirmation()
        .then(() => {
          navigateRemix(path, { replace: true })
          typeof onLeavePage === 'function' && onLeavePage()
        })
        .catch(err => {
          console.error('useNavigateAppBridge: ', err)
        })
    },
    [shopify, navigateRemix]
  )

  return navigate
}
