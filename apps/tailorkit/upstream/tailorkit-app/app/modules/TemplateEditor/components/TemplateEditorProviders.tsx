import { useCallback, useState, useEffect } from 'react'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { TemplateEditorContext } from '../context'
import { KeyboardProvider } from '../contexts/KeyboardContext'
import { StoreProvider } from '../contexts/StoreContext'
import { ToolBarProvider } from '../contexts/ToolBarContext'
import { BackgroundRemovalInitializer } from '~/components/BackgroundRemovalInitializer'
import TriggerTourProvider from '~/modules/TourGuides/TriggerTourProvider'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'

function TemplateEditorProviders(props: { children: React.ReactNode }) {
  const extractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)

  const [validationErrors, _setValidationErrors] = useState<any>({})

  const setValidationErrors = useCallback(
    (id: string, dataKey: string, error: Error | string | null) => {
      if (error) {
        _setValidationErrors((prev: any) => {
          return { ...prev, [`${id}-${dataKey}`]: (error as Error)?.message || error }
        })
      } else if (validationErrors[`${id}-${dataKey}`]) {
        delete validationErrors[`${id}-${dataKey}`]

        _setValidationErrors(validationErrors)
      }
    },
    [validationErrors, _setValidationErrors]
  )

  const resetValidationErrors = useCallback((validationErrors: { [key: string]: any } | null) => {
    _setValidationErrors(validationErrors || {})
  }, [])

  // Listen for UNIFIED_EDITOR_DISCARDED event to clear validation errors
  // This ensures validation errors are cleared even when discard happens outside TemplateEditorContext
  useEffect(() => {
    const handleUnifiedDiscard = () => {
      resetValidationErrors(null)
    }

    Transmitter.listen('UNIFIED_EDITOR_DISCARDED', handleUnifiedDiscard)
    return () => {
      Transmitter.remove('UNIFIED_EDITOR_DISCARDED', handleUnifiedDiscard)
    }
  }, [resetValidationErrors])

  return (
    <StoreProvider>
      <KeyboardProvider>
        <ToolBarProvider>
          <TemplateEditorContext.Provider
            value={{ validationErrors, setValidationErrors, layers: extractedLayerStores, resetValidationErrors }}
          >
            {props.children}
            <BackgroundRemovalInitializer />
            <TriggerTourProvider />
          </TemplateEditorContext.Provider>
        </ToolBarProvider>
      </KeyboardProvider>
    </StoreProvider>
  )
}

export default TemplateEditorProviders
