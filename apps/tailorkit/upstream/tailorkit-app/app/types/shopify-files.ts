type IImageQuery = {
  id: string
  alt: string
  fileStatus?: string
  image: {
    originalSrc: string
    width: number
    height: number
    metadata?: {
      transparentRegions?: [{ top: number; left: number; right: number; bottom: number; width: number; height: number }]
    }
  }
  fileErrors?: any
  mediaErrors?: any
  customImageType?: string
}

export type { IImageQuery }
