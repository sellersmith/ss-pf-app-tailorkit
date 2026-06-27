import type { TFunction } from 'i18next'
import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'

const SHARED_STEP_CONFIG = {
  stagePadding: [4, 4, 4, 4] as [number, number, number, number],
  stageRadius: 8,
  disableActiveInteraction: true,
  recursiveQuery: 20,
}

/**
 * Build the main toolbar tour flow (5 steps).
 */
export function buildToolbarTourFlow(t: TFunction): GuidedTourFlow {
  return {
    id: USER_JOURNEY_TYPE.MOCKUP_WIZARD_TOOLBAR_TOUR,
    steps: [
      {
        id: 'mw-toolbar-pan',
        element: '#mockup-wizard-btn-pan',
        title: t('select-and-pan'),
        content: t('tap-to-select-existing-shapes-drag-to-pan-around-the-canvas'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 'mw-toolbar-rectangle',
        element: '#mockup-wizard-btn-rectangle',
        title: t('draw-rectangles'),
        content: t('click-and-drag-on-the-canvas-to-draw-rectangular-selection-areas'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 'mw-toolbar-ellipse',
        element: '#mockup-wizard-btn-ellipse',
        title: t('draw-ellipses'),
        content: t('click-and-drag-to-draw-elliptical-selection-areas-for-rounded-shapes'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 'mw-toolbar-vector',
        element: '#mockup-wizard-btn-vector',
        title: t('draw-vector-paths'),
        content: t('click-to-place-points-and-drag-for-curves-to-create-custom-selection-shapes'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 'mw-toolbar-manipulate',
        element: '#mockup-wizard-btn-manipulate',
        title: t('move-and-resize'),
        content: t('select-a-shape-to-move-resize-with-handles-or-rotate-it-into-position'),
        placement: ECardPlacement.BOTTOM_CENTER,
        nextLabel: t('got-it'),
        ...SHARED_STEP_CONFIG,
      },
    ],
  }
}

/**
 * Check if a vector sub-button is missing from the DOM.
 * Used as `skipThisStepWhen` to gracefully skip steps when vector drawing mode exits.
 */
function isVectorButtonMissing(selector: string): () => boolean {
  return () => !document.querySelector(selector)
}

/**
 * Build the vector sub-buttons tour flow (4 steps).
 */
export function buildVectorTourFlow(t: TFunction): GuidedTourFlow {
  return {
    id: USER_JOURNEY_TYPE.MOCKUP_WIZARD_VECTOR_TOUR,
    steps: [
      {
        id: 'mw-vector-undo',
        element: '#mockup-wizard-btn-undo',
        title: t('undo'),
        content: t('remove-the-last-point-you-placed'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        recursiveQuery: 30,
        skipThisStepWhen: isVectorButtonMissing('#mockup-wizard-btn-undo'),
      },
      {
        id: 'mw-vector-redo',
        element: '#mockup-wizard-btn-redo',
        title: t('redo'),
        content: t('restore-a-point-you-removed-with-undo'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isVectorButtonMissing('#mockup-wizard-btn-redo'),
      },
      {
        id: 'mw-vector-complete',
        element: '#mockup-wizard-btn-complete',
        title: t('complete-path'),
        content: t('finish-your-vector-shape-and-convert-it-to-a-selection-area'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isVectorButtonMissing('#mockup-wizard-btn-complete'),
      },
      {
        id: 'mw-vector-cancel',
        element: '#mockup-wizard-btn-cancel',
        title: t('cancel-drawing'),
        content: t('discard-the-current-vector-path-and-start-over'),
        placement: ECardPlacement.BOTTOM_CENTER,
        nextLabel: t('got-it'),
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isVectorButtonMissing('#mockup-wizard-btn-cancel'),
      },
    ],
  }
}
