/**
 * Feature registry for adoption tracking & revenue attribution.
 * Each feature delivered by an AI Founder should be registered here.
 * Used by useFeatureTracking (client), trackFeatureEvent (server), and order webhook attribution.
 *
 * To add revenue attribution for a new feature:
 *   1. Set revenueAttributable: true
 *   2. Add detectOnOrder callback that checks template/layer data
 *   That's it — the webhook picks it up automatically.
 */

/** Template data shape available at order time (populated via getDetailIntegration) */
export interface OrderTemplateContext {
  metadata?: { useAiFeature?: boolean; [key: string]: unknown }
  wizardConfig?: { enabled?: boolean; steps?: unknown[] } | null
  layers?: Array<{ type?: string; shapeSettings?: { movementBounds?: Record<string, number>; [key: string]: unknown } }>
}

/** Enriched order structure from adjustLineItemToGetPrintAreaInfo (populateTemplate: true) */
export interface EnrichedOrder {
  line_items?: Array<{
    integration?: {
      variants?: Array<{
        mockup?: {
          layers?: Array<{
            data?: {
              templateId?: OrderTemplateContext
            }
          }>
        }
      }>
    }
  }>
}

export interface FeatureRegistryEntry {
  /** Unique feature identifier (snake_case) */
  featureName: string
  /** Human-readable name */
  displayName: string
  /** How this feature increases Orders Per Store (OPS) */
  opsHypothesis: string
  /** Feature category */
  category: 'template_editing' | 'ai' | 'storefront' | 'fulfillment' | 'billing' | 'onboarding' | 'other'
  /** Whether this feature can be detected on a product at order time for revenue attribution */
  revenueAttributable: boolean
  /** Returns true if feature is active on the given template. Only needed when revenueAttributable is true. */
  detectOnOrder?: (template: OrderTemplateContext) => boolean
}

export const FEATURE_REGISTRY: Record<string, FeatureRegistryEntry> = {
  template_editor: {
    featureName: 'template_editor',
    displayName: 'Template Editor',
    opsHypothesis: 'More templates created → more products published → more storefront orders',
    category: 'template_editing',
    revenueAttributable: false,
  },
  ai_assistant: {
    featureName: 'ai_assistant',
    displayName: 'AI Assistant',
    opsHypothesis: 'AI lowers template creation barrier → faster product publishing → more orders',
    category: 'ai',
    revenueAttributable: true,
    detectOnOrder: t => t.metadata?.useAiFeature === true,
  },
  mockup_wizard: {
    featureName: 'mockup_wizard',
    displayName: 'Mockup Wizard',
    opsHypothesis: 'Professional mockups increase storefront conversion → more orders',
    category: 'ai',
    revenueAttributable: false,
  },
  checkbox_conditions: {
    featureName: 'checkbox_conditions',
    displayName: 'Checkbox Conditions',
    opsHypothesis: 'Checkbox conditions increase buyer engagement → higher cart completion',
    category: 'storefront',
    revenueAttributable: false,
  },
  fulfillment_printify: {
    featureName: 'fulfillment_printify',
    displayName: 'Fulfillment (Printify)',
    opsHypothesis: 'Automated fulfillment enables order completion → direct OPS contribution',
    category: 'fulfillment',
    revenueAttributable: false,
  },
  elements_panel: {
    featureName: 'elements_panel',
    displayName: 'Elements Panel',
    opsHypothesis: 'Quick element presets lower template creation barrier → faster product publishing → more orders',
    category: 'template_editing',
    revenueAttributable: false,
  },
  onboarding_progress_bar: {
    featureName: 'onboarding_progress_bar',
    displayName: 'Onboarding Progress Bar',
    opsHypothesis: 'Progress visualization motivates template completion → more published products → more orders',
    category: 'onboarding',
    revenueAttributable: false,
  },
  post_publish_checklist: {
    featureName: 'post_publish_checklist',
    displayName: 'Post-Publish Checklist',
    opsHypothesis: 'Guides merchants to optimize published products → increases product quality → more orders',
    category: 'onboarding',
    revenueAttributable: false,
  },
  charm_builder: {
    featureName: 'charm_builder',
    displayName: 'Charm Builder',
    opsHypothesis: 'Charm upsell products increase average order value → more revenue per storefront order',
    category: 'template_editing',
    revenueAttributable: true,
    detectOnOrder: t => t.layers?.some(l => l.type === 'charm-node') === true,
  },
  wizard_mode: {
    featureName: 'wizard_mode',
    displayName: 'Step-by-Step Wizard',
    opsHypothesis: 'Guided wizard reduces buyer overwhelm → higher customization completion → more orders',
    category: 'storefront',
    revenueAttributable: true,
    detectOnOrder: t => t.wizardConfig?.enabled === true,
  },
  buyer_text_movement_zone: {
    featureName: 'buyer_text_movement_zone',
    displayName: 'Buyer Text Movement Zone',
    opsHypothesis:
      'Constrained buyer text placement produces more polished products → higher confidence → more conversions',
    category: 'storefront',
    revenueAttributable: true,
    detectOnOrder: t => t.layers?.some(l => !!l.shapeSettings?.movementBounds) === true,
  },
  community_provision: {
    featureName: 'community_provision',
    displayName: 'Community Provision',
    opsHypothesis: 'One-click community account creation reduces friction → higher community engagement',
    category: 'other',
    revenueAttributable: false,
  },
  simplified_product_publish_onboarding: {
    featureName: 'simplified_product_publish_onboarding',
    displayName: 'Simplified Product Publish Onboarding',
    opsHypothesis: 'Guided 5-step wizard reduces onboarding friction → higher first-product-publish rate → more orders',
    category: 'onboarding',
    revenueAttributable: false,
  },
  onboarding_intent_router: {
    featureName: 'onboarding_intent_router',
    displayName: 'Install Intent Router',
    opsHypothesis:
      'Capturing install-time intent routes merchants into the flow that matches their use case '
      + '→ faster first publish → higher subscribe rate',
    category: 'onboarding',
    revenueAttributable: false,
  },
  setup_guide_card: {
    featureName: 'setup_guide_card',
    displayName: 'Dashboard Setup Guide Card',
    opsHypothesis:
      'Compact action card on the dashboard nudges merchants toward their next create flow '
      + '→ higher first-publish rate for new merchants, repeat-create rate for returning ones',
    category: 'onboarding',
    revenueAttributable: false,
  },
  pricing_subscriber_mode: {
    featureName: 'pricing_subscriber_mode',
    displayName: 'Pricing → Billing reframe for subscribers',
    opsHypothesis:
      'Subscribed merchants see a Billing/account-management view (manage popover, next-charge line, '
      + 'focused upgrade-delta CTA) instead of a marketing-mode pricing comparison '
      + '→ fewer support tickets about invoices/cancellation, higher Starter→Growth upgrade rate',
    category: 'billing',
    revenueAttributable: true,
  },
  publish_mode_toggle: {
    featureName: 'publish_mode_toggle',
    displayName: 'Publish Mode Toggle (Clone vs Direct)',
    opsHypothesis:
      'Direct integration onto existing products avoids duplicate-listing churn '
      + '→ more first-publishes for SEO-conscious merchants → more orders',
    category: 'onboarding',
    revenueAttributable: false,
  },
  replace_featured_media_on_publish: {
    featureName: 'replace_featured_media_on_publish',
    displayName: 'Replace Featured Media With Mockup (Step 5 Toggle)',
    opsHypothesis:
      'Storefront browsers see the personalization mockup as the primary product image '
      + '→ higher personalization-intent discovery → more add-to-carts → more orders',
    category: 'onboarding',
    revenueAttributable: false,
  },
  toast_publish_action: {
    featureName: 'toast_publish_action',
    displayName: 'Toast Publish Action',
    opsHypothesis:
      'Inline publish shortcut in saved toast reduces clicks to publish → faster product go-live → more orders',
    category: 'other',
    revenueAttributable: false,
  },
  first_month_deal: {
    featureName: 'first_month_deal',
    displayName: 'First Month $1 Deal',
    opsHypothesis: '$1 first month lowers subscription barrier → more paid conversions → more orders',
    category: 'billing',
    revenueAttributable: false,
  },
  cross_product_personalizer: {
    featureName: 'cross_product_personalizer',
    displayName: 'Cross-Product Personalizer',
    opsHypothesis:
      'In-page addon personalization removes friction → higher addon attachment rate → more revenue per order',
    category: 'storefront',
    revenueAttributable: false,
  },
  conditional_logic_flow: {
    featureName: 'conditional_logic_flow',
    displayName: 'Conditional Logic Flow Builder',
    opsHypothesis:
      'Visual conditional logic reduces setup errors → more merchants use conditions → richer storefronts → more orders',
    category: 'template_editing',
    revenueAttributable: false,
  },
  clipart_creation: {
    featureName: 'clipart_creation',
    displayName: 'Clipart Creation',
    opsHypothesis: 'Reusable clipart library speeds template creation → more templates published → more orders',
    category: 'template_editing',
    revenueAttributable: false,
  },
  custom_emoji_font: {
    featureName: 'custom_emoji_font',
    displayName: 'Custom Emoji Font',
    opsHypothesis: 'Custom emoji fonts enable unique personalization → higher buyer engagement → more orders',
    category: 'template_editing',
    revenueAttributable: false,
  },
  imageless_option_set: {
    featureName: 'imageless_option_set',
    displayName: 'Imageless Option Set',
    opsHypothesis:
      'Hidden logic layers (sizes, gift cards) expand product options → more customizable products → more orders',
    category: 'template_editing',
    revenueAttributable: false,
  },
  pricing_roi_calculator: {
    featureName: 'pricing_roi_calculator',
    displayName: 'Pricing ROI Calculator',
    opsHypothesis:
      'Showing profit potential motivates plan upgrades → higher subscription tier → more features used → more orders',
    category: 'billing',
    revenueAttributable: false,
  },
  pricing_social_proof: {
    featureName: 'pricing_social_proof',
    displayName: 'Pricing Social Proof',
    opsHypothesis: 'Merchant testimonials build trust at decision point → higher plan conversion → more orders',
    category: 'billing',
    revenueAttributable: false,
  },
  pricing_feature_comparison: {
    featureName: 'pricing_feature_comparison',
    displayName: 'Pricing Feature Comparison Table',
    opsHypothesis: 'Grouped feature comparison clarifies plan value → informed upgrade decisions → more orders',
    category: 'billing',
    revenueAttributable: false,
  },
  app_proxy_fallback: {
    featureName: 'app_proxy_fallback',
    displayName: 'App Proxy Fallback Panel',
    opsHypothesis: 'Fallback panel ensures personalization works without app block → fewer lost buyers → more orders',
    category: 'storefront',
    revenueAttributable: false,
  },
  elva_ai: {
    featureName: 'elva_ai',
    displayName: 'Elva AI Assistant',
    opsHypothesis: 'Agentic AI assistant accelerates template setup → faster product publishing → more orders',
    category: 'ai',
    revenueAttributable: false,
  },
  cart_discount_display: {
    featureName: 'cart_discount_display',
    displayName: 'Cart Discount Strikethrough',
    opsHypothesis:
      'Visible discount on hidden personalization items increases perceived value → higher cart completion',
    category: 'storefront',
    revenueAttributable: false,
  },
  dynamic_trial_days: {
    featureName: 'dynamic_trial_days',
    displayName: 'Dynamic Trial Days',
    opsHypothesis: 'Install-date-based trial length increases urgency for older installs → higher plan conversion',
    category: 'billing',
    revenueAttributable: false,
  },
  colour_guide: {
    featureName: 'colour_guide',
    displayName: 'Colour Guide',
    opsHypothesis:
      'Real-world colour preview (foil/emboss) reduces purchase uncertainty → higher checkout conversion → more orders',
    category: 'storefront',
    revenueAttributable: false,
  },
}

/**
 * Detects active features across all line items of an enriched order.
 * Walks: order → line_items → integration → variants → mockup → layers → template
 * Runs each registry detectOnOrder callback against each template found.
 */
export function detectActiveFeatures(order: EnrichedOrder | null | undefined): string[] {
  const features = new Set<string>()
  const detectors = Object.values(FEATURE_REGISTRY).filter(
    (f): f is FeatureRegistryEntry & { detectOnOrder: NonNullable<FeatureRegistryEntry['detectOnOrder']> } =>
      f.revenueAttributable && !!f.detectOnOrder
  )

  for (const lineItem of order?.line_items || []) {
    for (const variant of lineItem?.integration?.variants || []) {
      for (const layer of variant?.mockup?.layers || []) {
        const template = layer?.data?.templateId
        if (!template) continue

        for (const detector of detectors) {
          if (detector.detectOnOrder(template)) {
            features.add(detector.featureName)
          }
        }
      }
    }
  }

  return Array.from(features)
}

/**
 * Builds Mixpanel event properties for revenue attribution.
 * Returns active_features array, feature_count, and individual has_* boolean flags.
 */
export function buildFeatureAttributionProps(order: EnrichedOrder | null | undefined): Record<string, unknown> {
  const activeFeatures = detectActiveFeatures(order)

  // Auto-generate has_* flags from registry — no manual updates needed for new features
  const flags: Record<string, number> = {}
  for (const entry of Object.values(FEATURE_REGISTRY)) {
    if (entry.revenueAttributable) {
      flags[`has_${entry.featureName}`] = activeFeatures.includes(entry.featureName) ? 1 : 0
    }
  }

  return {
    active_features: activeFeatures,
    feature_count: activeFeatures.length,
    has_ai_product: activeFeatures.includes('ai_assistant') ? 1 : 0, // backward compat with existing Mixpanel reports
    ...flags,
  }
}
