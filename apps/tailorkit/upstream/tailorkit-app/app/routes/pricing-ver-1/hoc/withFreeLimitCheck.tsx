import { Fragment, useEffect, type ComponentType } from 'react'
import ModalShowFreeLimitOrdersEnded from '../components/ModalShowFreeLimitOrdersEnded'
import { useRootLoaderData } from '~/root'
import { canUseFreeResources } from '~/models/PricingPlan.fns'
import { useModal } from '~/utils/hooks/useModal'
import { EModal } from '~/constants/enum'
import useLCPRecorded from '~/utils/useLCPRecorded'

/**
 * HOC for checking if customer has already exceed free resources or not.
 * This modal will show each time customer redirect to route definition
 *
 * @important This HOC only can use for route file to use `useRootLoaderData` hook for getting shop data
 *
 * @param WrappedComponent ComponentType<P>
 * @returns
 */

const MODAL_KEY = EModal.FREE_LIMIT_ORDERS_HAVE_ENDED

export function withFreeLimitCheck<P extends JSX.IntrinsicAttributes>(WrappedComponent: ComponentType<P>): React.FC<P> {
  return function EnhancedComponent(props: P) {
    const lcpRecorded = useLCPRecorded()

    const { openModal, closeModal } = useModal()

    const { shopData } = useRootLoaderData()

    useEffect(() => {
      // Wait for LCP recorded to avoid bad LCP score
      if (!lcpRecorded) return

      const isPossibleUseFreeResources = canUseFreeResources({ shopData })

      // Open modal exceed free order without a pricing plan
      if (!isPossibleUseFreeResources) {
        openModal(MODAL_KEY)
      }

      return () => {
        closeModal(MODAL_KEY)
      }
    }, [shopData, lcpRecorded, openModal, closeModal])

    return (
      <Fragment>
        {/* Render wrapped component */}
        <WrappedComponent {...props} />

        {/* Render modal show free limit orders ended */}
        <ModalShowFreeLimitOrdersEnded />
      </Fragment>
    )
  }
}
