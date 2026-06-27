import type { SubscriptionDocument } from './Subscription'

/** Three flow choices the merchant can pick from the install intent page or
 *  the create-flow dropdown. Quick Setup = simplified onboarding wizard.
 *  Full Editor = legacy control path (CategorySelection → Product → unified editor).
 *  Charm Builder = ProductSelectionModal → unified editor with charmMode + pre-created CHARM_NODE. */
export type CreateFlow = 'quick_setup' | 'full_editor' | 'charm_builder'

export interface ShopDocument {
  _id: string
  shopDomain: string
  shopConfig: {
    [key: string]: any
  }
  appConfig: {
    [key: string]: any
    occurredEvents?: Record<string, boolean>
    mcp?: {
      accessToken: string
      // If this property is null, there is no limit for the mcp access token
      expiresAt?: Date
      createdAt: Date
    }
    appMetafields?: {
      aiPersonalizerProduct?: boolean
      // Global default Colour Guide image URL — used as fallback when a
      // colour option set has no per-template `colourGuideImageUrl` set.
      // Configured via Storefront Setup → Colour Guide card.
      colourGuide?: {
        defaultImageUrl?: string
        // Intro/description text shown above the swatch list in the modal.
        // Used as fallback when a colour option set has no per-template
        // `colourGuideDescription`.
        defaultDescription?: string
      }
      // Shop-wide master Allowed-Emojis set. Configured via Storefront Setup →
      // Emoji Picker card. The merchant edits this set, saves it to appMetafields,
      // then clicks "Apply to all templates" which POSTs to
      // /api/emoji-picker/apply-to-all and runs `Layer.updateMany` over every text
      // layer in the shop that already has `settings.emojiPicker.enabled = true`,
      // replacing each layer's `emojis` + `font`. No live link to the storefront —
      // bulk operation only. Per-template tweaks remain in the template editor.
      allowedEmojis?: {
        // Grapheme string of enabled emoji glyphs (same shape as
        // layer.settings.emojiPicker.emojis).
        emojis?: string
        // Optional reference to a font from the existing font library.
        // When set, storefront loads this font for emoji rendering.
        font?: {
          family: string
          src: string
        }
      }
    }
    /** Last averagePrice the merchant saved in the Upsell pricing modal.
     *  Preloaded into the modal on mount so it doesn't reset to a currency-based default. */
    optionPricing?: {
      averagePrice?: number
    }
    communityAccount?: {
      linked: boolean
      email: string
      linkedAt: Date | string
    }
    /** Install intent page state.
     *  - shownAt: timestamp the page was first rendered (or shop.createdAt for backfilled shops).
     *  - selected: gate field. null = page should re-show (never picked, or bouncer
     *    who closed the page). CreateFlow value = merchant committed to a flow.
     *    'skipped' = backfilled bypass for existing shops at deploy time. */
    onboardingIntent?: {
      shownAt: Date | string
      selected: CreateFlow | 'skipped' | null
      timeToSelectSeconds: number | null
      demoClickedFirst: boolean
    }
    /** Last flow the merchant picked from the create dropdown. Used as the
     *  default for the dropdown's main-button click. null = new merchant;
     *  defaults to 'quick_setup' in UI. */
    lastCreateFlow?: CreateFlow | null
  }
  uninstalledAt?: Date | string | undefined
  lastReinstalledAt?: Date | string // Last reinstall timestamp (for reinstall detection)
  subscription?: string | SubscriptionDocument
  // Active-days trial tracking (V2+)
  trialStartedAt?: Date | string // Timestamp when trial began (first install)
  trialPausedDuration?: number // Total milliseconds paused (accumulate on reinstall)
  trialCompletedAt?: Date | string // Timestamp when trial completed
  trialDebt?: {
    orderOverage: number // Overage order charges accumulated during trial
    aiCreditOverage: number // AI credit overage charges accumulated during trial
    lastCalculatedAt: Date | string // Last calculation timestamp
    chargedOrders: number // Orders already charged (prevent double-charge on reinstall)
  }
  usages?: {
    [key: string]: any
    assetsMutationPerDay?: number
    assets?: number
    orders?: number
    usageFee?: number
    templates?: number
    integrations?: number
    appGeneratedRevenue?: number
    achievedFirstSale?: boolean
    discountedUsageFee?: number
    usedAIAssistant?: boolean
    usedGenerativeAI?: boolean
    totalPublishedIntegrations?: number
    aiCredit?: {
      monthlyUsage: number // Credits used (reset behavior depends on plan type)
      purchasedCredits: number // Credits purchased (NEVER resets, carries over)
      startMonth: Date // Start of current period (billing cycle for order-based, calendar month for revenue-based)
      sentThresholds?: number[] // Thresholds (50, 80, 100) that have triggered email notifications this cycle
    }
    // Campaign stats moved to ShopCampaignStats collection for scalability
    /**
     * Feature usage tracking (Analytics for Version 2 pricing)
     * Used to measure feature adoption and identify underutilized features
     */
    featureUsage?: {
      svgExportCount: number
      autoFulfillmentCount: number
      highResPngExportCount: number
      priorityRequestsCount: number
      bulkAssignCount: number
      lastFeatureUsedAt: Date | string
      firstFeatureUsedAt: Date | string
    }
  }
  metadata?: {
    shopDescription?: string
    shopCategories?: string[]
    personalizationCompatibilityScore?: number // 0.0 - 1.0 scale indicating how suitable the shop is for personalization services
  }
  createdAt: Date | string
  updatedAt: Date | string
  lastAccess: Date | string
}
