import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import type { TourFlowProps } from '.'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'

/**
 * Tour for first time clicking a text layer.
 * Guides users through text formatting, personalization, and publishing.
 *
 * Step 1: Style your text (format toolbar)
 * Step 2: Let buyers personalize (right inspector panel)
 * Step 3: Publish to your store (publish button)
 */
export default function renderTextLayerGuideTriggeredTour({ t, deviceData }: TourFlowProps): GuidedTourFlow {
  // On desktop, inspector is on the LEFT — tour card should appear to the RIGHT of it
  const isDesktop = !deviceData?.isMobileView
  return {
    id: USER_JOURNEY_TYPE.TEXT_LAYER_GUIDE_TRIGGERED,
    steps: [
      {
        id: 'text-layer-guide-1',
        element: '#styling-toolbar > div:nth-child(1)',
        title: t('style-your-text'),
        content: t('choose-fonts-colors-and-effects-to-make-your-design-stand-out'),
        placement: ECardPlacement.RIGHT_TOP,
        stagePadding: [4, 4, 4, 4],
        stageRadius: 12,
        recursiveQuery: 500,
        // disableActiveInteraction: true — toolbar is view-only during guide.
        // Image tour Step 1 omits this to allow inspector exploration (AI effects, options).
        disableActiveInteraction: true,
        showClose: false,
      },
      {
        id: 'text-layer-guide-2',
        element: '.template-inspector-container',
        title: t('let-buyers-personalize'),
        content: t('enable-text-options-so-customers-can-customize-their-own-message'),
        placement: isDesktop ? ECardPlacement.RIGHT_TOP : ECardPlacement.LEFT_TOP,
        stagePadding: [4, 4, 4, 4],
        stageRadius: 8,
        recursiveQuery: 500,
        disableActiveInteraction: true,
        showClose: false,
      },
      {
        id: 'text-layer-guide-3',
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
