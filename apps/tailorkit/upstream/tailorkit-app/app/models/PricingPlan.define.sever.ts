import { isWIPAndRCEnv } from '~/app-configs.server'
import type { PricingPlanInput } from './PricingPlan'

// Test environment configuration for WIP/RC environments
const TEST_ENV_CONFIG = {
  TRIAL_DAYS: 1,
  CAPPED_AMOUNT: 5,
  STARTER: {
    FREE_ORDERS: 3,
    AI_CREDITS: 50,
  },
  GROWTH: {
    FREE_ORDERS: 7,
    AI_CREDITS: 100,
  },
  ENTERPRISE: {
    FREE_ORDERS: 10,
    AI_CREDITS: 200,
  },
  TRIAL: {
    AI_CREDITS: 50,
  },
} as const

// Define default pricing plans
const pricingPlans: PricingPlanInput[] = [
  // Below is the new tiered revenue-based pricing plan for paid stores.
  // V1 (Revenue-Based) - Keep ACTIVE for backward compatibility
  {
    expiredAt: null,
    status: 'active',
    periodical: 'monthly',
    name: 'Pay as You Grow',
    alias: 'pay_as_you_grow_2',
    pricingVersion: 1,
    description: [
      'New (≤ $50/mo): Free',
      'Early Growth ($50 - $2,000/mo): $14.99',
      'Mid-Tier Scaling ($2,000 - $5,000/mo): $34.99',
      'Growth-Stage Sellers ($5,000 - $15,000/mo): $74.99',
      'High-Volume Merchants (> $15,000/mo): $74.99 + 0.9% of revenue over $15,000',
    ].join('<br>'),
    price: 0,
    trialDays: 0,
    /**
     * cappedAmount = $74.99 (base) + $1,000 (max revenue share) = $1,074.99
     * REQUIRED by Shopify. Protects merchant from unlimited charges.
     * Example: Revenue $200k → would be $1,739.99 but capped at $1,074.99
     */
    cappedAmount: 1074.99,
    chargeApprovalRequired: true,
    features: null,
    usages: {
      revenue: [
        {
          label: 'New',
          from: 0,
          to: 50,
          totalFee: 0,
          freeOrders: 1,
        },
        {
          label: 'Early Growth',
          from: 50.01,
          to: 2000,
          totalFee: 14.99,
          additionalFee: 14.99,
        },
        {
          label: 'Mid-Tier Scaling',
          from: 2000.01,
          to: 5000,
          totalFee: 34.99,
          additionalFee: 20,
        },
        {
          label: 'Growth-Stage Sellers',
          from: 5000.01,
          to: 15000,
          totalFee: 74.99,
          additionalFee: 40,
        },
        {
          label: 'High-Volume Merchants',
          from: 15000.01,
          to: Infinity,
          totalFee: 74.99,
          additionalFee: 0,
          revenueShare: '0.9%',
          /** Tier cap: limits revenue share portion only. Total cap is $1,074.99 (plan level) */
          cappedAmount: 1000,
        },
      ],
    },
  },
  // Below is the old tiered revenue-based pricing plan for paid stores.
  // V1 (Old Version) - Keep ACTIVE for existing subscriptions
  {
    expiredAt: null,
    status: 'inactive',
    periodical: 'monthly',
    name: 'Pay as You Grow',
    alias: 'pay_as_you_grow',
    description: [
      'New (≤ $100/mo): Free',
      'Early Growth ($100 - $2,000/mo): $14.99',
      'Mid-Tier Scaling ($2,000 - $5,000/mo): $34.99',
      'Growth-Stage Sellers ($5,000 - $15,000/mo): $74.99',
      'High-Volume Merchants (> $15,000/mo): $74.99 + 0.9% of revenue over $15,000',
    ].join('<br>'),
    price: 0,
    trialDays: 0,
    /** Same calculation as pay_as_you_grow_2: $74.99 + $1,000 = $1,074.99 */
    cappedAmount: 1074.99,
    chargeApprovalRequired: true,
    features: null,
    usages: {
      revenue: [
        {
          label: 'New',
          from: 0,
          to: 100,
          totalFee: 0,
          freeOrders: 1,
        },
        {
          label: 'Early Growth',
          from: 100.01,
          to: 2000,
          totalFee: 14.99,
          additionalFee: 14.99,
        },
        {
          label: 'Mid-Tier Scaling',
          from: 2000.01,
          to: 5000,
          totalFee: 34.99,
          additionalFee: 20,
        },
        {
          label: 'Growth-Stage Sellers',
          from: 5000.01,
          to: 15000,
          totalFee: 74.99,
          additionalFee: 40,
        },
        {
          label: 'High-Volume Merchants',
          from: 15000.01,
          to: Infinity,
          totalFee: 74.99,
          additionalFee: 0,
          revenueShare: '0.9%',
          cappedAmount: 1000,
        },
      ],
    },
  },
  // Valid until 30th April 2025: Below is the free pricing plan defined for development stores.
  {
    status: 'inactive',
    periodical: 'monthly',
    name: 'Development stores',
    alias: 'development_stores',
    expiredAt: '2025-04-30T23:59:59.999Z',
    description: [
      'New (≤ $100/mo): Free',
      'Early Growth ($100 - $2,000/mo): $14.99',
      'Mid-Tier Scaling ($2,000 - $5,000/mo): $34.99',
      'Growth-Stage Sellers ($5,000 - $15,000/mo): $74.99',
      'High-Volume Merchants (> $15,000/mo): $74.99 + 0.9% of revenue over $15,000',
    ].join('<br>'),
    price: 0,
    test: true,
    /** Set trial days to 1 day for development rc environment for testing UI */
    trialDays: isWIPAndRCEnv() ? 1 : 0,
    cappedAmount: 1600,
    chargeApprovalRequired: true,
    features: null,
    usages: {
      revenue: [
        {
          label: 'New',
          from: 0,
          to: 100,
          totalFee: 0,
        },
        {
          label: 'Early Growth',
          from: 100.01,
          to: 2000,
          totalFee: 14.99,
          additionalFee: 14.99,
        },
        {
          label: 'Mid-Tier Scaling',
          from: 2000.01,
          to: 5000,
          totalFee: 34.99,
          additionalFee: 20,
        },
        {
          label: 'Growth-Stage Sellers',
          from: 5000.01,
          to: 15000,
          totalFee: 74.99,
          additionalFee: 40,
        },
        {
          label: 'High-Volume Merchants',
          from: 15000.01,
          to: Infinity,
          totalFee: 74.99,
          additionalFee: 0,
          revenueShare: '0.9%',
        },
      ],
    },
  },
  /**
   * ORDER-BASED PLANS (V2) - Order counting instead of revenue
   *
   * cappedAmount: Shopify-required max charge per 30-day billing cycle for usage-based billing.
   * Protects merchants from unlimited charges while creating natural upgrade incentives.
   *
   * Implementation: Order charges use usage-based billing (affected by cap).
   * AI credit purchases use one-time charges (separate, no cap limit).
   *
   * Formula: base + $1,000 overage cap (following revenue model structure)
   * Caps: Starter $1,019 | Growth $1,049 | Enterprise $1,149
   *
   * ⚠️ NOTE: Enterprise cap insufficient for target range (20k orders).
   * Capacity: Starter 2,050 | Growth 5,350 | Enterprise 11,000 orders
   */
  {
    expiredAt: null,
    status: 'active',
    periodical: 'monthly',
    name: 'Starter',
    alias: 'starter_v2',
    description: 'First 50 orders/mo free. Then $0.50/order.',
    price: 19,
    trialDays: isWIPAndRCEnv() ? TEST_ENV_CONFIG.TRIAL_DAYS : 14,
    /**
     * cappedAmount: $1,019 ($19 base + $1,000 overage, following revenue model)
     * - Max capacity: 2,050 orders/month
     * - Target range: 50-800 orders
     * - At 800 orders: $394 charge (39% of cap) → comfortable headroom
     * - Natural break-even vs Growth: 110 orders
     * Rationale: Protection-focused cap with generous headroom.
     * Test environment: $5 cap for easier testing
     */
    cappedAmount: isWIPAndRCEnv() ? TEST_ENV_CONFIG.CAPPED_AMOUNT : 1019,
    chargeApprovalRequired: true,
    highlighted: false,
    pricingVersion: 2, // Metadata only - do not use for business logic
    aiCreditsPerMonth: isWIPAndRCEnv() ? TEST_ENV_CONFIG.STARTER.AI_CREDITS : 100,
    features: {
      highResPngExport: true,
      fulfillment3rdPartyApi: true,
      upsellCheckbox: true,
      upsellProductLimit: 1,
      losslessSvgExport: false,
      autoFulfillment: false,
      bulkAssignedProducts: false,
      priorityFeatureRequests: false,
      dedicatedSuccessManager: false,
      charmBuilder: false,
    },
    // Primary structure for business logic
    usages: {
      orders: [
        // First 50 orders included (3 for test env)
        { from: 1, to: isWIPAndRCEnv() ? TEST_ENV_CONFIG.STARTER.FREE_ORDERS : 50, transactionFee: 0 },
        // Overage: $0.50 per order
        { from: isWIPAndRCEnv() ? TEST_ENV_CONFIG.STARTER.FREE_ORDERS + 1 : 51, to: Infinity, transactionFee: 0.5 },
      ],
      revenue: [], // Not revenue-based
    },
  },
  {
    expiredAt: null,
    status: 'active',
    periodical: 'monthly',
    name: 'Growth',
    alias: 'growth_v2',
    description: 'First 500 orders/mo free. Then $0.10/order.',
    price: 49,
    trialDays: isWIPAndRCEnv() ? TEST_ENV_CONFIG.TRIAL_DAYS : 14,
    /**
     * cappedAmount: $1,049 ($49 base + $1,000 overage, following revenue model)
     * - Max capacity: 5,350 orders/month
     * - Target range: 350-4,000 orders
     * - At 4,000 orders: $779 charge (74% of cap) → approaching limit
     * - Natural break-even vs Enterprise: 850 orders
     * Rationale: Balanced cap covers target range with moderate headroom.
     * Test environment: $5 cap for easier testing
     */
    cappedAmount: isWIPAndRCEnv() ? TEST_ENV_CONFIG.CAPPED_AMOUNT : 1049,
    chargeApprovalRequired: true,
    highlighted: true,
    pricingVersion: 2, // Metadata only - do not use for business logic
    aiCreditsPerMonth: isWIPAndRCEnv() ? TEST_ENV_CONFIG.GROWTH.AI_CREDITS : 1000,
    features: {
      highResPngExport: true,
      fulfillment3rdPartyApi: true,
      upsellCheckbox: true,
      upsellProductLimit: null,
      losslessSvgExport: true,
      autoFulfillment: true,
      bulkAssignedProducts: false,
      priorityFeatureRequests: true,
      dedicatedSuccessManager: true,
      charmBuilder: true,
    },
    // Primary structure for business logic
    usages: {
      orders: [
        // First 350 orders included (5 for test env)
        { from: 1, to: isWIPAndRCEnv() ? TEST_ENV_CONFIG.GROWTH.FREE_ORDERS : 500, transactionFee: 0 },
        // Overage: $0.20 per order
        { from: isWIPAndRCEnv() ? TEST_ENV_CONFIG.GROWTH.FREE_ORDERS + 1 : 501, to: Infinity, transactionFee: 0.1 },
      ],
      revenue: [], // Not revenue-based
    },
  },
  {
    expiredAt: null,
    status: 'inactive',
    periodical: 'monthly',
    name: 'Enterprise',
    alias: 'enterprise_v2',
    description: '1,000 orders/mo included, $0.10/order overage, 5,000 AI credits, all features',
    price: 149,
    trialDays: 0,
    /**
     * cappedAmount: $1,149 ($149 base + $1,000 overage, following revenue model)
     * - Max capacity: 11,000 orders/month
     * - Target range: 1,000-20,000 orders
     * - At 11,000 orders: $1,149 charge (100% cap) - HITS CAP
     * - At 20,000 orders: Would be $2,049 but CAPPED at $1,149
     * ⚠️ WARNING: Cannot serve target high (20k orders). Lost revenue: $900/merchant at 20k orders.
     * Test environment: $5 cap for easier testing
     */
    cappedAmount: isWIPAndRCEnv() ? TEST_ENV_CONFIG.CAPPED_AMOUNT : 1149,
    chargeApprovalRequired: true,
    highlighted: false,
    pricingVersion: 2, // Metadata only - do not use for business logic
    aiCreditsPerMonth: isWIPAndRCEnv() ? TEST_ENV_CONFIG.ENTERPRISE.AI_CREDITS : 5000,
    features: {
      highResPngExport: true,
      fulfillment3rdPartyApi: true,
      upsellCheckbox: true,
      upsellProductLimit: null,
      losslessSvgExport: true,
      autoFulfillment: true,
      bulkAssignedProducts: true,
      priorityFeatureRequests: true,
      dedicatedSuccessManager: true,
      charmBuilder: true,
    },
    // Primary structure for business logic
    usages: {
      orders: [
        // First 1000 orders included (10 for test env)
        { from: 1, to: isWIPAndRCEnv() ? TEST_ENV_CONFIG.ENTERPRISE.FREE_ORDERS : 1000, transactionFee: 0 },
        // Overage: $0.10 per order
        {
          from: isWIPAndRCEnv() ? TEST_ENV_CONFIG.ENTERPRISE.FREE_ORDERS + 1 : 1001,
          to: Infinity,
          transactionFee: 0.1,
        },
      ],
      revenue: [], // Not revenue-based
    },
  },
  // V2 Trial Plan - DEPRECATED: Deactivated in favor of Shopify-managed trials on Starter/Growth
  // Existing subscriptions referencing this plan still work (referenced by _id)
  {
    expiredAt: null,
    status: 'inactive',
    periodical: 'monthly',
    name: 'Trial',
    alias: 'trial-v2',
    description: '14-day free trial: Unlimited orders, 500 AI credits, all features unlocked',
    price: 0,
    trialDays: isWIPAndRCEnv() ? TEST_ENV_CONFIG.TRIAL_DAYS : 14,
    cappedAmount: 0,
    chargeApprovalRequired: false,
    highlighted: false,
    pricingVersion: 2, // Metadata only - do not use for business logic
    userSelectable: false, // Auto-assigned only, not shown in pricing UI
    aiCreditsPerMonth: isWIPAndRCEnv() ? TEST_ENV_CONFIG.TRIAL.AI_CREDITS : 500,
    features: {
      highResPngExport: true,
      fulfillment3rdPartyApi: true,
      upsellCheckbox: true,
      upsellProductLimit: 1,
      losslessSvgExport: true,
      autoFulfillment: true,
      bulkAssignedProducts: true,
      priorityFeatureRequests: true,
      dedicatedSuccessManager: true,
      charmBuilder: true,
    },
    // Primary structure for business logic
    usages: {
      orders: [
        { from: 1, to: 999999, transactionFee: 0 }, // Effectively unlimited orders during trial
      ],
      revenue: [], // Not revenue-based
    },
  },
]

export default pricingPlans
