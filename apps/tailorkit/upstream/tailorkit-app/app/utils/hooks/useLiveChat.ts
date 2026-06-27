import { ChatboxPosition, Crisp } from 'crisp-sdk-web'
import { format } from 'date-fns'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useRootLoaderData } from '~/root'
import useLCPRecorded from '../useLCPRecorded'
import { ShopErrors } from '~/constants/errors'
import { useLocation } from '@remix-run/react'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { isBraveBitsEmployee, isDevelopmentStore } from '~/bootstrap/fns/misc'
import {
  DEVELOPMENT_PREVIEW_CAMPAIGN,
  DEVELOPMENT_WRITE_KEY,
  PREVIEW_STORES,
  PRODUCTION_PREVIEW_CAMPAIGN,
  PRODUCTION_WRITE_KEY,
} from '~/constants/satismeter'
import { forceUpdateStore } from '~/stores/forceUpdate'
import { FORCE_UPDATE_ID } from '~/constants/force-update'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { ONE_MINUTE_IN_MILLISECONDS } from '~/constants'
import { isMaxModalRoute } from '~/utils/shopify'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useIsUnifiedEditor } from '~/hooks/useIsUnifiedEditor'

const formatTime = (time: string) => format(time, 'yyyy-MM-dd')
let initialized = false
const CRISP_ZINDEX = 512
const CRISP_MOUSE_MOVE_EVENT_IDLE = 250

const acceptCrisp = true

export const useLiveChat = (props: { moveable: boolean } = { moveable: false }) => {
  const { moveable } = props

  const location = useLocation()
  const lcpRecorded = useLCPRecorded()

  const { shopifyPartnerId, crispWebsiteId, shopData } = useRootLoaderData()!
  const { trackEvent } = useEventsTracking()
  const isUnifiedEditor = useIsUnifiedEditor()

  const [isNewConversation, setIsNewConversation] = useState(null)

  const [loaded, setLoaded] = useState(false)
  const [moving, setMoving] = useState(false)

  const onMessageCrispChat = useCallback(
    (data: any) => {
      try {
        const offered = sessionStorage.getItem('tlk_offer_install_app_block') === '1'
        if (offered) {
          // Track acceptance of support offer when user composes a message after auto-open
          trackEvent(EVENTS_TRACKING.INSTALL_APP_BLOCK_SUPPORT_ACCEPTED, {
            accept_type: 'auto_offer_then_user_engaged',
            channel: 'crisp',
          })
          sessionStorage.removeItem('tlk_offer_install_app_block')
        }
      } catch (_) {}

      forceUpdateStore.dispatch({
        type: 'SET_FORCE_UPDATE',
        payload: {
          key: FORCE_UPDATE_ID.NEW_MESSAGE_CRISP_CHAT,
          value: { message: `${data.content}_${Math.random()}` },
        },
      })
    },
    [trackEvent]
  )

  const initCrisp = useCallback(() => {
    try {
      if (!shopData) {
        console.error(ShopErrors.INVALID_SHOP_DATA)

        return
      }

      const { shopConfig, createdAt: installed_at, subscription } = shopData

      const planName = subscription?.plan?.name || 'Onboarding'
      const planPrice = subscription?.plan?.price || 0

      const {
        id: shopId,
        email,
        shop_owner,
        phone,
        created_at,
        plan_display_name,
        myshopify_domain: shopDomain,
      } = shopConfig

      // There is a bug in Crisp where the chat box is not shown if the Crisp.configure is called multiple times
      // if (!initialized && crispWebsiteId && shopId) {
      if (crispWebsiteId && shopId) {
        console.log('Crisp is initialized', !!initialized)
        const storeAccess = `https://partners.shopify.com/${shopifyPartnerId}/stores/${shopId}`

        Crisp.configure(crispWebsiteId)
        Crisp.setTokenId(shopDomain)
        Crisp.setZIndex(CRISP_ZINDEX)
        Crisp.setPosition(ChatboxPosition.Right)

        email && Crisp.user.setEmail(email)
        shop_owner && Crisp.user.setNickname(shop_owner)
        phone && Crisp.user.setPhone(phone)

        Crisp.session.setData({
          installed_at: formatTime((installed_at ?? new Date()).toString()),
          created_at: formatTime((created_at ?? new Date()).toString()),
          store_access: storeAccess || '',
          tailorkit_plan: planName,
          price: planPrice,
          shopify_plan: plan_display_name || '',
          // total_store: totalStores || 0,
          store_url: shopDomain || '',
        })

        Crisp.chat.onChatInitiated(() => {
          // Init TailorKit segment
          Crisp.session.setSegments(['tailorkit'], true)
        })

        Crisp.chat.onChatOpened(() => {
          Crisp.session.setSegments(['tailorkit'], true)
        })

        Crisp.chat.onChatClosed(() => {
          // Re-apply CSS hide on mobile + max modal route or unified editor
          const pathname = window.location?.pathname || location.pathname
          const isMaxModal = isMaxModalRoute(pathname)

          // Check for unified editor mode
          const isUnified = isUnifiedEditor

          if (isMaxModal || isUnified) {
            try {
              Crisp.setHideOnMobile(true)
              Crisp.chat.hide()
            } catch (_) {}
            try {
              window.$crisp?.push?.(['do', 'chat:hide'])
            } catch (_) {}
            // Ensure final state after internal animations
            setTimeout(() => {
              try {
                window.$crisp?.push?.(['do', 'chat:hide'])
              } catch (_) {}
            }, 250)
          }
        })

        Crisp.message.onMessageComposeReceived(onMessageCrispChat)

        // Open chat when admin sends a message, even in unified editor mode
        Crisp.message.onMessageReceived(() => {
          Crisp.chat.show()
          Crisp.chat.open()
        })

        if (lcpRecorded) {
          Crisp.session.onLoaded(() => {
            setTimeout(() => {
              setIsNewConversation(window.$crisp?.is && !window.$crisp.is('session:ongoing'))
              setLoaded(true)
            }, 1500)
          })
        }

        Crisp.setAvailabilityTooltip(false)

        initialized = true
      }

      if (!acceptCrisp && crispWebsiteId && shopId) {
        Crisp.chat.hide()
      }

      if (acceptCrisp && crispWebsiteId && shopId) {
        Crisp.chat.show()
      }

      // Send user traits to Satismeter
      if (window.satismeter) {
        const isDevStore = isDevelopmentStore(shopData.shopConfig) && isBraveBitsEmployee(shopData.shopConfig)

        window.satismeter({
          ...(PREVIEW_STORES.includes(shopDomain)
            ? {
                previewCampaign: isDevStore ? DEVELOPMENT_PREVIEW_CAMPAIGN : PRODUCTION_PREVIEW_CAMPAIGN,
              }
            : {}),
          writeKey: isDevStore ? DEVELOPMENT_WRITE_KEY : PRODUCTION_WRITE_KEY,
          userId: shopDomain || email || phone || shop_owner || 'anonymous',
          traits: {
            email,
            shop_owner,
            shopDomain,
            phone: phone || '',
            createdAt: shopData.createdAt,
            lastAccess: shopData.lastAccess || '',
            uninstalledAt: shopData.uninstalledAt || '',
            installed_app: shopData.appConfig?.occurredEvents?.[CUSTOMERIO_EVENTS.INSTALLED_APP] || 1,
            city: shopData.shopConfig?.city || '',
            name: shopData.shopConfig?.name || '',
            domain: shopData.shopConfig?.domain || '',
            currency: shopData.shopConfig?.currency || '',
            timezone: shopData.shopConfig?.timezone || '',
            plan_name: shopData.shopConfig?.plan_name || '',
            created_at: shopData.shopConfig?.created_at || '',
            country_name: shopData.shopConfig?.country_name || '',
            assets: shopData.usages?.assets || 0,
            orders: shopData.usages?.orders || 0,
            usageFee: shopData.usages?.usageFee || 0,
            templates: shopData.usages?.templates || 0,
            integrations: shopData.usages?.integrations || 0,
            appGeneratedRevenue: shopData.usages?.appGeneratedRevenue || 0,
          },
        })

        // Track the user if they have been installed in the last 5 minutes
        if (Date.now() - new Date(shopData.createdAt).getTime() < 5 * ONE_MINUTE_IN_MILLISECONDS) {
          window.satismeter('track', { event: EVENTS_TRACKING.INSTALL_APP_WITHIN_5_MINUTES })
        }

        // Track the user if they have achieved a sale
        if (shopData.appConfig?.occurredEvents?.[EVENTS_TRACKING.ACHIEVE_SALE]) {
          window.satismeter('track', { event: EVENTS_TRACKING.ACHIEVE_SALE })
        }

        // Trigger targeted satisfaction survey after merchant's first charm order
        // Optimal timing: value already delivered → merchant ready to give honest feedback
        if (shopData.usages?.achievedFirstCharmOrder) {
          window.satismeter('track', { event: EVENTS_TRACKING.ACHIEVE_FIRST_CHARM_ORDER })
        }
      }

      // Identify the current user with Microsoft Clarity.
      window.clarity?.('identify', shopDomain || email || phone || shop_owner, undefined, location.pathname, shopDomain)
    } catch (_) {
      console.error('[Crisp Debug] Failed to initialize Crisp', _)
    }
  }, [shopData, crispWebsiteId, location.pathname, shopifyPartnerId, onMessageCrispChat, lcpRecorded, isUnifiedEditor])

  const checkCrispPosition = useCallback(() => {
    if (isUnifiedEditor) {
      initCrisp()

      // Ensure chat position is set to Right (not reversed) for unified editor
      try {
        Crisp.setPosition(ChatboxPosition.Right)
      } catch (_) {}

      // Also configure position using $crisp API to ensure correct position
      try {
        const w: any = window as any
        w.$crisp = w.$crisp || []
        // Set position:reverse to false (right side, not left)
        w.$crisp.push(['config', 'position:reverse', [false]])
        // Also explicitly show using $crisp API to ensure it's visible
        w.$crisp.push(['do', 'chat:show'])
      } catch (_) {}
    }
  }, [initCrisp, isUnifiedEditor])

  const openChatBox = useCallback(
    (initialMessage?: string) => {
      if (acceptCrisp) {
        checkCrispPosition()

        // Show and open the Crisp chat
        try {
          Crisp.chat.show()
          Crisp.chat.open()
        } catch (_) {
          // Fallback to $crisp API if Crisp.chat is not available
          try {
            const w: any = window as any
            w.$crisp = w.$crisp || []
            w.$crisp.push(['do', 'chat:show'])
            w.$crisp.push(['do', 'chat:open'])
          } catch (_) {}
        }

        if (initialMessage) {
          Crisp.message.show('text', initialMessage)
        }
      }
    },
    [checkCrispPosition]
  )

  const openChat = useCallback(
    (initialMessage: string) => {
      openChatBox()

      // Set message text
      Crisp.message.setMessageText(initialMessage)
    },
    [openChatBox]
  )

  const openChatBotAndSendUserMessage = useCallback(
    (userMessage: string) => {
      checkCrispPosition()

      // Check if Crisp is loaded
      if (window.$crisp) {
        // Open Crisp chat and send an automated message
        window.$crisp.push(['do', 'chat:open'])
        window.$crisp.push(['do', 'message:send', ['text', userMessage]])
      }
    },
    [checkCrispPosition]
  )

  const closeChatBox = useCallback(() => {
    try {
      Crisp.chat.hide()
      Crisp.chat.close()
    } catch (_) {}
  }, [])

  useEffect(() => {
    // On route or device change, maintain CSS-based hide for mobile max modal
    const isMaxModal = isMaxModalRoute(location.pathname)

    if (isMaxModal || isUnifiedEditor) {
      // injectCrispHideStyle()
      // Hide Crisp chat bubble using SDK
      try {
        Crisp.chat.hide()
      } catch (_) {}
      try {
        const w: any = window as any
        w.$crisp = w.$crisp || []
        w.$crisp.push(['do', 'chat:hide'])
      } catch (_) {}
    } else {
      // Also explicitly show Crisp bubble when leaving mobile or modal routes
      try {
        const w: any = window as any
        w.$crisp = w.$crisp || []
        w.$crisp.push(['do', 'chat:show'])
      } catch (_) {}
    }
  }, [location.pathname, isUnifiedEditor])

  useEffect(() => {
    if (isNewConversation && acceptCrisp) {
      Crisp.chat.show()
      Crisp.setAvailabilityTooltip(true)
    }
  }, [isNewConversation, isUnifiedEditor])

  useEffect(() => {
    if (!loaded) return

    if (moveable) {
      ;(function () {
        let mouseTimer: number
        let isHolding = false
        const crispActivator = document.querySelector('#crisp-chatbox > div > a') as HTMLAnchorElement | null

        if (!crispActivator) return

        function mouseDown() {
          mouseUp()
          mouseTimer = window.setTimeout(execMouseDown, CRISP_MOUSE_MOVE_EVENT_IDLE)
        }

        function mouseUp() {
          if (mouseTimer) {
            window.clearTimeout(mouseTimer)
          }

          isHolding = false

          setMoving(false)
        }

        function execMouseDown() {
          isHolding = true

          setMoving(true)
        }

        function mouseMove(e: MouseEvent) {
          const x = e.clientX
          const y = e.clientY
          if (isHolding && crispActivator) {
            // eslint-disable-next-line max-len
            crispActivator.style.cssText += `top: ${y}px !important; left: ${x}px !important; bottom: auto !important; right: auto !important; transform: translate(-50%, -50%);`
          }
        }

        crispActivator.addEventListener('mousedown', mouseDown)
        document.body.addEventListener('mouseup', mouseUp)
        document.body.addEventListener('mousemove', mouseMove)

        return () => {
          crispActivator.removeEventListener('mousedown', mouseDown)
          document.body.removeEventListener('mouseup', mouseUp)
          document.body.removeEventListener('mousemove', mouseMove)
        }
      })()
    }
  }, [moveable, loaded])

  // Detect live chat opened
  const [liveChatOpened, setLiveChatOpened] = useState(false)

  useLayoutEffect(() => {
    function checkCrispChatOpen() {
      if (window.$crisp?.is?.('chat:opened')) {
        setLiveChatOpened(true)
      } else {
        setLiveChatOpened(false)
      }
    }

    const timer = setInterval(checkCrispChatOpen, 1000)

    return () => clearInterval(timer)
  }, [])

  return {
    moving,
    initCrisp,
    openChatBox,
    openChat,
    closeChatBox,
    liveChatOpened,
    openChatBotAndSendUserMessage,
  }
}
