import type { EPubSubEvents } from '../constants'

const subscribers: any = {}

/**
 * @author Harry
 * Subscribe a callback to an event
 * @returns unsubscribe()
 * @param eventName EPubSubEvents
 * @param callback Function
 */

export function subscribe(eventName: EPubSubEvents, callback: Function) {
  if (subscribers[eventName] === undefined) {
    subscribers[eventName] = []
  }

  subscribers[eventName] = [...subscribers[eventName], callback]

  return function unsubscribe() {
    subscribers[eventName] = subscribers[eventName].filter((cb: Function) => {
      return cb !== callback
    })
  }
}

/**
 * @author Harry
 * Execute all callbacks that subscribed to an event
 * @param eventName EPubSubEvents
 * @param data Data passed to the subscribed callback
 */

export function publish(eventName: EPubSubEvents, data?: any) {
  if (subscribers[eventName]) {
    subscribers[eventName].forEach((callback: (arg0: any) => void) => {
      callback(data)
    })
  }
}
