import type { GuidedTourFlow } from '~/components/TourGuide/types'
import { TOURS } from '~/constants/tours'
import type { UserJourneyDocument } from '~/models/UserJourney'
import TemplateEditorQuickTour from './TemplateEditorQuickTour'
import IntegrationEditorQuickTour from './IntegrationEditorQuickTour'
import ProviderTour from './ProviderTour'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'

export interface ITourGuideComponentProps {
  flow: GuidedTourFlow
  tourJourney: UserJourneyDocument | undefined | null
}

export const tourGuideComponents = {
  [TOURS.TEMPLATE_EDITOR_QUICK_TOUR]: TemplateEditorQuickTour,
  [TOURS.TEMPLATE_EDITOR_QUICK_TOUR_3]: TemplateEditorQuickTour,
  [USER_JOURNEY_TYPE.CREATE_TEMPLATE_TUTORIAL]: TemplateEditorQuickTour,
  [TOURS.INTEGRATION_EDITOR_QUICK_TOUR]: IntegrationEditorQuickTour,
  [USER_JOURNEY_TYPE.INTEGRATION_TUTORIAL]: IntegrationEditorQuickTour,
  [TOURS.PROVIDER_TOUR]: ProviderTour,
  [USER_JOURNEY_TYPE.FULFILLMENT_TUTORIAL]: ProviderTour,
  [TOURS.INTEGRATION_EDITOR_INTRO_TOUR]: IntegrationEditorQuickTour,
  [TOURS.INTEGRATIONS_INDEX_TOUR]: IntegrationEditorQuickTour,
  [TOURS.UNIFIED_EDITOR_TOUR]: IntegrationEditorQuickTour,
}
