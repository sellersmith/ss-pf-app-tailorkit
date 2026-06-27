/* eslint-disable max-len */
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { isWIPAndRCEnv } from '~/app-configs.server'
import type { PromotionDocument } from './Promotion'

// Campaign IDs
export const CAMPAIGN_IDS = {
  PTE_VALENTINE_2026: 'pte-valentine-2026',
} as const

// Campaign configurations (shared settings)
function getCampaignConfig(campaignId: string) {
  const configs: Record<
    string,
    {
      startAt: Date
      endAt: Date
      status: 'active' | 'inactive'
    }
  > = {
    [CAMPAIGN_IDS.PTE_VALENTINE_2026]: {
      startAt: isWIPAndRCEnv()
        ? new Date('2025-12-31T00:00:00.000Z') // WIP/RC: start immediately for testing
        : new Date('2026-01-05T00:00:00.000Z'), // Production: actual campaign start
      endAt: new Date('2026-02-20T23:59:59.999Z'),
      status: 'active' as const,
    },
  }

  return configs[campaignId]
}

// Type-safe factory function for creating PTE promotions
function createPTEPromotion(config: {
  badgeName: 'Creator' | 'Artisan' | 'Master'
  threshold: number
  reward: {
    type: 'percent' | 'fixed'
    amount: number
    discountEndsAfter?: number
    content: PromotionDocument['reward']['content']
  }
  campaignId: string
  ordering: number
}): Omit<PromotionDocument, '_id'> {
  const campaignConfig = getCampaignConfig(config.campaignId)

  return {
    name: `Publish to Earn - ${config.badgeName} Badge`,
    startAt: campaignConfig.startAt,
    endAt: campaignConfig.endAt,
    campaignId: config.campaignId,
    status: campaignConfig.status,
    ordering: config.ordering,
    condition: {
      usageMetric: 'totalPublishedIntegrations',
      usageThreshold: config.threshold,
    },
    tracking: {
      eventName: EVENTS_TRACKING.PTE_BADGE_UNLOCKED,
      eventData: {
        badge: config.badgeName.toLowerCase(),
        threshold: config.threshold,
        campaignId: config.campaignId,
      },
    },
    reward: config.reward,
  }
}

// Define default promotions
const promotions = [
  {
    name: 'PMF Q1 2025 Promotion (First Sale)',
    endAt: new Date('2025-06-30T23:59:59.999Z'),
    status: 'inactive',
    ordering: 1,
    condition: {
      usageMetric: 'achievedFirstSale',
      usageThreshold: true,
      maxDaysUsingApp: 30,
    },
    reward: {
      type: 'percent',
      amount: 20,
    },
  },
  {
    name: 'PMF Q1 2025 Promotion ($200 Revenue)',
    endAt: new Date('2025-06-30T23:59:59.999Z'),
    status: 'inactive',
    ordering: 2,
    condition: {
      usageMetric: 'appGeneratedRevenue',
      usageThreshold: 200,
      maxDaysUsingApp: 30,
    },
    reward: {
      type: 'percent',
      amount: 20,
    },
  },
  {
    name: 'PMF Q1 2025 Promotion ($1500 Revenue)',
    endAt: new Date('2025-06-30T23:59:59.999Z'),
    status: 'inactive',
    ordering: 3,
    condition: {
      usageMetric: 'appGeneratedRevenue',
      usageThreshold: 1500,
      maxDaysUsingApp: 30,
    },
    reward: {
      type: 'percent',
      amount: 50,
    },
  },
  {
    name: 'PMF Q1 2025 Promotion (After Install)',
    endAt: new Date('2025-09-30T23:59:59.999Z'),
    status: 'inactive',
    ordering: 4,
    reward: {
      type: 'percent',
      amount: 50,
      // Discount will end after 1 billing cycle (30-day)
      discountEndsAfter: 1,
    },
  },
  {
    name: 'PMF Q1 2025 Promotion (First Published Integration)',
    endAt: new Date('2025-06-30T23:59:59.999Z'),
    status: 'inactive',
    ordering: 5,
    condition: {
      usageMetric: 'integrations',
      usageThreshold: 1,
      maxDaysUsingApp: 30,
    },
    reward: {
      type: 'percent',
      amount: 5,
    },
  },
  {
    name: 'AI Onboarding User Testing',
    status: 'inactive',
    ordering: 6,
    condition: {
      usageMetric: 'completed_ai_onboarding_user_testing',
      usageThreshold: true,
    },
    reward: {
      type: 'percent',
      amount: 50,
      // Discount will end after 3 billing cycles (90-day)
      discountEndsAfter: 3,
    },
  },
  {
    name: 'Dynamic Design User Testing',
    status: 'inactive',
    ordering: 7,
    condition: {
      usageMetric: 'completed_dynamic_design_user_testing',
      usageThreshold: true,
    },
    reward: {
      type: 'percent',
      amount: 50,
      // Discount will end after 3 billing cycles (90-day)
      discountEndsAfter: 3,
    },
  },
  createPTEPromotion({
    badgeName: 'Creator',
    threshold: 3,
    campaignId: CAMPAIGN_IDS.PTE_VALENTINE_2026,
    ordering: 10,
    reward: {
      type: 'percent',
      amount: 30,
      discountEndsAfter: 1,
      content: {
        badgeText: 'publish-to-earn-creator-badge-text',
        thumbnailUrl:
          'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/2b4948d995e42a893538e2a7e4b869d231600132.webp',
        items: [
          {
            type: 'download',
            title: 'publish-to-earn-creator-ebook-title',
            textAction: 'publish-to-earn-creator-ebook-action',
            url: 'https://drive.usercontent.google.com/u/0/uc?id=1N_jSJUFX5GCGgY_2-Jc4Wi4vk5-JGCua&export=download',
          },
        ],
      },
    },
  }),
  createPTEPromotion({
    badgeName: 'Artisan',
    threshold: 5,
    campaignId: CAMPAIGN_IDS.PTE_VALENTINE_2026,
    ordering: 11,
    reward: {
      type: 'percent',
      amount: 0,
      content: {
        badgeText: 'publish-to-earn-artisan-badge-text',
        thumbnailUrl:
          'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/8d8353f7c9e73143697083a47b39910a8a434bea.webp',
        items: [
          {
            type: 'link',
            title: 'publish-to-earn-artisan-template-title',
            textAction: 'publish-to-earn-artisan-template-action',
            url: 'https://drive.usercontent.google.com/u/0/uc?id=1i1QGvFQUPtBnORYBPTjxiUCg9EUjGp1r&export=download',
          },
        ],
      },
    },
  }),
  createPTEPromotion({
    badgeName: 'Master',
    threshold: 7,
    campaignId: CAMPAIGN_IDS.PTE_VALENTINE_2026,
    ordering: 12,
    reward: {
      type: 'percent',
      amount: 0,
      content: {
        badgeText: 'publish-to-earn-master-badge-text',
        thumbnailUrl:
          'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/1773b6e043e4a01b8e63421b45e9e3d0b5bca8d1.webp',
        items: [
          {
            type: 'text',
            title: 'publish-to-earn-master-stack-title',
            canExpand: true,
            items: [
              {
                type: 'partner_discount',
                title: 'publish-to-earn-master-seoant-title',
                textAction: 'publish-to-earn-master-discount-action',
                discountText: 'publish-to-earn-master-seoant-discount-text',
                discountCode: 'SEOWILL50%OFF',
                url: 'https://share.seoant.com/app/116825bde8b27941uL',
                tooltip: 'publish-to-earn-master-seoant-tooltip',
              },
              {
                type: 'partner_discount',
                title: 'publish-to-earn-master-trustoo-title',
                textAction: 'publish-to-earn-master-discount-action',
                discountText: 'publish-to-earn-master-trustoo-discount-text',
                url: 'https://share.channelwill.com/app/216900985deed34Y6L',
                tooltip: 'publish-to-earn-master-trustoo-tooltip',
              },
              // {
              //   type: 'partner_discount',
              //   title: 'publish-to-earn-master-uppromote-title',
              //   textAction: 'publish-to-earn-master-discount-action',
              //   url: 'https://apps.shopify.com/affliate-by-secomapp?app_code=up_promote&referral_code=BFCM2025_PARTNERS&utm_term=BFCM2025_PARTNERS&utm_campaign=secomapp-partner&utm_medium=up_promote&utm_source=BFCM2025_PARTNERS&sca_ref_code=BFCM2025_PARTNERS&sca_ref_offer=all',
              //   tooltip: 'publish-to-earn-master-uppromote-tooltip',
              // },
              {
                type: 'partner_discount',
                title: 'publish-to-earn-master-hextom-title',
                textAction: 'publish-to-earn-master-discount-action',
                discountText: 'publish-to-earn-master-hextom-discount-text',
                discountCode: 'FROMTAILORKIT20OFF',
                url: 'https://apps.shopify.com/ultimate-sales-boost?utm_source=partnership-pagefly&utm_medium=in-app&utm_campaign=app-partnership&utm_content=pagefly-spotlight-integration-banner&coupon=FROMTAILORKIT20OFF',
                tooltip: 'publish-to-earn-master-hextom-tooltip',
              },
              {
                type: 'partner_discount',
                title: 'publish-to-earn-master-wide-bundle-title',
                textAction: 'publish-to-earn-master-discount-action',
                discountText: 'publish-to-earn-master-wide-bundle-discount-text',
                url: 'https://widebundle.com/appstore?affiliateid=210&utm_source=tailorkit_in_app_popup',
                tooltip: 'publish-to-earn-master-wide-bundle-tooltip',
              },
            ],
          },
        ],
      },
    },
  }),
]

export default promotions
