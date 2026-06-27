import type { Stage } from 'konva/lib/Stage'
import type { RefObject } from 'react'
import { createContext, useContext } from 'react'

// Define integration editor context
export const IntegrationEditorContext = createContext<{
  stageRef: RefObject<Stage>
  validationErrors: { [key: string]: any }
  getValidationErrors: (id: string, dataKey: string) => string | null
  setValidationErrors: (id: string, dataKey: string, error: Error | string | null) => void
}>({
  stageRef: { current: null },
  validationErrors: {},
  getValidationErrors: (id: string, dataKey: string) => '',
  setValidationErrors: (id: string, dataKey: string, error: Error | string | null) => {},
})

export function useIntegrationEditorContext() {
  const context = useContext(IntegrationEditorContext)
  if (context === undefined) {
    throw new Error('useIntegrationEditorContext must be used within a IntegrationEditorProvider')
  }
  return context
}
