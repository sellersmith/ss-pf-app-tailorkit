export type EventObject = {
  data?: any
  target: any
  type: string
  [key: string]: any
}

export type EventHandlingFunction = (event: EventObject) => void

/**
 * Event handler.
 */
export default class EventHandler {
  /**
   * Listen to an event on an object.
   *
   * @param sourceObject     This argument can be any object.
   * @param eventName        Name of the event.
   * @param callbackFunction Function that will be executed when the event is triggered.
   *
   * @returns void
   */
  static add(sourceObject: any | any[], eventName: string, callbackFunction: EventHandlingFunction): void {
    // If the sourceObject argument is a string, use it as a CSS selector to query for matched DOM nodes.
    let objects = typeof sourceObject === 'string' ? document.querySelectorAll(sourceObject) : sourceObject

    if (!(objects instanceof Array || objects instanceof NodeList)) {
      objects = [objects]
    }

    objects.forEach((e: any) => {
      // If the source object is a DOM node, use the native method to add event handler.
      if (typeof e.addEventListener === 'function') {
        e.addEventListener(eventName, callbackFunction, false)
      } else if (typeof e.attachEvent === 'function') {
        e.attachEvent(eventName, callbackFunction)
      } else {
        // Source object is not a DOM node, store event handler directly to the provided object.
        e.__events__ = e.__events__ || {}
        e.__events__[eventName] = e.__events__[eventName] || []

        if (e.__events__[eventName].indexOf(callbackFunction) < 0) {
          e.__events__[eventName].push(callbackFunction)
        }
      }
    })
  }

  /**
   * Stop listening to an event on an object.
   *
   * @param sourceObject     This argument can be any object.
   * @param eventName        Name of the event.
   * @param callbackFunction Function that was previously registered.
   *
   * @returns void
   */
  static remove(sourceObject: any | any[], eventName: string, callbackFunction: EventHandlingFunction): void {
    // If the sourceObject argument is a string, use it as a CSS selector to query for matched DOM nodes.
    let objects = typeof sourceObject === 'string' ? document.querySelectorAll(sourceObject) : sourceObject

    if (!(objects instanceof Array || objects instanceof NodeList)) {
      objects = [objects]
    }

    objects.forEach((e: any) => {
      // If the source object is a DOM node, use the native method to remove event handler.
      if (typeof e.removeEventListener === 'function') {
        e.removeEventListener(eventName, callbackFunction, false)
      } else if (typeof e.detachEvent === 'function') {
        e.detachEvent(eventName, callbackFunction)
      } else {
        // Source object is not a DOM node, remove event handler previously stored in the provided object.
        if (e.__events__?.[eventName]) {
          const index = e.__events__[eventName].indexOf(callbackFunction)

          if (index > -1) {
            e.__events__[eventName].splice(index, 1)
          }
        }
      }
    })
  }

  /**
   * Trigger an event on an object.
   *
   * @param sourceObject This argument can be any object.
   * @param eventName    Name of the event.
   * @param eventData    Event data.
   *
   * @returns void
   */
  static trigger(sourceObject: any | any[], eventName: string, eventData: any = {}): void {
    // If the sourceObject argument is a string, use it as a CSS selector to query for matched DOM nodes.
    let objects = typeof sourceObject === 'string' ? document.querySelectorAll(sourceObject) : sourceObject

    if (!(objects instanceof Array || objects instanceof NodeList)) {
      objects = [objects]
    }

    objects.forEach((e: any) => {
      let event: EventObject

      // Create an event object.
      if (typeof e.dispatchEvent === 'function') {
        event = new window.Event(eventName)
      } else if (typeof e.fireEvent === 'function') {
        event = (document as any).createEventObject()
      } else {
        event = { target: e, type: eventName }
      }

      // Store the provided event data to event object.
      if (eventData) {
        event.data = eventData
      }

      // Trigger the specified event.
      if (typeof e.dispatchEvent === 'function') {
        e.dispatchEvent(event)
      } else if (typeof e.fireEvent === 'function') {
        e.fireEvent(`on${eventName}`, event)
      } else if (e.__events__?.[eventName]) {
        e.__events__[eventName].forEach((fn: EventHandlingFunction) => typeof fn === 'function' && fn(event))
      }
    })
  }

  static hasListener(sourceObject: any | any[], eventName: string) {
    // If the sourceObject argument is a string, use it as a CSS selector to query for matched DOM nodes.
    let objects = typeof sourceObject === 'string' ? document.querySelectorAll(sourceObject) : sourceObject

    if (!(objects instanceof Array || objects instanceof NodeList)) {
      objects = [objects]
    }

    return objects.some((e: any) => {
      return e.__events__?.[eventName]
    })
  }
}
