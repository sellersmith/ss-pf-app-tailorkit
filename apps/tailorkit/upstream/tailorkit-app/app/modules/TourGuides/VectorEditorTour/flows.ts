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

/** Check if button is missing from DOM (used for conditional steps) */
function isButtonMissing(selector: string): () => boolean {
  return () => !document.querySelector(selector)
}

/**
 * Build the Edit mode toolbar tour flow.
 * Covers: mode toggle, history, selection, edit actions, style controls,
 * clip/hole paths, extend/break, layer ordering
 */
export function buildEditModeTourFlow(t: TFunction): GuidedTourFlow {
  return {
    id: USER_JOURNEY_TYPE.VECTOR_EDITOR_EDIT_MODE_TOUR,
    steps: [
      // Mode toggle
      {
        id: 've-edit-draw-mode',
        element: '#ve-btn-draw-mode',
        title: t('draw-mode'),
        content: t('switch-to-draw-mode-to-create-new-paths-and-shapes'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-edit-edit-mode',
        element: '#ve-btn-edit-mode',
        title: t('edit-mode'),
        content: t('switch-to-edit-mode-to-select-move-and-modify-existing-paths'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      // History
      {
        id: 've-edit-undo',
        element: '#ve-btn-undo',
        title: t('undo'),
        content: t('undo-the-last-action'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-edit-redo',
        element: '#ve-btn-redo',
        title: t('redo'),
        content: t('redo-the-previously-undone-action'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      // Selection
      {
        id: 've-edit-select-all',
        element: '#ve-btn-select-all',
        title: t('select-all'),
        content: t('select-all-nodes-in-the-current-path'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-select-all'),
      },
      {
        id: 've-edit-invert-selection',
        element: '#ve-btn-invert-selection',
        title: t('invert-selection'),
        content: t('invert-the-current-node-selection'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-invert-selection'),
      },
      // Edit actions
      {
        id: 've-edit-copy',
        element: '#ve-btn-copy',
        title: t('copy'),
        content: t('copy-selected-paths-to-clipboard'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-copy'),
      },
      {
        id: 've-edit-cut',
        element: '#ve-btn-cut',
        title: t('cut'),
        content: t('cut-selected-paths-to-clipboard'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-cut'),
      },
      {
        id: 've-edit-paste',
        element: '#ve-btn-paste',
        title: t('paste'),
        content: t('paste-paths-from-clipboard'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-paste'),
      },
      {
        id: 've-edit-delete',
        element: '#ve-btn-delete',
        title: t('delete'),
        content: t('delete-selected-paths-or-nodes'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-delete'),
      },
      // Style controls
      {
        id: 've-edit-fill',
        element: '#ve-btn-fill',
        title: t('fill'),
        content: t('set-fill-color-or-gradient-for-the-selected-path'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-edit-stroke',
        element: '#ve-btn-stroke',
        title: t('stroke'),
        content: t('set-stroke-color-and-width-for-the-selected-path'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-edit-filters',
        element: '#ve-btn-filters',
        title: t('filters'),
        content: t('apply-blur-and-shadow-effects-to-the-selected-path'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-edit-adjustments',
        element: '#ve-btn-adjustments',
        title: t('adjustments'),
        content: t('adjust-opacity-blend-mode-and-color-settings'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      // Clip/Hole
      {
        id: 've-edit-clip-path',
        element: '#ve-btn-clip-path',
        title: t('clip-path'),
        content: t('use-path-as-a-clipping-mask'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-edit-hole-path',
        element: '#ve-btn-hole-path',
        title: t('hole-path'),
        content: t('use-path-as-a-hole-cutout'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      // Extend/Break
      {
        id: 've-edit-extend-path',
        element: '#ve-btn-extend-path',
        title: t('extend-path'),
        content: t('extend-the-path-from-a-selected-endpoint'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-extend-path'),
      },
      {
        id: 've-edit-break-path',
        element: '#ve-btn-break-path',
        title: t('break-path'),
        content: t('break-open-a-closed-path-at-the-selected-node'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-break-path'),
      },
      // Layer ordering
      {
        id: 've-edit-move-up',
        element: '#ve-btn-move-up',
        title: t('move-up'),
        content: t('move-the-selected-path-one-layer-up'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-move-up'),
      },
      {
        id: 've-edit-move-down',
        element: '#ve-btn-move-down',
        title: t('move-down'),
        content: t('move-the-selected-path-one-layer-down'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-move-down'),
      },
      {
        id: 've-edit-move-to-front',
        element: '#ve-btn-move-to-front',
        title: t('move-to-front'),
        content: t('move-the-selected-path-to-the-front'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-move-to-front'),
      },
      {
        id: 've-edit-move-to-back',
        element: '#ve-btn-move-to-back',
        title: t('move-to-back'),
        content: t('move-the-selected-path-to-the-back'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-move-to-back'),
        nextLabel: t('got-it'),
      },
    ],
  }
}

/**
 * Build the Draw mode toolbar tour flow.
 * Covers: mode toggle, curve types, draw actions, history, style controls, clip/hole
 */
export function buildDrawModeTourFlow(t: TFunction): GuidedTourFlow {
  return {
    id: USER_JOURNEY_TYPE.VECTOR_EDITOR_DRAW_MODE_TOUR,
    steps: [
      // Mode toggle
      {
        id: 've-draw-draw-mode',
        element: '#ve-btn-draw-mode',
        title: t('draw-mode'),
        content: t('you-are-in-draw-mode-click-on-the-canvas-to-place-points-and-create-paths'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-draw-edit-mode',
        element: '#ve-btn-edit-mode',
        title: t('edit-mode'),
        content: t('switch-to-edit-mode-to-select-and-modify-existing-paths'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      // Curve types
      {
        id: 've-draw-straight-lines',
        element: '#ve-btn-straight-lines',
        title: t('straight-lines'),
        content: t('draw-straight-line-segments-between-points'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-straight-lines'),
      },
      {
        id: 've-draw-quadratic-curves',
        element: '#ve-btn-quadratic-curves',
        title: t('quadratic-curves'),
        content: t('drag-to-create-smooth-quadratic-curves-with-one-control-point'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-quadratic-curves'),
      },
      {
        id: 've-draw-cubic-curves',
        element: '#ve-btn-cubic-curves',
        title: t('cubic-curves'),
        content: t('drag-to-create-smooth-cubic-curves-with-two-control-points'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-cubic-curves'),
      },
      // Draw actions
      {
        id: 've-draw-new-subpath',
        element: '#ve-btn-new-subpath',
        title: t('new-subpath'),
        content: t('start-a-new-separate-subpath-within-the-current-path'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-new-subpath'),
      },
      {
        id: 've-draw-finish-drawing',
        element: '#ve-btn-finish-drawing',
        title: t('finish-drawing'),
        content: t('complete-the-current-path-drawing'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-finish-drawing'),
      },
      {
        id: 've-draw-cancel-drawing',
        element: '#ve-btn-cancel-drawing',
        title: t('cancel-drawing'),
        content: t('discard-the-current-drawing-and-start-over'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        skipThisStepWhen: isButtonMissing('#ve-btn-cancel-drawing'),
      },
      // History
      {
        id: 've-draw-undo',
        element: '#ve-btn-undo',
        title: t('undo'),
        content: t('undo-the-last-action'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-draw-redo',
        element: '#ve-btn-redo',
        title: t('redo'),
        content: t('redo-the-previously-undone-action'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      // Style controls
      {
        id: 've-draw-fill',
        element: '#ve-btn-fill',
        title: t('fill'),
        content: t('set-fill-color-or-gradient-for-the-path'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-draw-stroke',
        element: '#ve-btn-stroke',
        title: t('stroke'),
        content: t('set-stroke-color-and-width-for-the-path'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-draw-filters',
        element: '#ve-btn-filters',
        title: t('filters'),
        content: t('apply-blur-and-shadow-effects'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-draw-adjustments',
        element: '#ve-btn-adjustments',
        title: t('adjustments'),
        content: t('adjust-opacity-blend-mode-and-color-settings'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      // Clip/Hole
      {
        id: 've-draw-clip-path',
        element: '#ve-btn-clip-path',
        title: t('clip-path'),
        content: t('use-path-as-a-clipping-mask'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
      },
      {
        id: 've-draw-hole-path',
        element: '#ve-btn-hole-path',
        title: t('hole-path'),
        content: t('use-path-as-a-hole-cutout'),
        placement: ECardPlacement.BOTTOM_CENTER,
        ...SHARED_STEP_CONFIG,
        nextLabel: t('got-it'),
      },
    ],
  }
}
