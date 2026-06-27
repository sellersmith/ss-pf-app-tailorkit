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

  // Override the addEventListener method to track added listeners
  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    const self = this as ExtendedEventTarget
    if (!self._eventListeners) self._eventListeners = []
    self._eventListeners.push({ type, listener, options })

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
