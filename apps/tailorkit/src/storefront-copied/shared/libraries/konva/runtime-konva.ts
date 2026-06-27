import type Konva from 'konva'

export type TailorKitKonvaRuntime = typeof Konva

interface TailorKitKonvaDragDrop {
  _drag(event: Event): void
  _endDragBefore(event: Event): void
  _endDragAfter(event: Event): void
}

interface TailorKitKonvaRuntimeWithInternals extends TailorKitKonvaRuntime {
  DD?: TailorKitKonvaDragDrop
}

declare global {
  interface Window {
    Konva?: TailorKitKonvaRuntime
  }
}

let konvaRuntime: TailorKitKonvaRuntime | undefined

export function setTailorKitKonvaRuntime(runtime: TailorKitKonvaRuntime): void {
  konvaRuntime = runtime
}

export function getTailorKitKonvaRuntime(): TailorKitKonvaRuntime {
  if (konvaRuntime) return konvaRuntime
  if (window.Konva) {
    konvaRuntime = window.Konva
    return konvaRuntime
  }
  throw new Error('TailorKit Konva runtime is not loaded')
}

export function getTailorKitKonvaDragDrop(): TailorKitKonvaDragDrop {
  const dragDrop = (getTailorKitKonvaRuntime() as TailorKitKonvaRuntimeWithInternals).DD
  if (!dragDrop) throw new Error('TailorKit Konva DragAndDrop runtime is not loaded')
  return dragDrop
}

export const TailorKitKonva = new Proxy({} as TailorKitKonvaRuntime, {
  get(_target, property) {
    return (getTailorKitKonvaRuntime() as any)[property]
  },
  set(_target, property, value) {
    ;(getTailorKitKonvaRuntime() as any)[property] = value
    return true
  },
})
