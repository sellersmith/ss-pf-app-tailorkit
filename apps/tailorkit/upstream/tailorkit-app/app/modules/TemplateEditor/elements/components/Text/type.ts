import type { TextSettings } from '~/types/psd'
import type { TemplateElementState } from '../types'

export type TextElementState = TemplateElementState & {
  settings: TextSettings
}

export type TOptionSetEditingState = {
  editMode: boolean
  existOptionSetPressed: boolean
  newOptionSetPressed: boolean
}
