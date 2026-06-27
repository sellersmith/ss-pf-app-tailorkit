import type { MODAL_ID } from '~/constants/modal'

/**
 * This hook serve for cases that need to redirect embedded scree out of modal
 * @NOTE REMEMBER CLEAR urlNavigator after hiding modal to prevent caching
 * @param modalId
 * @returns
 */

export function useNavigateOnMaxModal(modalId: MODAL_ID) {
  function navigate(path: string) {
    const shopifyTailorKitState = window.opener.shopify.tailorkit

    window.opener.shopify.tailorkit = {
      ...(shopifyTailorKitState || {}),
      modals: {
        ...(shopifyTailorKitState?.modals || {}),
        [modalId]: {
          urlNavigator: path,
        },
      },
    }

    window.opener.shopify.modal.hide(modalId)
  }

  /**
   * @NOTE This function only run on MAX MODAL, not frame of MAX MODAL
   */
  function setURLNavigator(path: string) {
    const shopifyTailorKitState = window.shopify.tailorkit

    window.shopify.tailorkit = {
      ...(shopifyTailorKitState || {}),
      modals: {
        ...(shopifyTailorKitState?.modals || {}),
        [modalId]: {
          urlNavigator: path,
        },
      },
    }
  }

  return {
    navigate,
    setURLNavigator,
  }
}
