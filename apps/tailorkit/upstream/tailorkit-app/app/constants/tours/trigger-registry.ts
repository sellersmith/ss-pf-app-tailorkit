import type { GuidedTourFlow } from '~/components/TourGuide/types'
import type { TourFlowProps } from '.'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { ELayerType } from '~/types/psd'
import { TemplateEditorStore } from '~/stores/modules/template'
import renderEditorIntroTriggeredTour from './render-editor-intro-triggered-tour'
import renderSelectElementTriggeredTour from './render-select-element-triggered-tour'
import renderImageLayerGuideTriggeredTour from './render-image-layer-guide-triggered-tour'
import renderTextLayerGuideTriggeredTour from './render-text-layer-guide-triggered-tour'

/**
 * Trigger types for trigger-based tours.
 * Each type represents a user action that can activate a tour.
 */
export enum ETriggerType {
  /** Fires once when the editor component mounts */
  EDITOR_OPEN = 'editor-open',
  /** Fires when a layer of a specific type is clicked/selected */
  LAYER_CLICK = 'layer-click',
}

export interface TourTriggerConfig {
  /** Unique identifier — must match a USER_JOURNEY_TYPE value for persistence */
  id: USER_JOURNEY_TYPE
  /** The trigger type that activates this tour */
  triggerType: ETriggerType
  /** Additional metadata for trigger condition matching */
  triggerMeta?: {
    /** For LAYER_CLICK: which layer type(s) activate this trigger */
    layerTypes?: ELayerType[]
  }
  /**
   * Priority: lower number = higher priority.
   * When multiple triggers fire simultaneously, only the highest-priority one activates.
   */
  priority: number
  /** Optional condition checked at evaluation time. Return true to allow activation. */
  shouldActivate?: () => boolean
  /** Factory function that produces the tour flow */
  renderFlow: (props: TourFlowProps) => GuidedTourFlow
}

/**
 * Declarative registry of all trigger-based tours.
 * To add a new trigger tour:
 * 1. Add a USER_JOURNEY_TYPE enum value
 * 2. Add an entry here
 * 3. Create the renderXxxTour function
 */
export const TOUR_TRIGGER_REGISTRY: TourTriggerConfig[] = [
  {
    id: USER_JOURNEY_TYPE.EDITOR_INTRO_TRIGGERED,
    triggerType: ETriggerType.EDITOR_OPEN,
    priority: 10,
    shouldActivate: () => TemplateEditorStore.getState().extractedLayerStores.length === 0,
    renderFlow: renderEditorIntroTriggeredTour,
  },
  {
    id: USER_JOURNEY_TYPE.SELECT_ELEMENT_TRIGGERED,
    triggerType: ETriggerType.EDITOR_OPEN,
    priority: 10,
    shouldActivate: () => TemplateEditorStore.getState().extractedLayerStores.length > 0,
    renderFlow: renderSelectElementTriggeredTour,
  },
  {
    id: USER_JOURNEY_TYPE.IMAGE_LAYER_GUIDE_TRIGGERED,
    triggerType: ETriggerType.LAYER_CLICK,
    triggerMeta: { layerTypes: [ELayerType.IMAGE] },
    priority: 20,
    renderFlow: renderImageLayerGuideTriggeredTour,
  },
  {
    id: USER_JOURNEY_TYPE.TEXT_LAYER_GUIDE_TRIGGERED,
    triggerType: ETriggerType.LAYER_CLICK,
    triggerMeta: { layerTypes: [ELayerType.TEXT] },
    priority: 20,
    renderFlow: renderTextLayerGuideTriggeredTour,
  },
]
