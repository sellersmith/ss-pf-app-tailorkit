/// <reference types="node" />

declare module 'fontkit' {
  export interface BoundingBox {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }

  export interface Font {
    unitsPerEm: number
    ascent: number
    descent: number
    lineGap: number
    glyphForCodePoint(codePoint: number): Glyph
  }

  export interface Glyph {
    advanceWidth: number
    bbox: BoundingBox
    path?: {
      scale(factor: number): this
      translate(x: number, y: number): this
      toSVG(): string
    }
  }

  export function create(buffer: ArrayBuffer | Uint8Array): Font
}
