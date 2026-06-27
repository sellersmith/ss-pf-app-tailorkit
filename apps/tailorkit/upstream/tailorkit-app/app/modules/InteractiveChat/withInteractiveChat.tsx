import type { ComponentClass, FunctionComponent } from 'react'
import RewardCoupon from '../RewardCoupon'
import { useLayoutEffect, useMemo } from 'react'
import { useRootLoaderData } from '~/root'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import isString from 'lodash/isString'
import isBoolean from 'lodash/isBoolean'
import isNumber from 'lodash/isNumber'
import isFunction from 'lodash/isFunction'

interface FollowUpQuestion {
  id?: string
  text: string
  parentId?: string
  action?: string | (() => void)
  triggerValue?: string | string[]
  choices?: {
    value: string
    label: string
    selected: boolean
  }[]
  // Condition to display the message
  scenarioId?: string
  startOn?: string
  endOn?: string
  displayOn?: string[]
  dependOnShopProperty?: string
  dependOnShopPropertyValue?: any
  dependOnTriggeredEvents?: string[]
  displayAfterSeconds?: any
  displayAgainAfterDays?: any
  crispSegment?: string
  coupon?: string
  couponLifetimeMonths?: number
}

let dataSource: string
let couponIssuer: string
let followUpQuestions: FollowUpQuestion[]
let resumeScenario: null | FollowUpQuestion
let initialMessage: null | FollowUpQuestion

let shopProperties: any
let listenedEvent: boolean = false
let initTimer: NodeJS.Timeout | null = null
let sendingTimer: NodeJS.Timeout | null = null
let currentQuestion: FollowUpQuestion | null = null

export function withInteractiveChat(Component: FunctionComponent<any> | ComponentClass<any>) {
  return function WithInteractiveChat(props: any) {
    const { shopData = {} } = useRootLoaderData() || {}
    const occurredEvents = useMemo(
      () => shopData.appConfig?.occurredEvents || {},
      [shopData?.appConfig?.occurredEvents]
    )
    const usages = useMemo(() => shopData.usages || {}, [shopData.usages])

    const data = useMemo(
      () => ({
        ...occurredEvents,
        ...usages,
        created_template_but_not_publish: usages.firstTemplateCreatedAt && !usages.firstIntegrationPublishedAt,
      }),
      [occurredEvents, usages]
    )

    useLayoutEffect(() => {
      initCrispInteractiveChat('/api/user-testing', data, '/api/reward-coupon')
    }, [data])

    return (
      <>
        <Component {...props} />
        <RewardCoupon />
      </>
    )
  }
}

function initCrispInteractiveChat(source: string, properties?: any, couponIssuerEndpoint?: string) {
  if (initTimer) {
    clearTimeout(initTimer)
  }

  initTimer = setTimeout(async () => {
    // Clean up the data
    initialMessage = null
    resumeScenario = null
    followUpQuestions = []

    // Request data source
    const res: any = await authenticatedFetch(source)

    const questions = (res?.data instanceof Array ? res.data : res instanceof Array ? res : []).map((question: any) => {
      if (question.messageId) {
        question.id = question.messageId
      }

      if (question.choices) {
        question.choices = question.choices
          .split(/\n+/)
          .filter((choice: string) => choice.trim().length)
          .map((choice: string) => {
            const [value, label] = choice.trim().split('|')

            return {
              label,
              value,
              selected: false,
            }
          })
      }

      if (question.triggerValue) {
        question.triggerValue = question.triggerValue
          .split(/(,|\n)+/)
          .filter((value: string) => value.trim().length)
          .map((value: string) => value.trim())
      }

      if (question.displayOn) {
        question.displayOn = question.displayOn.split(/(,|\n)+/).filter((value: string) => value.trim().length)
      }

      if (question.dependOnTriggeredEvents) {
        question.dependOnTriggeredEvents = question.dependOnTriggeredEvents
          .split(/(,|\n)+/)
          .filter((value: string) => value.trim().length)
          .map((value: string) => value.trim())
      }

      return question
    })

    if (!questions?.length) {
      console.error('Failed to request data source', res)
      return
    }

    // Group questions by scenario
    const scenarios: any = {}
    let lastScenarioId: string | null = null

    questions.forEach((question: any) => {
      const scenarioId = question.scenarioId || lastScenarioId

      if (scenarioId) {
        scenarios[scenarioId] = scenarios[scenarioId] || []
        scenarios[scenarioId].push(question)
        lastScenarioId = scenarioId
      }
    })

    // Get the first active scenario
    for (const scenarioId in scenarios) {
      if (scenarios[scenarioId].length > 0) {
        const trigger = scenarios[scenarioId].shift()

        // Check scenario lifetime
        const now = new Date().toISOString()

        if (trigger.startOn && trigger.startOn > now) {
          console.log(`Scenario ${scenarioId} is not started yet`, {
            startOn: trigger.startOn,
            now,
          })

          continue
        }

        if (trigger.endOn && trigger.endOn < now) {
          continue
        }

        // Check if we should resume the scenario
        const completed = localStorage.getItem(`interactive-chat-completed-${trigger.id}`)
        const lastStarted = properties?.last_started_interactive_chat
        const lastCompleted = properties?.last_completed_interactive_chat
        if (!completed && lastStarted === scenarioId && lastCompleted !== scenarioId) {
          initialMessage = null
          resumeScenario = trigger
          followUpQuestions = scenarios[scenarioId]

          break
        }

        // Check display condition
        const { displayOn } = trigger

        if (displayOn && !displayOn.find((path: string) => window.location.pathname.startsWith(path))) {
          console.log(`Scenario ${scenarioId} is not displayed on the current page`, {
            displayOn,
            pathname: window.location.pathname,
          })

          continue
        }

        if (trigger.dependOnShopProperty && trigger.dependOnShopPropertyValue) {
          const shopProperty = properties?.[trigger.dependOnShopProperty]

          let requiredValue = trigger.dependOnShopPropertyValue

          if (!isBoolean(requiredValue) && isString(requiredValue)) {
            const lowerCased = requiredValue.toLowerCase()

            if (['true', 'false'].includes(lowerCased)) {
              requiredValue = requiredValue === 'true' ? true : false
            }
          }

          const regex = /^(>=|<=|<|=|>)?\s*(.*)$/

          const [, operator, value] = (isString(requiredValue) && requiredValue.match(regex)) || [
            null,
            '=',
            requiredValue,
          ]

          // Check required values
          let passed = false
          requiredValue = isString(value) && value.match(/^\d+$/) ? parseInt(value) : value

          switch (operator) {
            case '<': {
              if (shopProperty < requiredValue) {
                passed = true
              }

              break
            }

            case '<=': {
              if (shopProperty <= requiredValue) {
                passed = true
              }

              break
            }

            case '>': {
              if (shopProperty > requiredValue) {
                passed = true
              }

              break
            }

            case '>=': {
              if (shopProperty >= requiredValue) {
                passed = true
              }

              break
            }

            case '=':
            case '==':
            case '===':
            default: {
              if (shopProperty === requiredValue) {
                passed = true
              }

              break
            }
          }

          if (!passed) {
            console.log(`Scenario ${scenarioId} is not displayed because of the shop property`, {
              shopProperty,
              requiredValue,
            })

            continue
          }
        }

        // Check if the scenario has been started before
        const started = localStorage.getItem(`interactive-chat-started-${trigger.id}`)

        const parseDays = (value: any): number => {
          if (isNumber(value)) return value
          if (isString(value) && /^\d+$/.test(value)) return Number(value)
          return 0
        }

        const retryAfter = parseDays(trigger.displayAgainAfterDays) * ONE_DAY_IN_MILLISECONDS

        if (completed || (started && (!retryAfter || new Date(started).getTime() + retryAfter > Date.now()))) {
          console.log(`Scenario ${scenarioId} is not displayed because it has already been started before`, {
            [`interactive-chat-started-${trigger.id}`]: started,
            [`interactive-chat-completed-${trigger.id}`]: completed,
          })

          continue
        }

        // Found the first active scenario
        resumeScenario = null
        initialMessage = trigger
        followUpQuestions = scenarios[scenarioId]

        break
      }
    }

    if (!initialMessage && !resumeScenario) {
      console.log('No active scenario found')
      return
    }

    // Save data source and coupon issuer for later use
    dataSource = source
    shopProperties = properties

    if (couponIssuerEndpoint) {
      couponIssuer = couponIssuerEndpoint
    }

    // Resume scenario
    if (resumeScenario) {
      console.log(`Resume scenario ${resumeScenario.id}`)

      setupCrispEventListener()

      return resumeScenario?.id
    }

    // Start scenario
    if (initialMessage) {
      const { id, displayAfterSeconds, dependOnTriggeredEvents } = initialMessage

      if (dependOnTriggeredEvents?.length) {
        dependOnTriggeredEvents.forEach((eventName: string) => {
          Transmitter.listen(eventName, startScenario)
        })

        return
      }

      console.log(`Scenario ${initialMessage.id} will be shown after ${displayAfterSeconds || 0} seconds`)

      setTimeout(startScenario, Number(displayAfterSeconds || 0) * 1000)

      return id
    }
  }, 1000)
}

function startScenario() {
  if (initialMessage) {
    // Check if the chat is already opened
    if (window.$crisp?.is?.('chat:opened')) {
      console.log(`Scenario ${initialMessage.id} is not shown because the chat is already opened`)

      return
    }

    const { displayOn } = initialMessage
    const pathname = window.location.pathname

    // Check if the scenario is displayed on the current page
    if (displayOn && !displayOn?.find((path: string) => pathname.startsWith(path))) {
      console.log(`Scenario ${initialMessage.id} is not shown because the user is navigated to a different page`)

      return
    }

    // Open Crisp chatbot and send initial question
    stopListeningToCrispEvent()
    showCrispMessage(initialMessage)

    // Store the time when the scenario is started
    localStorage.setItem(`interactive-chat-started-${initialMessage.id}`, new Date().toISOString())

    // Update app config to state that the user has started an interactive chat
    authenticatedFetch('/api/preferences', {
      method: 'POST',
      body: JSON.stringify({
        action: 'UPDATE_OCCURRED_EVENT',
        eventName: 'last_started_interactive_chat',
        value: initialMessage.scenarioId,
      }),
    }).catch(console.error)

    // Update shop properties
    if (shopProperties) {
      shopProperties.last_started_interactive_chat = (initialMessage || resumeScenario)?.scenarioId
    }

    if (shopProperties?.last_completed_interactive_chat === initialMessage.scenarioId) {
      if (shopProperties) {
        shopProperties.last_completed_interactive_chat = null
      }

      // Clear the last completed interactive chat
      authenticatedFetch('/api/preferences', {
        method: 'POST',
        body: JSON.stringify({
          action: 'UPDATE_OCCURRED_EVENT',
          eventName: 'last_completed_interactive_chat',
          value: null,
        }),
      }).catch(console.error)
    }
  }
}

function showCrispMessage(message: FollowUpQuestion) {
  currentQuestion = message

  if (sendingTimer) {
    clearTimeout(sendingTimer)
  }

  if (!window.$crisp) {
    console.error('Crisp is not available')
    return
  }

  sendingTimer = setTimeout(() => {
    window.$crisp?.push?.(['do', 'chat:open'])

    if (message.choices && message.choices.length > 0) {
      window.$crisp?.push?.(['do', 'message:show', ['picker', message]])
    } else if (message.text) {
      window.$crisp?.push?.(['do', 'message:show', ['text', message.text]])
    }

    // Listen to Crisp event
    if (followUpQuestions) {
      setupCrispEventListener()
    }

    // Execute action if available
    if (message.action) {
      if (isFunction(message.action)) {
        message.action()
      } else if (isString(message.action) && message.action.match(/^https?:/)) {
        window.open(message.action, '_blank')
      }
    }
  }, 1000)
}

function setupCrispEventListener() {
  if (!window.$crisp) {
    console.error('Crisp is not available')
    return
  }

  if (!listenedEvent) {
    listenedEvent = true

    window.$crisp?.push?.(['on', 'message:sent', handleCrispUserResponse])
    window.$crisp?.push?.(['on', 'message:received', handleCrispUserResponse])
  }
}

function handleCrispUserResponse(data: any) {
  const getSelectedChoice = (): string | undefined => {
    if (data.type === 'picker') {
      return data.content.choices?.find((choice: any) => choice.selected)?.value
    }
    if (data.type === 'text' && data.from !== 'operator' && data.origin !== 'local') {
      return data.content
    }
    return undefined
  }

  const selectedChoice = getSelectedChoice()

  // If resuming a scenario previously started, try to find the current question
  if (data.type === 'picker' && selectedChoice && !currentQuestion && resumeScenario) {
    const _currentQuestion = [resumeScenario, ...followUpQuestions].find(question => question.id === data.content.id)

    if (_currentQuestion) {
      currentQuestion = _currentQuestion
    } else {
      completeScenario()
    }
  }

  if (!currentQuestion?.choices && data.type === 'picker') {
    return
  }

  const isValidPickerResponse = (): boolean => {
    if (!currentQuestion?.choices) return true
    if (data.type !== 'picker') return false
    if (currentQuestion.id !== data.content.id) return false
    return currentQuestion.choices.some((choice: any) => choice.value === selectedChoice)
  }

  if (!isValidPickerResponse()) {
    return
  }

  if (currentQuestion && selectedChoice) {
    postResponseToServer(selectedChoice, currentQuestion)
  }

  // Find next follow-up question
  const matchesTriggerValue = (question: any): boolean => {
    if (!currentQuestion?.choices) return true
    if (!selectedChoice) return false

    const triggerValues = Array.isArray(question.triggerValue) ? question.triggerValue : [question.triggerValue]

    return triggerValues.includes(selectedChoice)
  }

  const nextQuestion = followUpQuestions.find(
    question => question.parentId === currentQuestion?.id && matchesTriggerValue(question)
  )

  if (nextQuestion) {
    if (currentQuestion?.crispSegment) {
      try {
        // Add the user to appropriate segment on Crisp
        window.$crisp?.push?.(['set', 'session:segments', [[currentQuestion.crispSegment]]])

        // Reward the user for giving feedback
        if (currentQuestion.coupon && couponIssuer) {
          authenticatedFetch(couponIssuer, {
            method: 'POST',
            body: JSON.stringify({
              actionCompleted: currentQuestion.crispSegment,
              promotionId: (initialMessage || resumeScenario)?.scenarioId,
              coupon: currentQuestion.coupon,
              couponLifetimeMonths: currentQuestion.couponLifetimeMonths,
            }),
          })
            .then(res => {
              if (res.success) {
                Transmitter.trigger('reward-coupon', res.data)
              }
            })
            .catch(console.error)
        }
      } catch (e) {
        console.error(e)
      }
    }

    showCrispMessage(nextQuestion)
  } else if (selectedChoice) {
    completeScenario()
  }
}

function completeScenario() {
  const { dependOnTriggeredEvents } = (initialMessage || resumeScenario) as FollowUpQuestion

  // Stop listening to Crisp event because all questions have been answered
  stopListeningToCrispEvent()

  // Stop listening to triggered events
  if (dependOnTriggeredEvents?.length) {
    dependOnTriggeredEvents.forEach((eventName: string) => {
      Transmitter.remove(eventName, startScenario)
    })
  }

  // Store the time when the scenario is completed
  localStorage.setItem(`interactive-chat-completed-${(initialMessage || resumeScenario)?.id}`, new Date().toISOString())

  // Update app config to state that the user has completed an interactive chat
  authenticatedFetch('/api/preferences', {
    method: 'POST',
    body: JSON.stringify({
      action: 'UPDATE_OCCURRED_EVENT',
      eventName: 'last_completed_interactive_chat',
      value: (initialMessage || resumeScenario)?.scenarioId,
    }),
  }).catch(console.error)

  // Update shop properties
  if (shopProperties) {
    shopProperties.last_completed_interactive_chat = (initialMessage || resumeScenario)?.scenarioId
  }
}

async function postResponseToServer(choice: string, source: any) {
  const payload = {
    Timestamp: new Date().toISOString(),
    'Scenario ID': (initialMessage || resumeScenario)?.scenarioId,
    'Session ID': window.$crisp.get('session:identifier'),
    'User Name': window.$crisp.get('user:nickname'),
    'User Email': window.$crisp.get('user:email'),
    [(source?.id || source?.text.split(/\n+/).pop()) as string]: choice,
  }

  await authenticatedFetch(dataSource, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

function stopListeningToCrispEvent() {
  listenedEvent = false

  window.$crisp?.push?.(['off', 'message:sent', handleCrispUserResponse])
  window.$crisp?.push?.(['off', 'message:received'])
}
