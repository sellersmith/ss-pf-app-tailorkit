import isEqual from 'lodash/isEqual'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PromptPresetDocument } from '~/models/PromptPreset'
import { authenticatedFetch } from '~/shopify/fns.client'
import { TOAST } from '~/constants/toasts'
import { showToast } from '~/utils/toastEvents'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import type { IImageQuery } from '~/types/shopify-files'
import {
  type DimensionType,
  parseDimensionsFromInstruction,
  updateInstructionWithDimension,
} from '../utils/instructionDimensions'

export function useQuickPrompts(_prompts: PromptPresetDocument[]) {
  const { t } = useTranslation()

  const [prompts, setPrompts] = useState<PromptPresetDocument[]>(_prompts)
  const [savedPrompts, setSavedPrompts] = useState<PromptPresetDocument[]>(_prompts)
  const [editingPromptIdState, setEditingPromptId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [errorField, setErrorField] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'built-in' | 'custom'>('custom')

  const [isDismissedClearFiltersBanner, setIsDismissedClearFiltersBanner] = useState(
    localStorage.getItem('isDismissedClearFiltersBanner') === 'true'
  )

  // Thumbnail state: store URLs directly
  const [thumbnailUrls, setThumbnailUrls] = useState<{ [key: string]: string[] }>({})
  const [editingPromptIdForThumbnail, setEditingPromptIdForThumbnail] = useState<string | null>(null)
  const [replaceThumbnailIndex, setReplaceThumbnailIndex] = useState<number | null>(null)
  // Track thumbnails that come from test prompt section (to allow removal on unselect)
  const [testPromptThumbnailUrls, setTestPromptThumbnailUrls] = useState<{ [key: string]: string[] }>({})

  // Modal state
  const { state, openModal, closeModal } = useModal()

  const items = useMemo(() => prompts.map(item => ({ ...item, id: item._id })), [prompts])

  const editingPromptId = useMemo(
    () => (items.some(item => item.id === editingPromptIdState) ? editingPromptIdState : null),
    [editingPromptIdState, items]
  )

  const isEditingPrompt = useMemo(() => editingPromptId !== null, [editingPromptId])

  const isFiltering = searchQuery !== ''

  // Helper to clear thumbnail error
  const clearThumbnailError = useCallback(() => {
    if (errorField === 'thumbnail') {
      setErrorField(null)
      setErrorMessage(null)
    }
  }, [errorField])

  // Helper to scroll to thumbnail section
  const scrollToThumbnailSection = useCallback(() => {
    const thumbnailSection = document.getElementById('thumbnail-section')
    thumbnailSection?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  // Helper to set validation error (handles delayed setting when switching prompts)
  const setValidationError = useCallback(
    (promptId: string, field: string, message: string, shouldScroll = false) => {
      const needsDelay = promptId !== editingPromptId

      if (needsDelay) {
        setEditingPromptId(promptId)
        setTimeout(() => {
          setErrorField(field)
          setErrorMessage(message)
          if (shouldScroll) scrollToThumbnailSection()
        }, 0)
      } else {
        setErrorField(field)
        setErrorMessage(message)
        if (shouldScroll) setTimeout(scrollToThumbnailSection, 100)
      }
    },
    [editingPromptId, scrollToThumbnailSection]
  )

  // Helper to clear thumbnail state for a prompt
  const clearThumbnailState = useCallback((promptId: string) => {
    setThumbnailUrls(prev => {
      const updated = { ...prev }
      delete updated[promptId]
      return updated
    })
    setTestPromptThumbnailUrls(prev => {
      const updated = { ...prev }
      delete updated[promptId]
      return updated
    })
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const { name, instruction } = item
      const lowerSearchQuery = searchQuery.toLowerCase()
      const matchesName = name.toLowerCase().includes(lowerSearchQuery)
      const matchesInstruction = instruction && instruction.toLowerCase().includes(lowerSearchQuery)

      const matchesSearch = matchesName || matchesInstruction
      const matchesFilter = (filterType === 'built-in' && item.imported) || (filterType === 'custom' && !item.imported)
      return matchesSearch && matchesFilter
    })
  }, [items, searchQuery, filterType])

  /**
   * Calculate the total count for the currently selected tab
   * For 'custom' tab: count items where !item.imported
   * For 'built-in' tab: count items where item.imported
   */
  const tabTotalCount = useMemo(() => {
    return items.filter(item => {
      return (filterType === 'built-in' && item.imported) || (filterType === 'custom' && !item.imported)
    }).length
  }, [items, filterType])

  const handleSort = (items: any) => {
    setPrompts(items)

    // Send request to update server-side documents
    authenticatedFetch('/api/prompt-presets?action=sort', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map((item: any, index: number) => ({ _id: item.id, name: item.name, ordering: index + 1 })),
      }),
    })
  }

  const handleAddPrompt = useCallback(() => {
    setEditingPromptId(null)
    setErrorField(null)
    setErrorMessage(null)
    const id = `prompt-${prompts.length}`

    setPrompts([...prompts, { _id: id, name: '', instruction: '', ordering: prompts.length + 1 }])

    setEditingPromptId(id)
  }, [prompts])

  const imageSelectorActive = state?.[MODAL_ID.IMAGE_SELECTOR_MODAL]?.active

  const getThumbnailUrls = useCallback(
    (promptId: string): string[] => {
      // Always prioritize local state (even if empty array) over original prompt thumbnails
      if (promptId in thumbnailUrls) {
        return thumbnailUrls[promptId]
      }

      // Only fallback to original if not in local state
      const prompt = items.find(i => i.id === promptId)
      return prompt?.thumbnail || []
    },
    [items, thumbnailUrls]
  )

  const handleOpenThumbnailSelector = useCallback(
    (promptId: string, replaceIndex?: number) => {
      setEditingPromptIdForThumbnail(promptId)
      setReplaceThumbnailIndex(replaceIndex !== undefined ? replaceIndex : null)
      openModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
    },
    [openModal]
  )

  const handleThumbnailSelect = useCallback(
    (images: IImageQuery[] | null) => {
      if (images && images.length > 0 && editingPromptIdForThumbnail) {
        const newUrls = images.map(img => img.image.originalSrc).slice(0, 2) // Limit to 2 max

        if (replaceThumbnailIndex !== null) {
          // Replace specific thumbnail at index, keep all other thumbnails
          setThumbnailUrls(prev => {
            const currentUrls = prev[editingPromptIdForThumbnail] ?? getThumbnailUrls(editingPromptIdForThumbnail)
            // Replace only if index exists
            if (replaceThumbnailIndex < currentUrls.length) {
              const updatedUrls = [...currentUrls]
              updatedUrls[replaceThumbnailIndex] = newUrls[0] // Replace with first selected image
              return { ...prev, [editingPromptIdForThumbnail]: updatedUrls }
            }
            // If index doesn't exist, just add (shouldn't happen in normal flow)
            const updatedUrls = [...currentUrls, ...newUrls].slice(0, 2)
            return { ...prev, [editingPromptIdForThumbnail]: updatedUrls }
          })
        } else {
          // Add new thumbnails (limit to 2 max total)
          setThumbnailUrls(prev => {
            const currentUrls = prev[editingPromptIdForThumbnail] ?? getThumbnailUrls(editingPromptIdForThumbnail)
            const updatedUrls = [...currentUrls, ...newUrls].slice(0, 2)
            return { ...prev, [editingPromptIdForThumbnail]: updatedUrls }
          })
        }

        // Clear error if thumbnail is added
        clearThumbnailError()
      }
      closeModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
      setEditingPromptIdForThumbnail(null)
      setReplaceThumbnailIndex(null)
    },
    [editingPromptIdForThumbnail, replaceThumbnailIndex, clearThumbnailError, closeModal, getThumbnailUrls]
  )

  /**
   * Handle delete individual thumbnail
   * Allows deleting all thumbnails (empty array is valid)
   */
  const handleDeleteThumbnail = useCallback(
    (promptId: string, index: number) => {
      // Get current URLs before updating
      const currentUrls = thumbnailUrls[promptId] ?? getThumbnailUrls(promptId)
      const deletedUrl = currentUrls[index]

      // Update thumbnails - always set even if empty array
      setThumbnailUrls(prev => {
        const urls = prev[promptId] ?? getThumbnailUrls(promptId)
        const updatedUrls = urls.filter((_, i) => i !== index)
        return { ...prev, [promptId]: updatedUrls }
      })

      // Also remove from test prompt tracking if it was from test prompt
      const testUrls = testPromptThumbnailUrls[promptId] || []
      if (testUrls.includes(deletedUrl)) {
        setTestPromptThumbnailUrls(prev => ({
          ...prev,
          [promptId]: testUrls.filter(url => url !== deletedUrl),
        }))
      }

      // Clear error if thumbnail is removed
      clearThumbnailError()
    },
    [thumbnailUrls, getThumbnailUrls, testPromptThumbnailUrls, clearThumbnailError]
  )

  const handleDoneEditing = useCallback(async () => {
    if (errorField) return

    setIsSaving(true)

    try {
      // Validate ALL prompts before saving (especially new ones)
      // This ensures that if multiple prompts are added without data, all are validated
      for (const prompt of items) {
        const { _id, name, instruction } = prompt

        // Skip validation for existing prompts that haven't been modified
        // Only validate new prompts (starting with 'prompt-') or the currently editing prompt
        const isNewPrompt = _id.startsWith('prompt-')
        if (!isNewPrompt && _id !== editingPromptId) continue

        // Validate name and instruction
        if (name === '' || instruction === '') {
          const errorFieldValue = name === '' ? 'name' : 'instruction'
          const errorMessageValue = name === '' ? "Label can't be blank" : "Content can't be blank"
          setValidationError(_id, errorFieldValue, errorMessageValue)
          setIsSaving(false)
          return
        }

        // Validate thumbnail
        const promptThumbnailUrls = getThumbnailUrls(_id)
        if (!promptThumbnailUrls.length) {
          setValidationError(_id, 'thumbnail', t('thumbnail-is-required'), true)
          setIsSaving(false)
          return
        }
      }

      // Find deleted items (items in savedPrompts that are not in prompts)
      const deletedItems = savedPrompts.filter(orig => !prompts.find(p => p._id === orig._id))

      // Handle deletions
      for (const deletedItem of deletedItems) {
        if (!deletedItem._id.startsWith('prompt-')) {
          await authenticatedFetch('/api/prompt-presets?action=delete', {
            method: 'POST',
            body: JSON.stringify({ _id: deletedItem._id }),
          })
        }
      }

      if (deletedItems.length > 0) {
        showToast(t(TOAST.QUICK_PROMPTS.DELETED))

        // Update the saved state to reflect deletions
        setSavedPrompts([...prompts])
      }

      // Find the current editing prompt (if it still exists and wasn't deleted)
      const prompt = items.find(item => item.id === editingPromptId)
      if (!prompt) {
        // All changes were deletions, we're done
        setIsSaving(false)
        setEditingPromptId(null)
        return
      }

      const { _id } = prompt
      const finalThumbnailUrls = getThumbnailUrls(_id)

      // Handle save - show toast only after validation passes
      showToast(t(TOAST.QUICK_PROMPTS.SAVING))

      const isNewPrompt = _id.startsWith('prompt-')

      // Send request to update server-side document
      const response = await authenticatedFetch('/api/prompt-presets?action=update', {
        method: 'POST',
        body: JSON.stringify({
          ...prompt,
          _id: isNewPrompt ? undefined : _id,
          thumbnail: finalThumbnailUrls,
        }),
      })

      // Get the actual _id (from server for new prompts, or existing for updates)
      const actualId = isNewPrompt && response?.item?._id ? response.item._id : _id

      // Update the prompts array with the saved thumbnail URLs and actual _id
      const updatedPrompts = prompts.map(p =>
        p._id === _id ? { ...p, _id: actualId, thumbnail: finalThumbnailUrls } : p
      )
      setPrompts(updatedPrompts)

      // Update the saved state as well
      setSavedPrompts([...updatedPrompts])

      // Update thumbnail URLs key if _id changed
      if (isNewPrompt && actualId !== _id) {
        setThumbnailUrls(prev => {
          const updated = { ...prev }
          if (updated[_id]) {
            updated[actualId] = updated[_id]
            delete updated[_id]
          }
          return updated
        })
      }

      // Clear local thumbnail state after successful save
      clearThumbnailState(actualId)

      showToast(t(TOAST.QUICK_PROMPTS.SAVED))
      setTimeout(() => setEditingPromptId(null), 100)
    } catch (error: any) {
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      setIsSaving(false)
    }
  }, [
    errorField,
    savedPrompts,
    items,
    t,
    prompts,
    editingPromptId,
    getThumbnailUrls,
    setValidationError,
    clearThumbnailState,
  ])

  const handleCancelEditing = useCallback(() => {
    // Revert all changes - restore saved prompts completely
    setPrompts([...savedPrompts])

    // Clear local thumbnail state when canceling
    if (editingPromptId) {
      clearThumbnailState(editingPromptId)
    }

    setTimeout(() => setEditingPromptId(null), 100)
  }, [editingPromptId, savedPrompts, clearThumbnailState])

  /**
   * Remove the current prompt from the local list (UI only).
   * Flow:
   * - User clicks "Delete" → Item removed from UI, ContextualSaveBar appears
   * - User clicks "Save" → API deletion is called in handleDoneEditing
   * - User clicks "Discard" → List is restored from savedPrompts
   */
  const handleDeletePrompt = useCallback(() => {
    if (!editingPromptId) return

    // Remove the item from the local list immediately
    setPrompts(prompts.filter(item => item._id !== editingPromptId))

    // Clear editing state
    setEditingPromptId(null)
  }, [editingPromptId, prompts])

  const handleFieldChange = useCallback(
    (field: 'name' | 'instruction', value: string) => {
      setPrompts(prompts.map(prompt => (prompt._id === editingPromptId ? { ...prompt, [field]: value } : prompt)))
    },
    [editingPromptId, prompts]
  )

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      setPrompts(prev =>
        prev.map(prompt =>
          prompt._id === editingPromptId
            ? { ...prompt, category: category as 'engraved' | 'illustrative' | 'festive' | null }
            : prompt
        )
      )
    },
    [editingPromptId]
  )

  /**
   * Handle dimension selection (Template Type, Visual Style, Content Theme)
   * Updates the instruction text with the selected dimension declaration
   */
  const handleDimensionSelect = useCallback(
    (dimensionType: DimensionType, selectedNames: string[]) => {
      const prompt = prompts.find(p => p._id === editingPromptId)
      if (!prompt) return

      // Get the first selected name (single selection mode)
      const selectedName = selectedNames.length > 0 ? selectedNames[0] : null

      // Update instruction with the new dimension
      const updatedInstruction = updateInstructionWithDimension(prompt.instruction, dimensionType, selectedName)

      setPrompts(prompts.map(p => (p._id === editingPromptId ? { ...p, instruction: updatedInstruction } : p)))
    },
    [prompts, editingPromptId]
  )

  /**
   * Get current dimension selections from the editing prompt's instruction
   * Memoized to prevent infinite re-renders
   */
  const editingPromptDimensions = useMemo(() => {
    const prompt = prompts.find(p => p._id === editingPromptId)
    if (!prompt) {
      return { template_type: null, visual_style: null, content_theme: null }
    }
    return parseDimensionsFromInstruction(prompt.instruction)
  }, [prompts, editingPromptId])

  const handleDismissBanner = () => {
    setIsDismissedClearFiltersBanner(true)
    localStorage.setItem('isDismissedClearFiltersBanner', 'true')
  }

  const handleCloseImageSelector = () => {
    closeModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
    setEditingPromptIdForThumbnail(null)
  }

  /**
   * Handle thumbnail selection from the test prompt section
   * Allows generated images to be used as thumbnails
   * Merges with existing thumbnails instead of replacing them
   * When unselecting, removes those thumbnails from the list
   */
  const handleThumbnailSelectFromTest = useCallback(
    (images: IImageQuery[]) => {
      if (!editingPromptId) return

      // Get current thumbnails for this prompt
      const currentUrls = getThumbnailUrls(editingPromptId)

      // Get previously selected URLs from test prompt for this prompt
      const previousTestUrls = testPromptThumbnailUrls[editingPromptId] || []

      // Extract URLs from currently selected images in test prompt
      const newTestUrls = images.map(img => img.image.originalSrc)

      // Remove previous test prompt thumbnails from current URLs
      const urlsWithoutPreviousTest = currentUrls.filter(url => !previousTestUrls.includes(url))

      // Merge: existing (without previous test) + new test selections
      // Limit to 2 thumbnails max, prioritizing new test selections
      const mergedUrls = [...newTestUrls, ...urlsWithoutPreviousTest]
        .filter((url, index, self) => self.indexOf(url) === index) // Remove duplicates
        .slice(0, 2) // Limit to 2 thumbnails max

      // Update thumbnails
      setThumbnailUrls(prev => ({ ...prev, [editingPromptId]: mergedUrls }))

      // Update tracked test prompt thumbnails
      setTestPromptThumbnailUrls(prev => ({ ...prev, [editingPromptId]: newTestUrls }))

      // Clear error if thumbnail is added
      clearThumbnailError()
    },
    [editingPromptId, clearThumbnailError, getThumbnailUrls, testPromptThumbnailUrls]
  )

  useEffect(() => {
    setErrorField(null)
    setErrorMessage(null)
  }, [editingPromptId])

  const isReadyToSave = useMemo(() => {
    if (errorField) return false

    const prompt = editingPromptId && items.find(item => item.id === editingPromptId)

    if (!prompt || !prompt?.name || !prompt?.instruction) return false

    // Check thumbnail requirement
    if (!getThumbnailUrls(prompt._id).length) {
      return false
    }

    return true
  }, [editingPromptId, errorField, items, getThumbnailUrls])

  /**
   * Computed hasChanges - compares current state with saved state
   * Returns true if:
   * - Any items have been deleted (prompts list shorter than savedPrompts)
   * - It's a new prompt (id starts with 'prompt-')
   * - Current prompt differs from saved
   * - Current thumbnails differ from saved
   */
  const hasChanges = useMemo(() => {
    // Check if any items have been deleted
    const hasDeletedItems = savedPrompts.some(orig => !prompts.find(p => p._id === orig._id))
    if (hasDeletedItems) return true

    // Check if a new prompt was added
    const hasNewItems = prompts.some(p => p._id.startsWith('prompt-'))
    if (hasNewItems) return true

    // Compare each prompt with its saved version
    for (const currentPrompt of prompts) {
      const savedPrompt = savedPrompts.find(p => p._id === currentPrompt._id)
      if (!savedPrompt) continue

      // Compare prompt data (excluding thumbnail as we handle it separately)
      const { thumbnail: _savedThumb, ...savedData } = savedPrompt
      const { thumbnail: _currThumb, ...currentData } = currentPrompt

      if (!isEqual(savedData, currentData)) return true

      // Compare thumbnails
      const savedThumbnails = savedPrompt.thumbnail || []
      const currentThumbnails = thumbnailUrls[currentPrompt._id] ?? savedThumbnails

      if (!isEqual(savedThumbnails, currentThumbnails)) return true
    }

    return false
  }, [savedPrompts, prompts, thumbnailUrls])

  return {
    // State
    prompts,
    filteredItems,
    editingPromptId,
    isEditingPrompt,
    errorField,
    errorMessage,
    searchQuery,
    filterType,
    isFiltering,
    isDismissedClearFiltersBanner,
    imageSelectorActive,
    isReadyToSave,
    isSaving,
    hasChanges,
    tabTotalCount,

    // Actions
    setEditingPromptId,
    setSearchQuery,
    setFilterType,
    setErrorField,
    setErrorMessage,
    setPrompts,

    // Handlers
    handleSort,
    handleAddPrompt,
    handleOpenThumbnailSelector,
    handleThumbnailSelect,
    handleDeleteThumbnail,
    handleDoneEditing,
    handleCancelEditing,
    handleDeletePrompt,
    handleFieldChange,
    handleDismissBanner,
    handleCloseImageSelector,
    getThumbnailUrls,
    handleDimensionSelect,
    handleCategoryChange,
    editingPromptDimensions,
    handleThumbnailSelectFromTest,
  }
}
