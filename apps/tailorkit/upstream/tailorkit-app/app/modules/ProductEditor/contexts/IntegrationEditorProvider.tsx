import { KeyboardProvider } from '~/modules/TemplateEditor/contexts/KeyboardContext'
import { ToolBarProvider } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import { IntegrationEditorContext } from '.'
import { useState, useRef } from 'react'
import type { Stage } from 'konva/lib/Stage'

function IntegrationEditorProvider(props: { children: React.ReactNode }) {
  const { children } = props

  const [validationErrors, _setValidationErrors] = useState<any>({})
  const stageRef = useRef<Stage>(null)

  function getValidationErrors(id: string, dataKey: string): string | null {
    const message = validationErrors[`${id}-${dataKey}`]

    return message
  }

  function setValidationErrors(id: string, dataKey: string = '', error: Error | string | null) {
    if (error) {
      _setValidationErrors({ ...validationErrors, [`${id}-${dataKey}`]: (error as Error)?.message || error })
      return
    }

    const keyError = dataKey ? `${id}-${dataKey}` : id
    if (validationErrors[keyError]) {
      delete validationErrors[keyError]
      _setValidationErrors(validationErrors)
    }
  }

  return (
    <KeyboardProvider>
      <ToolBarProvider>
        <IntegrationEditorContext.Provider
          value={{ stageRef, validationErrors, getValidationErrors, setValidationErrors }}
        >
          {children}
        </IntegrationEditorContext.Provider>
      </ToolBarProvider>
    </KeyboardProvider>
  )
}

export default IntegrationEditorProvider
