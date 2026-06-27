declare module '../../icons' {
  export const UNDO_ICON_PATH: string
  export const REDO_ICON_PATH: string
  export const RESET_ICON_PATH: string
  export function createSvgIcon(path: string, size?: number): string

  export const uploadIcon: string
  export const aiGenerateIcon: string
  export const rotateIcon: string
  export const rotateLeftIcon: string
  export const rotateRightIcon: string
  export const zoomInIcon: string
  export const zoomOutIcon: string
}
