import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import type { TourFlowProps } from '.'
import type { TFunction } from 'i18next'
import type { UseDevices } from '~/utils/hooks/useDevice'
import { ensureDesignTab } from './utils/ensureDesignTab'

/**
 * Tour for Unified Editor
 * - Step 1: Media elements group (layer tools)
 * - Step 2: Print areas bar (manage templates)
 * - Step 3: Canvas editor (personalize elements)
 * - Step 4: Unified editor tabs (generate mockups)
 * - Step 5: Header action buttons (save and publish)
 */
function renderUnifiedEditorTour(_props: TourFlowProps, t: TFunction, deviceData?: UseDevices): GuidedTourFlow {
  const isSmallDesktopView = deviceData?.isSmallDesktopView

  return {
    id: 'unified-editor-tour',
    steps: [
      {
        id: 'unified-editor-1',
        element: '#layer-tools-media-elements',
        title: t('unified-editor-tour-title-1'),
        content: t('unified-editor-tour-content-1'),
        placement: isSmallDesktopView ? ECardPlacement.BOTTOM_RIGHT : ECardPlacement.RIGHT_TOP,
        stagePadding: [8, 8, 8, 8],
        stageRadius: 8,
        recursiveQuery: 500,
        // Do not allow clicking tools during tour
        disableActiveInteraction: true,
        onBeforeMount: ensureDesignTab,
      },
      {
        id: 'unified-editor-2',
        element: '#print-areas-bar',
        title: t('unified-editor-tour-title-2'),
        content: t('unified-editor-tour-content-2'),
        placement: ECardPlacement.TOP_LEFT,
        recursiveQuery: 1000,
        onBeforeMount: ensureDesignTab,
      },
      {
        id: 'unified-editor-3',
        element: '#canvas-editor',
        title: t('unified-editor-tour-title-3'),
        content: t('unified-editor-tour-content-3'),
        placement: ECardPlacement.RIGHT_TOP,
        recursiveQuery: 1000,
      },
      {
        id: 'unified-editor-4',
        element: '#unified-editor-tabs',
        title: t('unified-editor-tour-title-4'),
        content: t('unified-editor-tour-content-4'),
        placement: ECardPlacement.BOTTOM_CENTER,
        recursiveQuery: 1000,
      },
      {
        id: 'unified-editor-5',
        element: '.unified-header-action-buttons',
        title: t('unified-editor-tour-title-6'),
        content: t('unified-editor-tour-content-6'),
        placement: ECardPlacement.BOTTOM_RIGHT,
        stageRadius: 8,
        recursiveQuery: 500,
        showClose: false,
      },
      {
        id: 'unified-editor-7',
        element: '#elements-button',
        title: t('unified-editor-tour-title-7'),
        content: t('unified-editor-tour-content-7'),
        placement: ECardPlacement.RIGHT_TOP,
        stageRadius: 8,
        recursiveQuery: 1000,
        delay: 100,
        nextLabel: t('add-text'),
        preLabel: t('later'),
        onBeforeMount: ensureDesignTab,
        onPre: () => {
          return false
        },
        onNext: () => {
          const buttonElement = document.querySelector('#elements-button') as HTMLButtonElement
          buttonElement?.click()
        },
        showClose: false,
      },
    ],
  }
}

export default renderUnifiedEditorTour
