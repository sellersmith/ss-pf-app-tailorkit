// Step 1: Define the extended interface
interface EventListenerRecord {
  type: string
  listener: EventListenerOrEventListenerObject
  options?: boolean | AddEventListenerOptions
}

interface ExtendedEventTarget extends EventTarget {
  _eventListeners?: EventListenerRecord[]
  removeAllEventListeners: () => void
}

// Step 2: Extend the EventTarget prototype to add your new method
;(function () {
  const _addEventListener = EventTarget.prototype.addEventListener
  const _removeEventListener = EventTarget.prototype.removeEventListener

  // Override the addEventListener method to track added listeners.
  // Tracking is wrapped in try/catch because this prototype patch runs for EVERY EventTarget on the
  // page (including Shopify perf-kit internals whose `this` may be a frozen/proxy object that rejects
  // the `_eventListeners` property). A failed track must never break the underlying addEventListener.
  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    try {
      const self = this as ExtendedEventTarget
      if (self) {
        if (!self._eventListeners) self._eventListeners = []
        self._eventListeners.push({ type, listener, options })
      }
    } catch {
      // EventTarget does not allow attaching tracking state; skip tracking, still bind the listener.
    }

    _addEventListener.call(this, type, listener, options)
  }

  // Safely add the removeAllEventListeners method to the prototype
  ;(EventTarget.prototype as ExtendedEventTarget).removeAllEventListeners = function () {
    const self = this as ExtendedEventTarget
    if (self._eventListeners) {
      for (const { type, listener, options } of self._eventListeners) {
        _removeEventListener.call(this, type, listener, options)
      }
      self._eventListeners = []
    }
  }
})()
