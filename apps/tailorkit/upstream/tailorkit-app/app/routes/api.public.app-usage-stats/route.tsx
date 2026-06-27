import type { LoaderFunctionArgs } from '@remix-run/node'
import Shop, { updateShopUsages } from '~/models/Shop.server'
import { catchAsync } from '~/utils/catchAsync'
import { json } from '~/bootstrap/fns/fetch.server'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import { syncUserDataToCustomerIo } from '~/modules/customer.io/api.server'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url)
  const isAuthorized = searchParams.get('token') === process.env.SECRET_TOKEN

  if (!isAuthorized) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Update shop uages
    const unsyncedShops = await Shop.find({
      $or: [
        { 'usages.firstIntegrationPublishedAfterHowManyDays': null },
        { 'usages.firstIntegrationPublishedAfterHowManyDays': { $exists: false } },
      ],
    })

    await Promise.all(unsyncedShops.map(shop => updateShopUsages(shop.shopDomain, false).catch(console.error)))

    // Look up database for app usage stats
    const stats = await Shop.aggregate([
      { $match: { lastAccess: { $gte: new Date(Date.now() - ONE_DAY_IN_MILLISECONDS) } } },
      { $sort: { createdAt: 1 } },
      {
        $project: {
          shop_domain: '$shopDomain',
          shop_name: '$shopConfig.name',
          email: '$shopConfig.email',
          installed_at: '$createdAt',
          status: { $cond: [{ $eq: ['$uninstalledAt', null] }, 'Active', 'Uninstalled'] },
          last_access: '$lastAccess',
          uninstalled_at: '$uninstalledAt',
          review_data: '$appConfig.reviewData',
          timezone: '$shopConfig.timezone',
          country: '$shopConfig.country_name',
          owner_name: '$shopConfig.shop_owner',
          shopify_plan: '$shopConfig.plan_display_name',
          used_ai_assistant: '$usages.usedAIAssistant',
          used_generative_ai: '$usages.usedGenerativeAI',
          updated_at: '$updatedAt',
          completed_onboarding: '$appConfig.occurredEvents.completed_onboarding',
          total_created_templates: '$usages.totalCreatedTemplates',
          total_integrated_templates: '$usages.totalIntegratedTemplates',
          first_template_created_at: '$usages.firstTemplateCreatedAt',
          first_template_created_after_how_many_days: '$usages.firstTemplateCreatedAfterHowManyDays',
          last_template_created_at: '$usages.lastTemplateCreatedAt',
          total_created_integrations: '$usages.totalCreatedIntegrations',
          total_published_integrations: '$usages.totalPublishedIntegrations',
          published_integrations: '$usages.publishedIntegrations',
          first_integration_published_at: '$usages.firstIntegrationPublishedAt',
          first_integration_published_after_how_many_days: '$usages.firstIntegrationPublishedAfterHowManyDays',
          last_integration_published_at: '$usages.lastIntegrationPublishedAt',
          shop_description: '$metadata.shopDescription',
          shop_categories: '$metadata.shopCategories',
          personalization_compatibility_score: '$metadata.personalizationCompatibilityScore',
        },
      },
    ]).exec()

    // Update inactive users segment
    stats.forEach(async shop => {
      if (shop.email) {
        let inactive
        const [firstName, lastName] = shop.owner_name?.split(' ', 2) || []
        const lastActive = shop.last_access || shop.installed_at || shop.updated_at

        if (lastActive) {
          inactive = shop.total_created_templates < 1 && Date.now() - lastActive.getTime() > 3 * ONE_DAY_IN_MILLISECONDS
        }

        await syncUserDataToCustomerIo(shop.email, {
          inactive,
          lastName,
          firstName,
          ownerName: shop.owner_name,
        }).catch(console.error)
      }

      delete shop.updated_at
    })

    return json({ success: true, data: stats })
  } catch (e: any) {
    return json({ success: false, error: e?.message || e }, { status: 500 })
  }
})
