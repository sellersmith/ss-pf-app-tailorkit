import {
  SettingsAccountSkeleton,
  SettingsBillingSkeleton,
  SettingsPreferencesSkeleton,
} from '~/routes/settings/components/SettingSkeletons'
import {
  SaleToolsStorefrontSkeleton,
  SaleToolsSalesSkeleton,
  SaleToolsAIToolsSkeleton,
} from '~/routes/storefront-setup/components/SaleToolsSkeletons'
import {
  SkeletonPersonalizedProducts,
  SkeletonTemplates,
  SkeletonStorefrontSetup,
  SkeletonOrders,
  SkeletonAnalytics,
  SkeletonCheckboxes,
  SkeletonCheckboxEdit,
} from '~/components/skeleton/Pages'

/**
 * Map of route paths to their corresponding skeleton components.
 * Add new routes here to enable skeleton loading states during navigation.
 *
 * @example
 * // To add a new route:
 * '/dashboard': <DashboardSkeleton />,
 */
export const ROUTE_SKELETONS = {
  '/settings/account': <SettingsAccountSkeleton />,
  '/settings/billing': <SettingsBillingSkeleton />,
  '/settings/preferences': <SettingsPreferencesSkeleton />,
  '/personalized-products': <SkeletonPersonalizedProducts />,
  '/templates': <SkeletonTemplates />,
  '/storefront-setup/storefront': <SaleToolsStorefrontSkeleton />,
  '/storefront-setup/sales': <SaleToolsSalesSkeleton />,
  '/storefront-setup/ai-tools': <SaleToolsAIToolsSkeleton />,
  '/storefront-setup/checkboxes': <SkeletonCheckboxes />,
  '/storefront-setup/checkboxes/edit': <SkeletonCheckboxEdit />,
  '/storefront-setup': <SkeletonStorefrontSetup />,
  '/orders': <SkeletonOrders />,
  '/analytics': <SkeletonAnalytics />,
  // Future routes can be added here easily:
  // '/dashboard': <DashboardSkeleton />,
  // '/products': <ProductsSkeleton />,
} as const

/**
 * Array of route paths that have skeleton components.
 * Used by AppLayout to determine if a route should show its skeleton during navigation.
 */
export const ROUTES_WITH_SKELETONS = Object.keys(ROUTE_SKELETONS)
