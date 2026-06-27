import { useRevalidator, useSearchParams } from '@remix-run/react'
import { closeTemplateEditorSaveBarAndUpdateSavedStep, resetTemplateEditorStates } from '../fns'
import { useCallback, useContext } from 'react'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { FILE_UPLOAD_EVENTS, MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '../constants'
import { TemplateEditorContext } from '../context'

/**
 * Discards the template
 *
 * @returns {Function} onRevalidateTemplate
 */
export function useDiscardTemplate() {
  const { revalidate } = useRevalidator()
  const [searchParams, setSearchParams] = useSearchParams()
  const { layers, resetValidationErrors } = useContext(TemplateEditorContext)

  const onDiscardTemplate = useCallback(() => {
    // Clear all validation errors first
    resetValidationErrors(null)

    // Clear all state and validation errors
    Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.CLEAR_VALIDATION_ERRORS, {
      layerIds: layers.map(layer => layer.getState()._id),
    })
    resetTemplateEditorStates()

    // Re-validate
    revalidate()

    // Close ui-save-bar and grant savedStep
    closeTemplateEditorSaveBarAndUpdateSavedStep(true)

    // Clear search params if needed
    setSearchParams(prev => {
      const premadeTemplateId = searchParams.get('premadeTemplateId')
      const source = searchParams.get('source')
      const content = searchParams.get('content')

      if (premadeTemplateId) prev.delete('premadeTemplateId')
      if (source) prev.delete('source')
      if (content) prev.delete('content')

      return prev
    })

    // Trigger reset background uploader event
    Transmitter.trigger(FILE_UPLOAD_EVENTS.RESET)
  }, [layers, revalidate, searchParams, setSearchParams, resetValidationErrors])

  return { onDiscardTemplate }
}
