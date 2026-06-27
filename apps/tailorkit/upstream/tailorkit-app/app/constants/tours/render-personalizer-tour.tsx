import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import type { TourFlowProps } from '.'

function renderPersonalizerTour(props: TourFlowProps): GuidedTourFlow {
  const { t } = props

  return {
    id: USER_JOURNEY_TYPE.PERSONALIZE_PRODUCT_QUICK_TOUR,
    steps: [
      {
        id: 'personalize-product-quick-tour-1',
        element: '#print-areas-section',
        title: t('personalize-product-quick-tour-title-1'),
        placement: ECardPlacement.RIGHT_CENTER,
        recursiveQuery: 1000,
      },
      {
        id: 'personalize-product-quick-tour-2',
        element: '#integration-add-template-btn',
        title: t('personalize-product-quick-tour-title-2'),
        placement: ECardPlacement.RIGHT_CENTER,
        recursiveQuery: 1000,
      },
    ],
  }
}

export default renderPersonalizerTour
