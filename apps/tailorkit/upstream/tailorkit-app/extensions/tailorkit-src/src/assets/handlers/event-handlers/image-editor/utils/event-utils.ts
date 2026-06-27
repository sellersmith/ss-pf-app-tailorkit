import type Konva from 'konva'

/**
 * Event handler registration tracking system
 * Allows clean tracking and removal of event handlers
 */
export class EventManager {
  private handlers: { node: Konva.Node; event: string; handler: Function }[] = []
  private isDestroyed = false

  /**
   * Register a Konva event handler and track it for cleanup
   */
  public addKonvaEventHandler(node: Konva.Node, event: string, handler: Function): void {
    if (this.isDestroyed || !node) return

    node.on(event, handler as any)
    this.handlers.push({ node, event, handler })
  }

  /**
   * Remove all registered event handlers
   */
  public cleanup(): void {
    this.isDestroyed = true

    // Remove all event handlers
    for (const { node, event, handler } of this.handlers) {
      try {
        if (node) {
          node.off(event, handler as any)
        }
      } catch (e) {
        // Silently ignore errors during cleanup
      }
    }

    this.handlers = []
  }

  /**
   * Check if the event manager has been destroyed
   */
  public isCleanedUp(): boolean {
    return this.isDestroyed
  }
}

/**
 * Dispatch a custom event with editor state
 */
export function dispatchTransformEvent(container: HTMLElement, state: any): void {
  const event = new CustomEvent('konva:transform', {
    detail: state,
  })
  container.dispatchEvent(event)
}
