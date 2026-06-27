import type { TFunction } from 'i18next'

import renderProviderTour from './render-provider-tour'

import renderIntegrationsIndexTour from './render-integrations-index'
import type { NavigateFunction } from '@remix-run/react'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import renderPersonalizerTour from './render-personalizer-tour'
import renderUnifiedEditorTour from './render-unified-editor-tour'
import type { UseDevices } from '~/utils/hooks/useDevice'

export const TOURS = {
  TEMPLATE_EDITOR_QUICK_TOUR: 'template-editor-quick-tour',
  TEMPLATE_EDITOR_QUICK_TOUR_3: 'template-editor-quick-tour-3',
  INTEGRATION_EDITOR_QUICK_TOUR: 'integration-editor-quick-tour',
  PROVIDER_TOUR: 'provider-tour',
  INTEGRATION_EDITOR_INTRO_TOUR: 'integration-editor-intro-tour',
  INTEGRATIONS_INDEX_TOUR: 'integrations-index-tour',
  UNIFIED_EDITOR_TOUR: 'unified-editor-tour',
}

export type TourFlowProps = {
  t: TFunction
  navigate: NavigateFunction
  startStepId?: string
  deviceData?: UseDevices
}

export const TOUR_FLOWS = {
  [TOURS.PROVIDER_TOUR]: (props: TourFlowProps) => renderProviderTour(props),
  [USER_JOURNEY_TYPE.FULFILLMENT_TUTORIAL]: (props: TourFlowProps) => ({
    ...renderProviderTour(props),
    id: USER_JOURNEY_TYPE.FULFILLMENT_TUTORIAL,
  }),
  [TOURS.INTEGRATIONS_INDEX_TOUR]: (props: TourFlowProps) => renderIntegrationsIndexTour(props),
  [TOURS.UNIFIED_EDITOR_TOUR]: (props: TourFlowProps) => renderUnifiedEditorTour(props, props.t, props.deviceData),
  [USER_JOURNEY_TYPE.PERSONALIZE_PRODUCT_QUICK_TOUR]: (props: TourFlowProps) => ({
    ...renderPersonalizerTour(props),
    id: USER_JOURNEY_TYPE.PERSONALIZE_PRODUCT_QUICK_TOUR,
  }),
}
