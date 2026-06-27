import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import type { TourFlowProps } from '.'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { ensureElementsPanelOpen } from './utils/ensureElementsPanelOpen'

/**
 * Tour for first time opening the editor with no layers (blank product).
 * Guides users to discover the Elements panel for adding content.
 *
 * Step 1: Add elements (highlights elements button in left toolbar)
 */
export default function renderEditorIntroTriggeredTour({ t }: TourFlowProps): GuidedTourFlow {
  return {
    id: USER_JOURNEY_TYPE.EDITOR_INTRO_TRIGGERED,
    steps: [
      {
        id: 'editor-intro-1',
        element: '#elements-button',
        title: t('add-elements'),
        content: t('insert-text-images-and-more-to-build-a-stunning-design'),
        placement: ECardPlacement.RIGHT_TOP,
        stagePadding: [4, 4, 4, 4],
        stageRadius: 8,
        recursiveQuery: 500,
        disableActiveInteraction: true,
        showClose: false,
        onBeforeMount: ensureElementsPanelOpen,
        nextLabel: t('got-it'),
      },
    ],
  }
}
