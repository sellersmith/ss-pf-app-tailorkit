import { Outlet, useLocation, useNavigation } from '@remix-run/react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { ClientOnly } from 'remix-utils/client-only'
import { CHAT_BOT_DRAWER_WIDTH } from '~/components/ChatBotDrawer/constants'
import { HYDRATED_TIMEOUT, ONE_SECOND_IN_MILLISECONDS } from '~/constants'
import { useChatBot } from '~/providers/ChatBotContext'
import useDevices from '~/utils/hooks/useDevice'
import { isMaxModalRoute, isProductEditorModalRoute } from '~/utils/shopify'
import { ChatBotDrawer } from '../../ChatBotDrawer'
import PageLoadingSkeleton from '../../skeleton/PageLoading'
import styles from './styles.module.css'
import { FlexRow } from '~/components/common/Flex'
import { LARGE_INSPECTOR_WIDTH } from '~/modules/TemplateEditor/constants'
import { ROUTES_WITH_SKELETONS, ROUTE_SKELETONS } from '~/constants/route-skeletons'
import { isInAnySeason } from '~/constants/seasonal'
import { useRootLoaderData } from '~/root'
import TrialDealWidget from '~/components/TrialDealWidget'

export function AppLayout() {
  const [appRootLoaded, setAppRootLoaded] = useState(false)

  const { isOpen } = useChatBot()

  // Deal flags for TrialDealWidget (from root loader, populated server-side)
  const { isDealActive, isDealEligible } = useRootLoaderData() || {}
  const location = useLocation()
  const { isMobileView } = useDevices()

  const { pathname } = location

  const navigation = useNavigation()
  const navigationState = navigation.state

  const shouldShowLoadingRoot = navigationState === 'idle' && !appRootLoaded
  const isLoading = navigationState !== 'idle'

  // Don't hide content for routes that have their own skeleton components
  // Check both current pathname and destination pathname (during navigation)
  const targetPathname = navigation.location?.pathname || pathname
  const hasCustomSkeleton = ROUTES_WITH_SKELETONS.some(route => targetPathname.startsWith(route))
  const shouldHideContent = isLoading && hasCustomSkeleton

  const skeletonComponent = useMemo(
    () => (shouldHideContent ? ROUTE_SKELETONS[targetPathname as keyof typeof ROUTE_SKELETONS] : null),
    [shouldHideContent, targetPathname]
  )

  const pageIsMaxModal = isMaxModalRoute(pathname)

  const classNameMainContentWithDrawer = `${isOpen ? styles.mainContentWithDrawer : ''}`
  const classNameMainContentOnMaxModal = `${pageIsMaxModal ? styles.mainContentOnMaxModal : ''}`

  useEffect(() => {
    if (appRootLoaded) return

    const documentElement = document.documentElement

    if (documentElement) {
      const isMobileViewAndOpen = isMobileView && isOpen

      const isProductEditor = isProductEditorModalRoute(pathname)
      // Add CSS variable for drawer width
      documentElement.style.setProperty(
        '--chat-bot-drawer-width',
        `${isMobileViewAndOpen ? '100%' : `${isProductEditor ? LARGE_INSPECTOR_WIDTH : `${CHAT_BOT_DRAWER_WIDTH}px`}`}`
      )
    }

    setTimeout(
      () => {
        setAppRootLoaded(true)
      },
      HYDRATED_TIMEOUT + (isInAnySeason() ? ONE_SECOND_IN_MILLISECONDS : 0)
    )
  }, [isOpen, isMobileView, pathname, appRootLoaded])

  return (
    <div id="tailorkit-app-layout" style={{ minHeight: '100vh', minWidth: '100vw', position: 'relative' }}>
      <img
        alt="Loading..."
        width="99998"
        height="99998"
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          zIndex: 1,
        }}
        src={'/assets/tailorkit_image_placeholder.jpg'}
      />
      <div
        style={{
          display: isLoading && hasCustomSkeleton && appRootLoaded ? 'block' : 'none',
          position: 'relative',
          zIndex: 12,
        }}
      >
        {skeletonComponent}
      </div>
      <div style={{ display: isLoading || shouldShowLoadingRoot ? 'none' : undefined }}>
        <FlexRow style={{ maxWidth: '100vw', overflowX: 'hidden', width: '100vw', height: '100vh' }}>
          <div
            className={`${styles.mainContent} ${classNameMainContentWithDrawer} ${classNameMainContentOnMaxModal}`}
            style={{
              display: isMobileView && isOpen ? 'none' : 'block',
              backgroundImage: `url(/assets/tailorkit_image_placeholder${pageIsMaxModal ? '_white' : ''}.jpg)`,
              maxHeight: '100vh',
              maxWidth: '100vw',
              position: 'relative',
              zIndex: 2,
            }}
          >
            <div style={{ zIndex: 3, position: 'relative' }}>
              <Outlet />
            </div>
          </div>
          <div className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}>{isOpen && <ChatBotDrawer />}</div>
        </FlexRow>
      </div>

      <ClientOnly fallback={null}>
        {() => <Fragment>{shouldShowLoadingRoot ? <PageLoadingSkeleton /> : null}</Fragment>}
      </ClientOnly>

      <ClientOnly fallback={null}>
        {() => <TrialDealWidget isDealActive={isDealActive} isDealEligible={isDealEligible} />}
      </ClientOnly>
    </div>
  )
}
