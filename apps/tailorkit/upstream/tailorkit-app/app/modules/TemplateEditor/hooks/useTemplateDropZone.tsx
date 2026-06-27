import { useEffect, useState } from 'react'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'

/**
 * Custom hook to manage the template drop zone functionality.
 * It handles the visibility of the image selector modal based on drag events,
 * manages success and error messages, and sets up event listeners for drag-and-drop actions.
 *
 * @returns {null | void} Returns null if no modal is open and there are no messages to display.
 */
export function useTemplateDropZone() {
  const { state, openModal, closeModal } = useModal()

  const openImagesDialog = state?.[MODAL_ID.IMAGE_SELECTOR_MODAL]?.active

  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Clear success message after 3 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (successMessage) {
      timer = setTimeout(() => {
        setSuccessMessage('')
        closeModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
      }, 3000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [closeModal, successMessage])

  // Clear error message after 5 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (errorMessage) {
      timer = setTimeout(() => {
        setErrorMessage('')
      }, 5000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [errorMessage])

  // Handle drag events on the canvas
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      openModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      // Only hide if dragging outside the window
      if (e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY <= 0 || e.clientY >= window.innerHeight) {
        closeModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      // Don't hide immediately, let the component handle it
    }

    const canvas = document.querySelector('#canvas-editor') as HTMLDivElement | null

    if (!canvas) return

    // Add event listeners to the document
    canvas.addEventListener('dragover', handleDragOver)
    canvas.addEventListener('dragleave', handleDragLeave)
    canvas.addEventListener('drop', handleDrop)

    return () => {
      // Clean up event listeners
      canvas.removeEventListener('dragover', handleDragOver)
      canvas.removeEventListener('dragleave', handleDragLeave)
      canvas.removeEventListener('drop', handleDrop)
    }
  }, [closeModal, openModal])

  if (!openImagesDialog && !successMessage && !errorMessage) {
    return null
  }
}
