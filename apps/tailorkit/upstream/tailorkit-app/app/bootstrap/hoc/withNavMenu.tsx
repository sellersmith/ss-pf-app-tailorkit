import type { ComponentClass, FunctionComponent } from 'react'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import withCrispChat from './withCrispChat'
import CustomRemixLink from '~/components/CustomRemixLink'
import withTranslation from '~/bootstrap/hoc/withTranslation'
import { Fragment, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate, useRouteLoaderData } from '@remix-run/react'
import { NavMenu } from '@shopify/app-bridge-react'
import { isNavMenuItemEnabled, NavMenuItems } from '~/bootstrap/app-config'
import withWindowVariables from './withWindowVariables'
import { ShopErrors } from '~/constants/errors'
import { canUseFreeResources, hasActivePlan, isApprovedCharge } from '~/models/PricingPlan.fns'
import type { ShopDocument } from '~/models/Shop'
import type { RootLoaderData } from '~/types/loaders'
import { EMPTY_ARRAY } from '~/constants'
import PageGap from '~/components/layouts/AppLayout/PageGap'
import { isProductEditorModalRoute, isOnboardingEditorRoute, isOnboardingRoute } from '~/utils/shopify'

export default function withNavMenu(
  Component?: FunctionComponent<WithTranslationProps> | ComponentClass<WithTranslationProps>
) {
  return withWindowVariables(
    withTranslation(
      withCrispChat(function WithNavMenu(props: any) {
        const { t } = props

        const [hydrated, setHydrated] = useState(false)

        const rootLoaderData = useRouteLoaderData<RootLoaderData>('root')
        const { shopData } = rootLoaderData || {}

        const navigate = useNavigate()
        const location = useLocation()
        const pathname = location.pathname
        const isPricingPage = pathname === NavMenuItems.PRICING
        const isProductEditorModal = isProductEditorModalRoute(pathname)
        const isPossibleUseFreeResources = shopData && canUseFreeResources({ shopData: shopData as ShopDocument })

        const shouldShowPageGap = !isProductEditorModal

        useLayoutEffect(() => {
          if (!rootLoaderData || !shopData) {
            console.error(ShopErrors.INVALID_SHOP_DATA)
            return
          }

          // Redirect to the pricing page if the shop published at least 1 integrated product and is not subscribed
          const isDashboard = pathname.startsWith('/dashboard')
          if (
            !isPossibleUseFreeResources
            && !isPricingPage
            && !isDashboard
            && !isOnboardingEditorRoute(pathname, location.search)
          ) {
            navigate(NavMenuItems.PRICING)
            return
          }
        }, [shopData, navigate, rootLoaderData, pathname, location.search, isPricingPage, isPossibleUseFreeResources])

        useEffect(() => {
          setHydrated(true)
        }, [])

        // Subscribed merchants see "Billing" instead of "Pricing".
        // Route path stays /pricing — only the display label changes.
        const showBillingLabel = hasActivePlan(shopData as ShopDocument | undefined)

        // Define nav menu items.
        const navMenuItems: { [key: string]: string } = useMemo(
          () => ({
            [NavMenuItems.DASHBOARD]: t('dashboard'),
            [NavMenuItems.PERSONALIZED_PRODUCTS]: t('personalized-products'),
            [NavMenuItems.TEMPLATES]: t('templates'),
            [NavMenuItems.STOREFRONT_SETUP]: t('sales-tools'),
            [NavMenuItems.ORDERS]: t('orders'),
            [NavMenuItems.ANALYTICS]: t('analytics'),
            [NavMenuItems.PRICING]: showBillingLabel ? t('billing') : t('pricing'),
            [NavMenuItems.SETTINGS]: t('settings'),
          }),
          [t, showBillingLabel]
        )

        // Filter enabled nav menu items.
        // Hide nav menu ONLY when on pricing page AND user can't use free resources
        // (Force user to select a plan when trial expired or no valid plan)
        // Trial users CAN use free resources, so nav menu should be visible for them
        // Also hide nav during Quick Setup wizard for unsubscribed merchants so they
        // stay focused on the onboarding flow.
        const isSubscribed = shopData ? isApprovedCharge(shopData as ShopDocument) : false
        const shouldHideNavMenu
          = (!isPossibleUseFreeResources && (isOnboardingRoute(location.search) || isPricingPage))
          || (props.createWizardActive && !isSubscribed)
        const filteredNavMenuItems = useMemo(
          () =>
            shouldHideNavMenu ? EMPTY_ARRAY : Object.keys(navMenuItems).filter(path => isNavMenuItemEnabled(path)),
          [navMenuItems, shouldHideNavMenu]
        )

        return (
          <Fragment>
            <div style={{ display: 'none' }}>
              <NavMenu>
                {filteredNavMenuItems.map(path => (
                  <CustomRemixLink key={path} to={path} rel={path === NavMenuItems.DASHBOARD ? 'home' : undefined}>
                    {navMenuItems[path]}
                  </CustomRemixLink>
                ))}
              </NavMenu>
            </div>

            {Component && hydrated ? (
              <Fragment>
                <Component {...props} />
                {shouldShowPageGap && <PageGap />}
              </Fragment>
            ) : (
              <Outlet />
            )}
          </Fragment>
        )
      })
    )
  )
}
