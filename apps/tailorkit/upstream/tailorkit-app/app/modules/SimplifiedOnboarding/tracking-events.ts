/**
 * Analytics event names for the Simplified Product Publish Onboarding wizard.
 * All events follow the SIMPLIFIED_ONBOARDING_ prefix convention.
 */

export const SIMPLIFIED_ONBOARDING_EVENTS = {
  STARTED: 'simplified_onboarding_started',
  STEP_VIEWED: 'simplified_onboarding_step_viewed',
  STEP_COMPLETED: 'simplified_onboarding_step_completed',
  STEP_BACK: 'simplified_onboarding_step_back',
  PRODUCT_SELECTED: 'simplified_onboarding_product_selected',
  IMAGE_SELECTED: 'simplified_onboarding_image_selected',
  MOCKUP_APPLIED: 'simplified_onboarding_mockup_applied',
  TEMPLATE_SELECTED: 'simplified_onboarding_template_selected',
  TEMPLATE_GENERATED: 'simplified_onboarding_template_generated',
  APP_BLOCK_STATUS: 'simplified_onboarding_app_block_status',
  COMPLETED: 'simplified_onboarding_completed',
  ABANDONED: 'simplified_onboarding_abandoned',
  /** Step 5: "See It Works" button clicked — clone + publish started */
  PUBLISH_STARTED: 'simplified_onboarding_publish_started',
  /** Step 5: product cloned, integration published, storefront opened */
  PUBLISH_COMPLETED: 'simplified_onboarding_publish_completed',
  /** Step 5: publish failed (API error, clone failed, etc.) */
  PUBLISH_FAILED: 'simplified_onboarding_publish_failed',
  /** Bulk mode: user switches between product tabs */
  BULK_TAB_SWITCH: 'simplified_onboarding_bulk_tab_switch',
  /** Post-publish: user clicks fallback "View On Storefront" button (popup blocker case) */
  STOREFRONT_OPENED: 'simplified_onboarding_storefront_opened',
  /** Step 5: merchant toggled the Publish Mode (clone vs integrate-direct) */
  PUBLISH_MODE_CHANGED: 'simplified_onboarding_publish_mode_changed',
  /** Step 5: merchant toggled the "Replace featured product image" checkbox */
  REPLACE_FEATURED_MEDIA_TOGGLED: 'simplified_onboarding_replace_featured_media_toggled',
  /** Server-side or client-side failure replacing the featured media during publish */
  PUBLISH_FEATURED_MEDIA_REPLACE_FAILED: 'simplified_onboarding_publish_featured_media_replace_failed',
} as const
