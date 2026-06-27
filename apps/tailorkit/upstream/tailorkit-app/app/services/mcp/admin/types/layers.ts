import type { MCP_TOOLS } from '~/routes/api.mcp.$tool/constants'
import type { ELayerType } from '~/types/psd'

interface ILayer {
  _id: string
  type: ELayerType
  top: number
  left: number
  width: number
  height: number
  rotate: number
  visible: boolean
  label: string
  shopDomain: string
  parent?: string
  // For text layer
  settings?: ILayerTextSettings
  // For image layer
  image?: {
    _id: string
    width: number
    height: number
    src: string
    imageName: string
  }
  // @deprecated: Use image.src instead
  dataSrc?: string
}

interface ILayerTextSettings {
  storefrontLabel: string
  content: string
  textStyle?: string[]
  textColor?: string
  fontFamily?: {
    family: string
    src: string
  }
  textAlign?: string
  verticalAlign?: string
  strokeColor?: string
  strokeWeight?: number
  autoFitToContainer?: boolean
  generateTextWithAI?: {
    allow: boolean
    settings?: {
      color: string
    }
  }
}

interface ICreateLayerArgs {
  templateId: string
  shopDomain: string
  layer: ILayer
}

interface IManageLayerArgs {
  templateId: string
  shopDomain: string
  layer: ILayer
  action: (typeof MCP_TOOLS)['CREATE_LAYER' | 'UPDATE_LAYER']
}

export type { ILayer, ILayerTextSettings, ICreateLayerArgs, IManageLayerArgs }
