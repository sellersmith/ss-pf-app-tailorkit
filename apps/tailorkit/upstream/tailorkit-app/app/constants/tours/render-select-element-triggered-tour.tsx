import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import type { TourFlowProps } from '.'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { ensureCanvasReady } from './utils/ensureCanvasReady'

/**
 * Tour for first time opening the editor with existing layers.
 * Guides users to select an element on the canvas.
 */
export default function renderSelectElementTriggeredTour({ t }: TourFlowProps): GuidedTourFlow {
  return {
    id: USER_JOURNEY_TYPE.SELECT_ELEMENT_TRIGGERED,
    steps: [
      {
        id: 'select-element-1',
        element: '#canvas-editor',
        title: t('select-element'),
        content: t('select-an-element-to-adjust-its-style-and-add-personalization-options-for-buyers'),
        placement: ECardPlacement.RIGHT_CENTER,
        stagePadding: [4, 4, 4, 4],
        stageRadius: 8,
        recursiveQuery: 500,
        disableActiveInteraction: true,
        showClose: false,
        nextLabel: t('got-it'),
        autoProgressive: true,
        onBeforeMount: ensureCanvasReady,
      },
    ],
  }
}
