import type { ComponentClass, FunctionComponent } from 'react'
import Feedback from '~/modules/Feedback'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { useEffect, useRef, useState } from 'react'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { authenticatedFetch } from '~/shopify/fns.client'
import { Box, InlineStack, BlockStack } from '@shopify/polaris'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons'
import { useStore } from '~/libs/external-store'
import { forceUpdateStore } from '~/stores/forceUpdate'
import { FORCE_UPDATE_ID } from '~/constants/force-update'
import withChatBot from './withChatBot'
import { useNavigation } from '@remix-run/react'
import { sleep } from '~/utils/sleep'
import { ENABLE_CUSTOM_CRISP_CHAT } from '~/constants/crisp-chat'
import { useIsUnifiedEditor } from '~/hooks/useIsUnifiedEditor'
import { Crisp } from 'crisp-sdk-web'

const GAP_ELEMENT = 200
const CRISP_CHAT_ICON_WIDTH = 52
const CRISP_CHAT_ICON_WIDTH_COLLAPSED = 20
const DEFAULT_RIGHT_POSITION_CRISP_CHAT = 14
const ICON_COLLAPSE_SIZE = 24

function setVisibility(element: HTMLElement, visibility: string, cssText: string = '') {
  element.style.cssText += `visibility: ${visibility} !important; ${cssText}`
}

function checkIsSpecialSpan(span: HTMLElement) {
  const isNewMessageWrapper = span.querySelector('span[data-id="new_messages"]')
  const isGeneralEnticeWrapper = span.querySelector('span[data-id="general_entice"]')
  const isNewMessageChild = span.closest('span[data-id="new_messages"]')
  const isGeneralEnticeChild = span.closest('span[data-id="general_entice"]')
  const isSpecialSpan = isNewMessageWrapper || isGeneralEnticeWrapper || isNewMessageChild || isGeneralEnticeChild

  return isSpecialSpan
}

export function findCrispElementAndHidden() {
  if (!ENABLE_CUSTOM_CRISP_CHAT) {
    return null
  }

  const bubble = document.querySelector('#crisp-chatbox > div > a') as HTMLElement

  if (bubble) {
    setVisibility(bubble, 'hidden')

    // Style span elements within the bubble
    const spansElement = bubble.querySelectorAll('span')
    spansElement?.forEach(span => {
      const isSpecialSpan = checkIsSpecialSpan(span)
      if (!isSpecialSpan) {
        setVisibility(span, 'hidden')
      }
    })
  }
  return bubble
}

export default function withCrispChat(Component: FunctionComponent | ComponentClass) {
  return withChatBot(function WithCrispChat(props: any) {
    const { t } = props
    const navigation = useNavigation()
    const ref = useRef<HTMLElement>(null)
    const { initCrisp } = useLiveChat()
    const messageCrispChatState = useStore(forceUpdateStore, state => state[FORCE_UPDATE_ID.NEW_MESSAGE_CRISP_CHAT])
    const newMessageCrispChat = messageCrispChatState?.state?.message
    const isUnifiedEditor = useIsUnifiedEditor()

    // Only enable moveable in modal editor
    const [availability, setAvailability] = useState<string | undefined>(undefined)
    const timerRef = useRef<number>(0)

    // Control collapsed/expanded state of the chat interface
    const [isCollapsed, setIsCollapsed] = useState<boolean>(true)
    const toggleCollapsed = () => {
      setIsCollapsed(!isCollapsed)
    }

    /**
     * Initialize Crisp Chat and set up online status polling
     */
    useEffect(() => {
      initCrisp()
      ;(async () => {
        let crispElement = null

        // Periodically check for online status
        while (timerRef.current < 100 && crispElement === null) {
          timerRef.current++

          // Query the Crisp HTML element
          crispElement = document.getElementById('crisp-chatbox')

          if (!crispElement) {
            await sleep(500)

            continue
          }

          // Hide Crisp chat bubble in unified editor
          if (isUnifiedEditor) {
            try {
              // const w: any = window as any
              // w.$crisp = w.$crisp || []
              // w.$crisp.push(['do', 'chat:hide'])
              if (typeof Crisp !== 'undefined' && Crisp.chat) {
                Crisp.chat.hide()
              }
            } catch (_) {}
            // return
          }

          setAvailability(crispElement.getAttribute('data-availability') as string)
        }
      })()
    }, [initCrisp, isUnifiedEditor])

    /**
     * Manages the positioning and styling of the chat interface
     * This effect handles:
     * - Dynamic positioning of the feedback box relative to the Crisp bubble
     * - Responsive resizing and repositioning on window resize
     * - Styling of the Crisp bubble based on collapsed/expanded state
     */
    useEffect(() => {
      if (!ENABLE_CUSTOM_CRISP_CHAT || isUnifiedEditor) {
        return
      }

      let timer: any = null

      function updatePosition(e?: Event) {
        const boxRef = ref.current

        if (!boxRef) return

        // Only update position when crisp is online to prevent layout shift
        if (!availability || navigation.state !== 'idle') {
          boxRef.style.display = 'none'
          return
        }

        boxRef.style.display = 'block'

        // Delay the execution a little bit to wait for the Crisp bubble to be repositioned if the viewport is resized
        if (e) {
          if (timer) {
            clearTimeout(timer)
          }

          return (timer = setTimeout(updatePosition, 100))
        }

        // Wait for Crisp bubble to be available
        if (!boxRef) {
          return (timer = setTimeout(updatePosition, 500))
        }

        // Get the Crisp bubble
        const bubble = document.querySelector('#crisp-chatbox > div > a') as HTMLElement

        if (!bubble) {
          return (timer = setTimeout(updatePosition, 500))
        }

        setVisibility(bubble, 'visible')
        // Apply custom styles to Crisp bubble
        bubble.classList.add('crisp-custom-bubble')

        if (isCollapsed) {
          bubble.classList.add('crisp-custom-bubble--collapsed')

          // Using cssText to set the right property because it's the only way to override the Crisp bubble's default right property
          setVisibility(bubble, 'visible', `right: ${DEFAULT_RIGHT_POSITION_CRISP_CHAT}px !important;`)
        } else {
          bubble.classList.remove('crisp-custom-bubble--collapsed')

          // Using cssText to set the right property because it's the only way to override the Crisp bubble's default right property
          setVisibility(bubble, 'visible', `right: ${DEFAULT_RIGHT_POSITION_CRISP_CHAT}px !important;`)
        }

        // Style span elements within the bubble
        const spansElement = bubble.querySelectorAll('span')
        spansElement?.forEach(span => {
          const isSpecialSpan = checkIsSpecialSpan(span)

          if (!isSpecialSpan) {
            setVisibility(span, 'visible')
            span.classList.add('crisp-custom-span')

            if (isCollapsed) {
              span.classList.add('crisp-custom-span--collapsed')
            } else {
              span.classList.remove('crisp-custom-span--collapsed')
            }
          }
        })

        // Calculate and set position of feedback box
        const rect = bubble.getBoundingClientRect()
        const diff = (boxRef.offsetHeight - rect.height) / 2

        if (rect.top - diff < 0) {
          return (timer = setTimeout(updatePosition, 500))
        }

        // Spacing of Polaris have been formulas: 4px = 100, so there is a need to calculate the right property based on the gap
        if (isCollapsed) {
          boxRef.style.top = `${rect.top - diff}px`
          boxRef.style.left = `${rect.left - 122 + CRISP_CHAT_ICON_WIDTH_COLLAPSED}px`
        } else {
          boxRef.style.top = `${rect.top - diff}px`
          boxRef.style.left = `${rect.left - 225 + CRISP_CHAT_ICON_WIDTH}px`
        }

        boxRef.style.right = `${DEFAULT_RIGHT_POSITION_CRISP_CHAT}px`
        setVisibility(
          bubble,
          'visible',
          `right: ${DEFAULT_RIGHT_POSITION_CRISP_CHAT + (GAP_ELEMENT / 100) * 4 + ICON_COLLAPSE_SIZE}px !important;`
        )
      }

      // Update position of the feedback box
      updatePosition()

      // Listen to window resize event to reposition the feedback box
      window.addEventListener('resize', updatePosition)

      return () => {
        window.removeEventListener('resize', updatePosition)

        if (timer) {
          clearTimeout(timer)
        }
      }
    }, [isCollapsed, availability, navigation.state, newMessageCrispChat, isUnifiedEditor])

    return (
      <>
        <Component {...props} />
        {ENABLE_CUSTOM_CRISP_CHAT && !isUnifiedEditor && (
          <Box
            ref={ref}
            shadow="400"
            zIndex="500"
            padding="150"
            background="bg-inverse"
            position="fixed"
            borderWidth="0165"
            borderRadius="400"
            borderColor="border-tertiary"
            visuallyHidden={availability === undefined}
          >
            <div onClick={toggleCollapsed} className="crisp-chat-wrapper">
              <InlineStack gap={`${GAP_ELEMENT}`} wrap={false}>
                {isCollapsed && <p className="crisp-chat-status-text">{t('contact')}</p>}
                <div
                  className={`crisp-chat-content ${isCollapsed ? 'crisp-chat-content--collapsed' : 'crisp-chat-content--expanded'}`}
                >
                  <div style={{ display: isCollapsed ? 'none' : 'block' }}>
                    <BlockStack gap="200">
                      <InlineStack gap="100" wrap={false}>
                        <span
                          className="crisp-chat-status-icon"
                          style={{
                            backgroundColor: availability ? '#45b931' : '#b5b5b5',
                          }}
                        ></span>
                        <p className="crisp-chat-status-text">
                          {availability ? t('support-is-online') : t('support-is-offline')}
                        </p>
                      </InlineStack>
                      <div
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                      >
                        <Feedback
                          t={t}
                          dataSource={`/api/feedback?formType=${FEEDBACK_TYPE.GIVE_US_YOUR_FEEDBACK}`}
                          fetchFunction={authenticatedFetch}
                          onError={() => showGenericErrorToast()}
                          displayAs={'modal'}
                        />
                      </div>
                    </BlockStack>
                  </div>
                </div>

                <div id={isCollapsed ? 'icon-chat-will-show-here' : 'icon-chat-will-show-here--expanded'}></div>

                <span
                  className={`Polaris-Icon crisp-chat-icon ${isCollapsed ? 'crisp-chat-icon--collapsed' : 'crisp-chat-icon--expanded'}`}
                >
                  {isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                </span>
              </InlineStack>
            </div>
          </Box>
        )}
      </>
    )
  })
}
