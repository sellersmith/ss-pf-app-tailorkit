import type { ComponentClass, FunctionComponent } from 'react'
import { Fragment, memo, useCallback, useEffect, useRef } from 'react'
import { Box, Icon, Tooltip } from '@shopify/polaris'
import { useElementObserver } from '~/components/TourGuide/utils/useElementObserver'
import { useChatBot } from '~/providers/ChatBotContext'
import { NotificationCount } from '~/components/ChatBotDrawer/components/notifications/NotificationCount'
import { MagicIcon } from '@shopify/polaris-icons'
import { ENABLE_CUSTOM_CRISP_CHAT } from '~/constants/crisp-chat'
import { useLocation } from '@remix-run/react'
import { isMaxModalRoute } from '~/utils/shopify'
import styles from '~/components/ChatBotDrawer/ChatBotDrawer.module.css'
import { useTranslation } from 'react-i18next'
import useDevices from '~/utils/hooks/useDevice'
import { useIsUnifiedEditor } from '~/hooks/useIsUnifiedEditor'

const SPACING_FROM_CRISP = 8 // Spacing between ChatBot and Crisp chat
const CHATBOT_HEIGHT = 36 // Size of the ChatBot icon
const CRISP_POLLING_MAX_TRIES = 20
const CRISP_POLLING_INTERVAL = 500
const ENABLE_CHATBOT = true
// const NARROW_WIDTH_PX = 768

/**
 * HOC that adds a ChatBot icon above the Crisp chat interface
 * and displays a notification badge for MCP tool executed notifications.
 * @param Component - The component to wrap
 * @returns A wrapped component with ChatBot functionality
 */
export default function withChatBot<P extends object>(Component: FunctionComponent<P> | ComponentClass<P>) {
  return function WithChatBot(props: P) {
    const chatBotRef = useRef<HTMLElement>(null)

    // Set compact mode to true for making AI icon consistent across the app
    const isCompactMode = true
    const { isMobileView } = useDevices()
    const hideObserverRef = useRef<MutationObserver | null>(null)

    // Detect current route
    const location = useLocation()
    const pathname = location.pathname
    const isMaxModalRouter = isMaxModalRoute(pathname)
    const isUnifiedEditor = useIsUnifiedEditor()
    const crispBlockSelector = ENABLE_CUSTOM_CRISP_CHAT
      ? '.crisp-chat-wrapper'
      : '#crisp-chatbox div[role="button"] span[style*="background"]'

    const getLastCrispBlock = useCallback(() => {
      return [...document.querySelectorAll(crispBlockSelector)].pop() as HTMLElement | null
    }, [crispBlockSelector])

    const timeoutId = useRef<NodeJS.Timeout | null>(null)
    const countRef = useRef<number>(0)
    // Configure Crisp bubble position depending on the current route (Template Editor -> left bottom)
    useEffect(() => {
      // $crisp may not be ready yet; queue calls on the array
      const updateCrispVisibility = () => {
        if (typeof window === 'undefined') return

        const w: any = window as any
        w.$crisp = w.$crisp || []
        const crispPush = (args: any[]) => {
          try {
            w.$crisp.push(args)
          } catch (e) {
            // no-op
          }
        }

        // const isLikelyMobileByWidth = window.innerWidth <= NARROW_WIDTH_PX

        crispPush(['config', 'position:reverse', [isMaxModalRouter]])

        const shouldForceHide = isMaxModalRouter || isUnifiedEditor //&& (isMobileView || isLikelyMobileByWidth)

        if (shouldForceHide) {
          // Close (in case persisted open) then hide to prevent bubble on load
          crispPush(['do', 'chat:close'])
          crispPush(['do', 'chat:hide'])
        } else {
          crispPush(['do', 'chat:show'])
          // Clear any inline styles applied during forced hide
          try {
            const node = getLastCrispBlock()
            if (node) {
              node.style.display = ''
              node.style.visibility = ''
              node.style.opacity = ''
              node.style.pointerEvents = ''
            }
          } catch (_) {}
        }
      }

      // Run immediately as well (in case Crisp already loaded or to queue commands)
      updateCrispVisibility()
    }, [location.pathname, isMobileView, crispBlockSelector, getLastCrispBlock, isMaxModalRouter, isUnifiedEditor])

    // Re-hide Crisp bubble when the user closes chat on mobile modal routes
    useEffect(() => {
      const pathname = location.pathname
      const isMaxModalRouter = isMaxModalRoute(pathname)

      if (typeof window === 'undefined') return
      const w: any = window as any
      w.$crisp = w.$crisp || []
      const crisp = w.$crisp

      const handleChatClosed = () => {
        if (isMaxModalRouter && isMobileView) {
          crisp.push(['do', 'chat:hide'])
          try {
            const node = getLastCrispBlock()
            if (node) {
              node.style.display = 'none'
              node.style.visibility = 'hidden'
              node.style.opacity = '0'
              node.style.pointerEvents = 'none'
            }
            // Ensure after any internal transitions
            setTimeout(() => {
              const node2 = getLastCrispBlock()
              if (node2) {
                node2.style.display = 'none'
                node2.style.visibility = 'hidden'
                node2.style.opacity = '0'
                node2.style.pointerEvents = 'none'
              }
            }, 200)
          } catch (_) {}
        }
      }

      if (isMaxModalRouter && isMobileView) {
        crisp.push(['on', 'chat:closed', handleChatClosed])
      }

      return () => {
        if (isMaxModalRouter && isMobileView) {
          try {
            crisp.push(['off', 'chat:closed', handleChatClosed])
          } catch (_e) {
            // Silently ignore if off is unavailable
          }
        }
        if (hideObserverRef.current) {
          hideObserverRef.current.disconnect()
          hideObserverRef.current = null
        }
      }
    }, [location.pathname, isMobileView, crispBlockSelector, getLastCrispBlock])

    const updateChatBotPosition = useCallback(() => {
      const chatBotElement = chatBotRef.current
      if (!chatBotElement) return

      const buttonElement = chatBotElement.querySelector('#chat-bot-button') as HTMLElement
      if (!buttonElement) {
        console.warn('ChatBot button not found')
        return
      }

      const crispBlock = getLastCrispBlock()

      // Compact mode on small desktop: place just above Crisp bubble, centered horizontally
      if (isCompactMode) {
        if (!crispBlock || countRef.current > CRISP_POLLING_MAX_TRIES) {
          // If Crisp isn't ready, poll and keep hidden (no fallback shown to avoid wrong position)
          if (timeoutId.current) {
            clearTimeout(timeoutId.current)
          }
          timeoutId.current = setTimeout(() => {
            countRef.current++
            updateChatBotPosition()
          }, CRISP_POLLING_INTERVAL)
          return
        }

        const crispBlockRect = crispBlock.getBoundingClientRect()
        const isShowingCrispBlock = crispBlockRect.width && crispBlockRect.height
        if (!crispBlockRect && !isShowingCrispBlock) {
          if (timeoutId.current) {
            clearTimeout(timeoutId.current)
          }
          timeoutId.current = setTimeout(() => {
            updateChatBotPosition()
          }, CRISP_POLLING_INTERVAL)
          return
        }

        chatBotElement.style.position = 'fixed'
        chatBotElement.style.top = 'auto'
        chatBotElement.style.bottom = isShowingCrispBlock
          ? `${window.innerHeight - crispBlockRect.top + SPACING_FROM_CRISP}px`
          : '80px'
        chatBotElement.style.left = isShowingCrispBlock ? `${crispBlockRect.left + crispBlockRect.width / 2}px` : '36px'
        chatBotElement.style.right = 'auto'
        chatBotElement.style.transform = 'translateX(-50%)'
        buttonElement.style.display = 'flex'
        return
      }

      if (!crispBlock) {
        console.warn('[withChatBot] Crisp block not found', { selector: crispBlockSelector })
        return
      }

      const crispBlockRect = crispBlock.getBoundingClientRect()

      const isShowingCrispBlock = crispBlockRect.width && crispBlockRect.height

      if (!isShowingCrispBlock) {
        console.warn('[withChatBot] Crisp block is not showing yet')

        if (timeoutId.current) {
          clearTimeout(timeoutId.current)
        }

        // Poll until Crisp block is visible
        timeoutId.current = setTimeout(() => {
          updateChatBotPosition()
        }, CRISP_POLLING_INTERVAL)
        return
      }

      chatBotElement.style.position = 'fixed'
      chatBotElement.style.bottom = `${
        window.innerHeight - (crispBlockRect.top + crispBlockRect.height / 2 + CHATBOT_HEIGHT / 2)
      }px`

      const isCrispOnLeft = crispBlockRect.left < window.innerWidth / 2

      if (isCrispOnLeft) {
        chatBotElement.style.left = `${crispBlockRect.right + SPACING_FROM_CRISP}px`
        chatBotElement.style.right = 'auto'
      } else {
        chatBotElement.style.right = `${window.innerWidth - crispBlockRect.left + SPACING_FROM_CRISP}px`
        chatBotElement.style.left = 'auto'
      }

      // Reset transform in non-compact mode
      chatBotElement.style.transform = 'none'

      // Show the button
      buttonElement.style.display = 'flex'
    }, [crispBlockSelector, isCompactMode, getLastCrispBlock])

    useElementObserver(crispBlockSelector, updateChatBotPosition)

    const intervalId = useRef<NodeJS.Timeout | null>(null)
    // Polling mechanism to catch late-loaded Crisp element (especially when default UI is used)
    useEffect(() => {
      let tries = 0
      if (intervalId.current) {
        clearInterval(intervalId.current)
      }

      intervalId.current = setInterval(() => {
        // In compact mode we don't depend on Crisp; position immediately
        if (isCompactMode) {
          updateChatBotPosition()
          if (intervalId.current) {
            clearInterval(intervalId.current)
          }
          return
        }

        if (getLastCrispBlock()) {
          updateChatBotPosition()
          if (intervalId.current) {
            clearInterval(intervalId.current)
          }
        } else if (tries > CRISP_POLLING_MAX_TRIES) {
          if (intervalId.current) {
            clearInterval(intervalId.current)
          }
        }
        tries++
      }, CRISP_POLLING_INTERVAL)

      return () => {
        if (intervalId.current) {
          clearInterval(intervalId.current)
        }

        if (timeoutId.current) {
          clearTimeout(timeoutId.current)
        }
      }
    }, [crispBlockSelector, updateChatBotPosition, isCompactMode, getLastCrispBlock])

    // Ensure immediate positioning when compact mode toggles
    useEffect(() => {
      if (isCompactMode) {
        updateChatBotPosition()
      }
    }, [isCompactMode, updateChatBotPosition])

    // Disable automatic opening of AI chat on first app load
    // Intentionally left without any auto-open logic per requirement
    useEffect(() => {
      // no auto-open
    }, [])

    return (
      <Fragment>
        <Component {...props} />
        {ENABLE_CHATBOT && !isUnifiedEditor ? (
          <Box ref={chatBotRef} zIndex="500">
            {isMaxModalRouter ? null : isCompactMode ? <CompactChatBotButton /> : <ChatBotButton />}
          </Box>
        ) : (
          <Fragment />
        )}
      </Fragment>
    )
  }
}

const ChatBotButton = memo(function ChatBotButton() {
  const { t } = useTranslation()
  const { toggleChatBot } = useChatBot()

  return (
    <div
      id="chat-bot-button"
      className={`${styles.chatBotButton} ${styles.glowRadiate}`}
      onClick={() => toggleChatBot()}
      style={{
        padding: '8px',
        cursor: 'pointer',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontWeight: '550',
        position: 'relative',
        borderRadius: '12px',
        background: 'linear-gradient(323deg, rgba(41, 132, 90, 0.70) -4.04%, #1C6443 91.67%)',
        color: 'white',
        fontSize: '12px',
      }}
    >
      <Icon source={MagicIcon} tone="inherit" />
      <span>{t('ask-elva-ai')}</span>
      <NotificationCount styles={{ minWidth: 18 }} />
    </div>
  )
})

const CompactChatBotButton = memo(function CompactChatBotButton() {
  const { t } = useTranslation()
  const { toggleChatBot } = useChatBot()

  return (
    <Tooltip content={t('ask-elva-ai')} preferredPosition="above" dismissOnMouseOut>
      <div
        id="chat-bot-button"
        className={`${styles.chatBotButton}`}
        onClick={() => toggleChatBot()}
        style={{
          padding: '8px',
          cursor: 'pointer',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0',
          fontWeight: '550',
          position: 'relative',
          borderRadius: '50%',
          width: `${CHATBOT_HEIGHT}px`,
          height: `${CHATBOT_HEIGHT}px`,
          background: 'linear-gradient(323deg, rgba(41, 132, 90, 0.70) -4.04%, #1C6443 91.67%)',
          color: 'white',
          fontSize: '12px',
        }}
      >
        <Icon source={MagicIcon} tone="inherit" />
      </div>
    </Tooltip>
  )
})
