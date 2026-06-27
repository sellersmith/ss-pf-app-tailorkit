import type Konva from 'konva'
import { TailorKitKonva as KonvaRuntime } from '../runtime-konva'

export interface KonvaTextMeasureOptions {
  text: string
  width: number
  lineHeight: number
  wrap: 'none' | 'word' | 'char'
  fontFamily: string
  fontStyle?: string
  fontSize: number
  align?: 'left' | 'center' | 'right'
  letterSpacing?: number
  padding?: number
  strokeWidth?: number
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
}

class OffscreenKonvaTextMeasurer {
  private container: HTMLDivElement | null = null
  private stage: Konva.Stage | null = null
  private layer: Konva.Layer | null = null
  private textNode: Konva.Text | null = null

  private ensureInitialized(width: number, height: number) {
    if (!this.container) {
      const div = document.createElement('div')
      div.style.position = 'fixed'
      div.style.left = '-10000px'
      div.style.top = '-10000px'
      div.style.width = `${Math.max(1, width)}px`
      div.style.height = `${Math.max(1, height)}px`
      document.body.appendChild(div)
      this.container = div
    }

    if (!this.stage) {
      this.stage = new KonvaRuntime.Stage({
        container: this.container!,
        width: Math.max(1, width),
        height: Math.max(1, height),
      })
    } else {
      this.stage.size({ width: Math.max(1, width), height: Math.max(1, height) })
    }

    if (!this.layer) {
      this.layer = new KonvaRuntime.Layer()
      this.stage.add(this.layer)
    }

    if (!this.textNode) {
      this.textNode = new KonvaRuntime.Text({})
      this.layer.add(this.textNode)
    }
  }

  measure(options: KonvaTextMeasureOptions) {
    const {
      text,
      width,
      lineHeight,
      wrap,
      fontFamily,
      fontStyle,
      fontSize,
      align,
      letterSpacing,
      padding = 0,
      strokeWidth = 0,
      shadowBlur = 0,
      shadowOffsetX = 0,
      shadowOffsetY = 0,
    } = options

    // Stage height can be larger than needed; give enough room
    const stageWidth = Math.max(1, width + padding * 2 + shadowBlur * 2 + Math.abs(shadowOffsetX) + strokeWidth)
    const stageHeight = Math.max(1, fontSize * 10)
    this.ensureInitialized(stageWidth, stageHeight)

    // Update text node attributes; width controls wrapping
    this.textNode!.setAttrs({
      text,
      width: Math.max(1, width),
      lineHeight,
      wrap,
      fontFamily,
      fontStyle,
      fontSize,
      align,
      letterSpacing,
      padding,
      strokeWidth,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
    })

    this.layer!.draw()

    const rect = this.textNode!.getClientRect({ skipShadow: false })
    return { width: rect.width, height: rect.height }
  }
}

let singleton: OffscreenKonvaTextMeasurer | null = null

export function getTextMeasurer(): OffscreenKonvaTextMeasurer {
  if (!singleton) singleton = new OffscreenKonvaTextMeasurer()
  return singleton
}
