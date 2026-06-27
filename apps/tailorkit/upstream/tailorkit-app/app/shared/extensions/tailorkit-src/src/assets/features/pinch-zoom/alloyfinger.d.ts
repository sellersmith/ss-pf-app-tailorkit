/**
 * Type declarations for AlloyFinger gesture library
 * @see https://github.com/AlloyTeam/AlloyFinger
 */

declare module 'alloyfinger' {
  interface AlloyFingerOptions {
    touchStart?: (evt: TouchEvent) => void
    touchMove?: (evt: TouchEvent) => void
    touchEnd?: (evt: TouchEvent) => void
    touchCancel?: (evt: TouchEvent) => void
    multipointStart?: (evt: TouchEvent) => void
    multipointEnd?: (evt: TouchEvent) => void
    tap?: (evt: TouchEvent) => void
    doubleTap?: (evt: TouchEvent & { changedTouches: TouchList }) => void
    longTap?: (evt: TouchEvent) => void
    singleTap?: (evt: TouchEvent) => void
    rotate?: (evt: { angle: number; center: { x: number; y: number } }) => void
    pinch?: (evt: { zoom: number; center: { x: number; y: number } }) => void
    pressMove?: (evt: { deltaX: number; deltaY: number }) => void
    swipe?: (evt: { direction: 'Up' | 'Down' | 'Left' | 'Right' }) => void
  }

  class AlloyFinger {
    constructor(element: HTMLElement, options: AlloyFingerOptions)
    on(eventName: string, handler: (evt: unknown) => void): void
    off(eventName: string, handler: (evt: unknown) => void): void
    destroy(): void
  }

  export = AlloyFinger
}
