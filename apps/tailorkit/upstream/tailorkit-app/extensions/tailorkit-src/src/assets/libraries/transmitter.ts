import EventHandler, { type EventObject } from './event-handler'

/**
 * Event types that must never be scoped to a specific instance.
 * These events are global analytics signals dispatched to all listeners.
 */
export const GLOBAL_EVENTS: Set<string> = new Set(['tailorkit-storefront-usage'])

/**
 * Returns a scoped event type string for per-instance event isolation.
 *
 * - When instanceId is 'default' (single-instance pages), the event type is
 *   returned unchanged for full backward compatibility.
 * - For named instances, the instanceId is appended as `eventType::instanceId`
 *   so that listeners scoped to one personalizer don't fire for another.
 * - Events in GLOBAL_EVENTS are never scoped regardless of instanceId.
 *
 * @example
 * scopedEventType('default', 'tailorkit-set-options') // → 'tailorkit-set-options'
 * scopedEventType('123::modal', 'tailorkit-set-options') // → 'tailorkit-set-options::123::modal'
 * scopedEventType('123::modal', 'tailorkit-storefront-usage') // → 'tailorkit-storefront-usage'
 */
export function scopedEventType(instanceId: string, eventType: string): string {
  if (instanceId === 'default' || GLOBAL_EVENTS.has(eventType)) {
    return eventType
  }
  return `${eventType}::${instanceId}`
}

export class Transmitter {
  static listen(eventType: string, callback: (eventObject: EventObject) => void) {
    EventHandler.add(document, eventType, callback)
  }

  static remove(eventType: string, callback: (eventObject: EventObject) => void) {
    EventHandler.remove(document, eventType, callback)
  }

  static trigger(eventType: string, eventData?: any) {
    EventHandler.trigger(document, eventType, eventData)
  }

  static hasListener(eventType: string) {
    return EventHandler.hasListener(document, eventType)
  }
}
