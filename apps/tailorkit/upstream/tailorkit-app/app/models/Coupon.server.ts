import type { CouponDocument, ICouponDiscount } from './Coupon'
import mongoose from '~/bootstrap/db/connect-db.server'
import Subscription from './Subscription.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
// import { serverInitiator } from '~/bootstrap/fns/initiator'
import { getShopData } from './Shop.server'
import type { SubscriptionDocument } from './Subscription'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import type { ShopDocument } from './Shop'
import { serverInitiator } from '~/bootstrap/fns/initiator'
import isString from 'lodash/isString'
import { getCouponAppliedOn } from '~/bootstrap/fns/coupon'

const couponSchema = new mongoose.Schema<CouponDocument>(
  {
    name: {
      type: String,
      index: true,
      required: true,
    },
    code: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    discount: {
      type: {
        type: String,
        index: true,
        default: 'percent',
        enum: ['fixed', 'percent'],
      },
      amount: {
        type: Number,
        index: true,
        required: true,
      },
    },
    limit: {
      usage: {
        type: Number,
        index: true,
      },
      /**
       * `expiresAt` defines the date at which an unused coupon will expire.
       *
       * For example, if `expiresAt` is '2025-02-28T23:59:59.999Z', then the coupon is no longer valid after this time.
       */
      expiresAt: {
        type: Date,
        index: true,
      },
      /**
       * `discountEndsAfter` defines the number of billing cycles (30-day) the discount will affect.
       *
       * For example, if `discountEndsAfter` is '1' month and the coupon is applied on 'January 31 2025', then a used
       * coupon will no longer affect after 'March 2nd 2025' (1 billing cycle).
       */
      discountEndsAfter: {
        type: Number,
        index: true,
      },
    },
    status: {
      type: String,
      index: true,
      default: 'active',
      enum: ['active', 'inactive'],
    },
    promotionId: String,
    /**
     * `applyTo` is a  list of shop domains that allowed to use a coupon. If `applyTo`
     * is not defined then the affected coupon will be available for all shops.
     */
    applyTo: [
      {
        type: String,
        index: true,
      },
    ],
    /**
     * Defines where the coupon can be applied:
     * - 'subscription': Applies to subscription price only
     * - 'ai_credits': Applies to AI credit purchases only
     * - 'both': Applies to both subscription and AI credit purchases
     * Defaults to 'subscription' for backward compatibility
     */
    applicableFor: {
      type: String,
      index: true,
      default: 'subscription',
      enum: ['subscription', 'ai_credits', 'both'],
    },
    /**
     * AI credit package discount settings (when applicableFor includes 'ai_credits')
     * If defined, the coupon can be used for AI credit purchases
     */
    aiCreditSettings: {
      minCredits: Number, // Minimum credits required to use coupon
      maxCredits: Number, // Maximum credits the coupon applies to
    },
    /**
     * Analytics tracking for coupon performance
     * Used to measure coupon effectiveness and ROI
     */
    analytics: {
      totalRedemptions: {
        type: Number,
        default: 0,
      },
      successfulRedemptions: {
        type: Number,
        default: 0,
      },
      failedAttempts: {
        type: Number,
        default: 0,
      },
      convertedShops: [
        {
          type: String,
        },
      ],
      totalRevenue: {
        type: Number,
        default: 0,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
  },
  { timestamps: true }
)

const Coupon = mongoose.models.Coupon || mongoose.model<CouponDocument>('Coupon', couponSchema)

export default Coupon

/**
 * Method to validate the availability of a coupon.
 *
 * @param coupon     Either a coupon code or a coupon object.
 * @param shopDomain This is the domain end with `.myshopify.com`.
 *
 * @return {Promise<boolean|CouponDocument>}
 */
export async function validateCoupon(
  coupon: any,
  shop: ShopDocument | string | null,
  // In some cases, we want to validate the coupon without considering the subscription
  // A shop can have multiple coupons applied.
  // In case we want to clean up expired coupons, we validate the coupon without considering the subscription.
  ignoreSubscription = false
): Promise<boolean | CouponDocument> {
  shop = isString(shop) ? await getShopData(shop) : shop
  coupon = isString(coupon) ? await Coupon.findOne({ code: coupon }) : coupon

  if (!shop || !coupon || coupon.status === 'inactive') {
    return false
  }

  if (coupon.applyTo?.length && !coupon.applyTo.includes(shop.shopDomain)) {
    return false
  }

  // Get current date
  const now = new Date()

  // Get current coupon usage
  const numUsed = await Subscription.countDocuments({ status: 'active', couponCode: coupon.code })

  // Validate coupon
  if (coupon.limit?.usage) {
    if (numUsed >= coupon.limit.usage) {
      return false
    }
  }

  // Check if coupon is applied to subscription
  const isCouponAppliedToSubscription = (shop?.subscription as SubscriptionDocument)?.couponCode === coupon.code

  // Validate coupon expiration date
  if (coupon.limit?.expiresAt && (!isCouponAppliedToSubscription || ignoreSubscription)) {
    if (now > coupon.limit.expiresAt) {
      return false
    }
  }

  if (coupon.limit?.discountEndsAfter && (isCouponAppliedToSubscription || ignoreSubscription)) {
    const couponAppliedOn = getCouponAppliedOn(shop, coupon, shop?.subscription as SubscriptionDocument)

    const discountEndsOn = new Date(
      couponAppliedOn.getTime() + 30 * coupon.limit.discountEndsAfter * ONE_DAY_IN_MILLISECONDS
    )

    if (now > discountEndsOn) {
      return false
    }
  }

  return coupon
}

/**
 * Deactivate a coupon
 * @param coupon - The coupon to deactivate
 */
export async function deactivateCoupon(coupon: null | string | CouponDocument) {
  coupon = isString(coupon) ? await Coupon.findOne({ code: coupon }) : coupon

  if (!coupon) {
    return
  }

  await Coupon.updateOne({ code: isString(coupon) ? coupon : coupon.code }, { status: 'inactive' })

  return coupon
}

/**
 * Clean up expired coupons by shop domain
 * @param shopDomain - The shop domain to clean up expired coupons for
 */
export async function cleanUpExpiredCouponsByShopDomain(shopDomain: string, shopData: ShopDocument) {
  const coupons = await Coupon.find({ applyTo: shopDomain, status: 'active' })

  await Promise.allSettled(
    coupons.map(async coupon => {
      const validatedCoupon = await validateCoupon(coupon, shopData, true)

      if (!validatedCoupon) {
        await deactivateCoupon(coupon)
      }

      return validatedCoupon
    })
  )
}

/**
 * Method to get the current coupon by shop domain.
 *
 * @param shopDomain This is the domain end with `.myshopify.com`.
 *
 * @return {Promise<CouponDocument[]>}
 */
export async function getCurrentCouponByShopDomain(shopDomain: string): Promise<CouponDocument[]> {
  const coupons = await Coupon.find(
    {
      $and: [
        { status: 'active' },
        { applyTo: shopDomain },
        {
          $or: [
            { 'limit.expiresAt': null },
            { 'limit.expiresAt': { $exists: false } },
            { 'limit.expiresAt': { $gte: new Date() } },
          ],
        },
      ],
    },
    null,
    {
      sort: { 'discount.amount': -1, 'limit.expiresAt': -1, 'limit.discountEndsAfter': -1 },
    }
  )

  // Validate coupons
  const validatedCoupons = await Promise.all(coupons.map(async coupon => validateCoupon(coupon, shopDomain)))

  return validatedCoupons.filter(Boolean) as unknown as CouponDocument[]
}

export async function runCreateDefaultCoupons() {
  if (!process.env.DEFAULT_COUPONS_IMPORTED) {
    ;(async function () {
      // Define default coupons
      const coupons = [
        {
          name: '30% off lifetime',
          code: 'TLK-LIFETIME-30',
          discount: {
            type: 'percent',
            amount: 30,
          },
          status: 'active',
        },
        {
          name: 'TLK8Z1X9V5',
          code: 'TLK8Z1X9V5',
          discount: {
            type: 'percent',
            amount: 50,
          },
          status: 'active',
        },
        {
          name: 'TLK3B7F2Y4',
          code: 'TLK3B7F2Y4',
          discount: {
            type: 'percent',
            amount: 20,
          },
          status: 'active',
        },
        {
          name: 'TLKQ6W0J8R1',
          code: 'TLKQ6W0J8R1',
          discount: {
            type: 'percent',
            amount: 10,
          },
          status: 'active',
        },

        // BFCM 2025 cross-promo with SHT
        {
          name: 'BFCM 2025 Cross-Promo with SHT',
          code: 'TKSHTF1M',
          status: 'active',
          discount: {
            type: 'percent',
            amount: 100,
          },
          limit: {
            // Free 1st month discount
            discountEndsAfter: 1,
          },
        },

        // BFCM 2025 cross-promo with SEOAnt
        {
          name: 'BFCM 2025 Cross-Promo with SEOAnt',
          code: 'TKSAF1M',
          status: 'active',
          discount: {
            type: 'percent',
            amount: 100,
          },
          limit: {
            // Free 1st month discount
            discountEndsAfter: 1,
          },
        },

        // Cross-promo with VIBE
        {
          name: 'Cross-Promo with VIBE',
          code: 'TKVBF1M',
          status: 'active',
          discount: {
            type: 'percent',
            amount: 100,
          },
          limit: {
            // Free 1st month discount
            discountEndsAfter: 1,
          },
        },

        // Old pricing migration discount
        {
          name: 'Old Pricing Migration 50% Off First Month',
          code: 'TLKMIG50',
          status: 'active',
          discount: {
            type: 'percent',
            amount: 50,
          },
          limit: {
            discountEndsAfter: 1,
            expiresAt: new Date('2026-06-30T23:59:59.999Z'), // End at last day of June 2026 to make sure it's not leaked to new users
          },
        },
      ]

      // Import default coupons
      try {
        for (const coupon of coupons) {
          await Coupon.updateOne({ code: coupon.code }, coupon, { upsert: true })
        }
      } catch (e) {
        console.error(formatErrorMessage(e))
      }
    })()

    process.env.DEFAULT_COUPONS_IMPORTED = 'yes'
  }
}

/**
 * Method to create a coupon for a shop.
 *
 * @param shopDomain  The shop domain where coupon is created.
 * @param discount    The discount to apply to the coupon.
 *
 * @returns {Promise<CouponDocument>}
 */
export async function createCouponForShop(shopDomain: string, discount: ICouponDiscount): Promise<CouponDocument> {
  try {
    // Generate unique coupon code
    let couponCode = generateCouponCode()

    const maxAttempts = 10
    let attempts = 0

    // Loop to check if coupon code already exists and attempts is less than maxAttempts
    while ((await Coupon.findOne({ code: couponCode })) && attempts < maxAttempts) {
      couponCode = generateCouponCode()
      attempts++
    }

    // Create coupon
    const coupon = await Coupon.create({ code: couponCode, discount, applyTo: [shopDomain] })

    return coupon
  } catch (e) {
    throw e
  }
}

/**
 * Apply a coupon to a shop
 */
export async function applyCouponToShop(coupon: null | string | CouponDocument, shop: null | string | ShopDocument) {
  shop = isString(shop) ? await getShopData(shop) : shop
  coupon = isString(coupon) ? await Coupon.findOne({ code: coupon }) : coupon

  const validatedCoupon = (await validateCoupon(coupon, shop)) as CouponDocument

  if (!shop || !coupon || !validatedCoupon) {
    throw new Error('Invalid parameter')
  }

  // Check if shop has already applied a coupon
  let couponAppliedOn: any = { couponAppliedOn: new Date().toISOString().substring(0, 10) }

  const appliedCoupon
    = (shop.subscription as SubscriptionDocument)?.coupon
    || (await Coupon.findOne({ code: (shop.subscription as SubscriptionDocument)?.couponCode }))

  if (appliedCoupon?.code === validatedCoupon.code) {
    throw new Error('Coupon was applied')
  }

  const appliedCouponStillValid = appliedCoupon && ((await validateCoupon(appliedCoupon, shop)) as CouponDocument)

  if (appliedCouponStillValid) {
    // Check if the applied coupon is similar to the one being redeemed
    if (
      appliedCoupon.limit?.discountEndsAfter
      && validatedCoupon.limit?.discountEndsAfter
      && appliedCoupon.discount.type === validatedCoupon.discount.type
      && appliedCoupon.discount.amount === validatedCoupon.discount.amount
    ) {
      // Deactivate the applied coupon
      await deactivateCoupon(appliedCoupon)

      // Add the applied coupon's lifetime to the new coupon's lifetime
      await Coupon.updateOne(
        { code: validatedCoupon.code },
        {
          limit: {
            ...validatedCoupon.limit,
            // Plus the applied coupon's lifetime to the new coupon's lifetime
            discountEndsAfter: validatedCoupon.limit.discountEndsAfter + appliedCoupon.limit.discountEndsAfter,
          },
        }
      )

      couponAppliedOn = {}
    }
  }

  await Subscription.updateOne(
    { _id: (shop.subscription as SubscriptionDocument)?._id || shop.subscription },
    { couponCode: validatedCoupon.code, ...couponAppliedOn }
  )

  return validatedCoupon
}

/**
 * Method to generate a coupon code with TLK prefix and uppercase.
 *
 * @returns {string}
 */
export function generateCouponCode(): string {
  return `TLK${Math.random().toString(36).substring(2, 15).toUpperCase()}`
}

// Add runCreateDefaultCoupons to serverInitiator
serverInitiator.addInitiator(runCreateDefaultCoupons)
