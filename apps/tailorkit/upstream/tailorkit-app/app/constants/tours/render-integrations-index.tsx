import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import type { TourFlowProps } from '.'

/**
 * Tour for Integrations Index page
 * - Step 1: Create Personalized Product button
 * - Step 2: Ask Elva AI chat button
 */
function renderIntegrationsIndexTour(props: TourFlowProps): GuidedTourFlow {
  const { t } = props

  return {
    id: 'integrations-index-tour',
    steps: [
      {
        id: 'integrations-index-1',
        element: '#btn-create-personalized-product', // Page primary action button
        title: t('integrations-index-1-tour'),
        content: t('integrations-index-1-tour-content'),
        placement: ECardPlacement.BOTTOM_CENTER,
        stagePadding: [8, 8, 8, 8],
        stageRadius: 8,
        recursiveQuery: 500,
        arrowSelector: '#btn-create-personalized-product',
        arrowConfig: {
          placement: ECardPlacement.TOP_CENTER,
          startPosition: 'top',
          offset: [0, -10],
        },
        // Do not allow clicking the button during tour
        disableActiveInteraction: true,
      },
      {
        id: 'integrations-index-2',
        element: '#chat-bot-button', // Crisp chat widget
        title: t('integrations-index-2-tour'),
        content: t('integrations-index-2-tour-content'),
        placement: ECardPlacement.TOP_CENTER,
        stagePadding: [8, 8, 8, 8],
        stageRadius: 8,
        recursiveQuery: 500,
        arrowSelector: '#chat-bot-button',
        arrowConfig: {
          placement: ECardPlacement.TOP_CENTER,
          startPosition: 'top',
          offset: [0, -10],
        },
        nextLabel: t('got-it'),
        showClose: false,
        // Do not allow clicking the chat button during tour
        disableActiveInteraction: true,
      },
    ],
  }
}

export default renderIntegrationsIndexTour
