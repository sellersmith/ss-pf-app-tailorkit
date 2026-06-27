import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'

/**
 * Idle Time Tracking Module.
 */
export default class IdleTimeTracker {
  contextThresholds: Record<string, number>
  currentContext: string | null
  initialContext: string | null // Store initial context to prevent route detection override

  isIdle: boolean
  idleTime: number
  cooldownPeriod: number

  eventTriggered: boolean
  lastTriggerTime: number

  idleInterval: NodeJS.Timeout | null = null

  constructor(initialContext: string) {
    // Define fixed threshold values directly in code
    this.contextThresholds = {
      default: 180000, // 3 minutes
    }

    this.initialContext = initialContext || 'default'
    this.currentContext = this.initialContext
    this.cooldownPeriod = 7200000 // 2 hours cooldown between triggers

    this.idleTime = 0
    this.isIdle = false

    this.eventTriggered = false
    this.lastTriggerTime = 0

    this.resetTimer = this.resetTimer.bind(this)
    this.checkIdle = this.checkIdle.bind(this)

    this.initialize()
  }

  events = ['click', 'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']

  initialize() {
    // Set up event listeners for user activity
    this.events.forEach(event => {
      document.addEventListener(event, this.resetTimer, true)
    })

    // Start the idle timer check
    this.idleInterval = setInterval(this.checkIdle, 1000)

    // Track page changes to update context
    this.setupRouteChangeDetection()

    // Listen to event to change context threshold
    // Note: This can override the initial context if needed (for dynamic context changes)
    Transmitter.listen('idle-time-context-change', (eventData: { data?: { context: string; threshold: number } }) => {
      if (eventData.data) {
        this.setContext(eventData.data.context)
        this.contextThresholds[eventData.data.context] = eventData.data.threshold
      }
    })
  }

  setupRouteChangeDetection() {
    // This implementation depends on the router being used
    if (window.history && window.history.pushState) {
      const originalPushState = window.history.pushState

      window.history.pushState = (...args) => {
        const result = originalPushState.apply(window.history, args)

        this.handleRouteChange()

        return result
      }

      window.addEventListener('popstate', this.handleRouteChange.bind(this))
    }
  }

  handleRouteChange() {
    // Only auto-detect context from route if initial context was 'default'
    // This prevents route detection from overriding explicitly set contexts (e.g., 'integrations')
    // When a specific context is passed via HOC (like 'integrations'), it will never be overridden
    if (this.initialContext === 'default') {
      const path = window.location.pathname
      const newContext = path.match(/^\/([^\/]+)\/*/)?.[1] || 'default'

      this.setContext(newContext)
    }
    // If initialContext is not 'default' (e.g., 'integrations'), do nothing - keep the original context
  }

  resetTimer() {
    this.idleTime = 0

    if (this.isIdle) {
      this.isIdle = false
      this.eventTriggered = false
    }
  }

  checkIdle() {
    if (this.currentContext) {
      this.idleTime += 1000

      // Get current threshold based on context
      const currentThreshold
        = (this.contextThresholds[this.currentContext] || this.contextThresholds.default || 60000)
        / (window.testIdleTracker ? 10 : 1)

      if (this.idleTime >= currentThreshold && !this.isIdle) {
        this.isIdle = true
        this.triggerIdleEvent()
      }
    }
  }

  setContext(newContext: string | null) {
    if (this.currentContext !== newContext) {
      this.currentContext = newContext

      this.resetTimer()
    }
  }

  triggerIdleEvent() {
    if (this.currentContext) {
      // Check cooldown period
      const now = Date.now()
      const lastTrigger = Number(localStorage?.getItem('idle-time-last-trigger') || this.lastTriggerTime)
      const cooldownPeriod = this.cooldownPeriod / (window.testIdleTracker ? 10 : 1)
      const timeSinceLastTrigger = now - lastTrigger

      if (timeSinceLastTrigger < cooldownPeriod) {
        return
      }

      // Update flags
      this.eventTriggered = true
      this.lastTriggerTime = now

      localStorage?.setItem('idle-time-last-trigger', now.toString())

      // Trigger idle event
      Transmitter.trigger('idle-time-occurred', { context: this.currentContext })
    }
  }

  destroy() {
    // Remove event listeners
    this.events.forEach(event => {
      document.removeEventListener(event, this.resetTimer, true)
    })

    this.idleInterval && clearInterval(this.idleInterval)
  }
}
