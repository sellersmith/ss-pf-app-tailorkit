import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import type { TourFlowProps } from '.'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'

/**
 * Tour for first time clicking an image layer.
 * Guides users through image personalization and publishing.
 *
 * Step 1: Personalize image (right inspector panel)
 * Step 2: Make it live to start selling! (Publish button)
 */
export default function renderImageLayerGuideTriggeredTour({ t, deviceData }: TourFlowProps): GuidedTourFlow {
  // On desktop, inspector is on the LEFT — tour card should appear to the RIGHT of it
  const isDesktop = !deviceData?.isMobileView

  return {
    id: USER_JOURNEY_TYPE.IMAGE_LAYER_GUIDE_TRIGGERED,
    steps: [
      {
        id: 'image-layer-guide-1',
        element: '.template-inspector-container',
        title: t('let-buyers-personalize'),
        content: t('enable-image-upload-and-customization-options-for-your-customers'),
        placement: isDesktop ? ECardPlacement.RIGHT_TOP : ECardPlacement.LEFT_TOP,
        stagePadding: [4, 4, 4, 4],
        stageRadius: 8,
        recursiveQuery: 500,
        showClose: false,
        // disableActiveInteraction intentionally omitted — allows inspector interaction
        // so users can explore AI effects and image options during the tour.
      },
      {
        id: 'image-layer-guide-2',
        element: '#integration-publish-btn',
        title: t('publish-to-your-store'),
        content: t('save-your-design-then-publish-so-customers-can-start-ordering'),
        placement: ECardPlacement.BOTTOM_RIGHT,
        stagePadding: [4, 4, 4, 4],
        stageRadius: 8,
        recursiveQuery: 500,
        disableActiveInteraction: true,
        showClose: false,
        nextLabel: t('got-it'),
      },
    ],
  }
}
