import type { TLayerStore } from '~/stores/modules/layer'
import { createContext } from 'react'

// Define template editor context
export const TemplateEditorContext = createContext<{
  layers: TLayerStore[]
  validationErrors: {
    [key: string]: any
  }
  setValidationErrors: (id: string, dataKey: string, message: string | null) => void
  resetValidationErrors: (validationErrors: { [key: string]: any } | null) => void
}>({
  layers: [],
  validationErrors: {},
  setValidationErrors: (id: string, dataKey: string, message: string | null) => {},
  resetValidationErrors: (validationErrors: { [key: string]: any } | null) => {},
})
