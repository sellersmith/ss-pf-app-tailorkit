export const USER_JOURNEY_ACTIONS = {
  SAVE_ONBOARDING_PROGRESS_STATE: 'save_onboarding_progress_state',
  START_INTEGRATION_TOUR: 'start_integration_tour',
  START_TEMPLATE_TOUR: 'start_template_tour',
  CHECK_AND_UPDATE_USER_MILESTONE: 'check_and_update_user_milestone',

  // TODO: Temporary to test, remove this when release please.
  CLEAR_ONBOARDING_DATA: 'clear_onboarding_data',
}

/**
 * User journey types
 * @important The journey must not include tutorial word, because we will not save the progress of the tutorial tour
 */
export enum USER_JOURNEY_TYPE {
  ONBOARDING = 'onboarding',
  TEMPLATE_EDITOR_QUICK_TOUR = 'template-editor-quick-tour',
  INTEGRATION_EDITOR_QUICK_TOUR = 'integration-editor-quick-tour',
  PERSONALIZE_PRODUCT_QUICK_TOUR = 'personalize-product-quick-tour',
  PROVIDER_TOUR = 'provider-tour',
  FULFILLMENT_TUTORIAL = 'fulfillment-tutorial',
  CREATE_TEMPLATE_TUTORIAL = 'create-template-tutorial',
  INTEGRATION_TUTORIAL = 'integration-tutorial',
  ACHIEVE_FIRST_SALE = 'achieve-first-sale',
  INTEGRATION_EDITOR_INTRO_TOUR = 'integration-editor-intro-tour',
  INTEGRATIONS_INDEX_TOUR = 'integrations-index-tour',
  CHECKBOX_ONBOARDING = 'checkbox-onboarding',

  // Trigger-based tours
  EDITOR_INTRO_TRIGGERED = 'editor-intro-triggered',
  SELECT_ELEMENT_TRIGGERED = 'select-element-triggered',
  IMAGE_LAYER_GUIDE_TRIGGERED = 'image-layer-guide-triggered',
  TEXT_LAYER_GUIDE_TRIGGERED = 'text-layer-guide-triggered',

  // MockupWizard tours
  MOCKUP_WIZARD_TOOLBAR_TOUR = 'mockup-wizard-toolbar-tour',
  MOCKUP_WIZARD_VECTOR_TOUR = 'mockup-wizard-vector-tour',

  // VectorEditor tours
  VECTOR_EDITOR_EDIT_MODE_TOUR = 'vector-editor-edit-mode-tour',
  VECTOR_EDITOR_DRAW_MODE_TOUR = 'vector-editor-draw-mode-tour',
}

/**
 * User journey steps
 */
export const USER_JOURNEY_STEPS = {
  ACHIEVE_FIRST_SALE: {
    CREATE_TEMPLATE: 'create_template',
    PREPARE_PRODUCTS: 'prepare_products',
    INTEGRATE_WITH_PRODUCTS: 'integrate_with_products',
    PUBLISH_ON_ONLINE_STORE: 'publish_on_online_store',
    ACHIEVE_FIRST_SALE: 'achieve_first_sale',
    ACHIEVE_200_DOLLAR: 'achieve_200_dollar',
  },
}

/**
 * New user journey steps for new onboarding flow
 */
export const NEW_USER_JOURNEY_STEPS = {
  APPROVE_CHARGE: 'approve_charge',
  FIRST_PRODUCT_SETUP_MODAL: 'first_product_setup_modal',
}

export const DEFAULT_API_TOKEN = process.env.PRINTIFY_DEFAULT_API_TOKEN || ''
export const DEFAULT_SHOP_ID = '18579559'
