import { Icon, InlineStack, Popover, Tooltip } from '@shopify/polaris'
import { CaretDownIcon, MagicIcon } from '@shopify/polaris-icons'
import { useEffect, useState, useRef } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './text-generation.module.css'
import PopoverAIContentGenerator from '../../AITextField/PopoverAIContentGenerator'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import ReactQuill from 'react-quill-new'
import DOMPurify from 'dompurify'

interface TextGenerationProps {
  editor: ReactQuill
  onSelectOptionAfterGenerating: (options: string[], isTogglePopoverActive?: boolean) => void
}

export const TextGeneration = ({ editor, onSelectOptionAfterGenerating }: TextGenerationProps) => {
  const { t } = useTranslation()
  // const [editor] = useLexicalComposerContext()
  const [selectionText, setSelectionText] = useState('')

  // Track selection state for applying text later
  const selectionRef = useRef<{
    hasSelection: boolean
    range: { index: number; length: number } | null
  }>({
    hasSelection: false,
    range: null,
  })

  const [popoverActive, setPopoverActive] = useState(false)

  const togglePopoverActive = useCallback(() => {
    const newState = !popoverActive
    setPopoverActive(newState)

    // When opening popover, we've already captured the selection in onActivatorClick
    if (!newState && editor && editor.getEditor) {
      // When closing popover, restore focus to the editor
      setTimeout(() => {
        const quill = editor.getEditor()
        if (quill) {
          quill.focus()

          // Restore selection if we had one
          if (selectionRef.current.hasSelection && selectionRef.current.range) {
            quill.setSelection(selectionRef.current.range.index, selectionRef.current.range.length)
          }
        }
      }, 0)

      // Clear selection text when closing
      setSelectionText('')
    }
  }, [popoverActive, editor])

  // Capture selection text and store selection info for later use
  const captureSelectionText = useCallback(() => {
    if (!editor || !editor.getEditor) {
      setSelectionText('')
      return
    }

    try {
      const quill = editor.getEditor()
      if (!quill) {
        setSelectionText('')
        return
      }

      // Reset the selection ref state
      selectionRef.current = {
        hasSelection: false,
        range: null,
      }

      // Get the current selection from Quill
      const range = quill.getSelection()
      if (!range || range.length === 0) {
        setSelectionText('')
        return
      }

      // Ensure the range is valid and within document boundaries
      const length = quill.getLength()
      if (range.index >= length) {
        console.warn('Invalid range: index outside document bounds')
        setSelectionText('')
        return
      }

      // Store selection points for later restoration
      selectionRef.current = {
        hasSelection: true,
        range: {
          index: range.index,
          length: range.length,
        },
      }

      // Get the selected text
      const text = quill.getText(range.index, range.length)
      if (text && text.trim().length > 0) {
        setSelectionText(text)
      } else {
        setSelectionText('')
      }
    } catch (error) {
      console.error('Error capturing selection text:', error)
      setSelectionText('')
    }
  }, [editor])

  // Handle the selection of generated content
  const handleLocalOptionSelect = useCallback(
    (options: string[]) => {
      if (options && options.length > 0 && editor && editor.getEditor) {
        const quill = editor.getEditor()

        if (quill) {
          try {
            // Sanitize the AI-generated HTML content to prevent XSS
            const sanitizedContent = DOMPurify.sanitize(options[0])

            // If we have a stored selection, restore it and insert the generated text
            if (selectionRef.current.hasSelection && selectionRef.current.range) {
              const { index, length } = selectionRef.current.range

              // First focus the editor to ensure it's in document
              quill.focus()

              // Delete the selected text if any
              if (length > 0) {
                quill.deleteText(index, length)
              }

              // Insert the sanitized HTML content at the cursor position
              quill.clipboard.dangerouslyPasteHTML(index, sanitizedContent)

              // Set the cursor position after the inserted content
              // Use setTimeout to avoid "addRange(): The given range isn't in document" error
              setTimeout(() => {
                if (quill.root.contains(document.activeElement)) {
                  // Calculate the length of the inserted content
                  const delta = quill.clipboard.convert(sanitizedContent)
                  const insertedLength = delta.length()
                  quill.setSelection(index + insertedLength - 1, 0)
                }
              }, 0)
            } else {
              // If we don't have a stored selection, insert at current cursor position
              quill.focus()
              const currentSelection = quill.getSelection()

              if (currentSelection) {
                // Insert sanitized HTML content
                quill.clipboard.dangerouslyPasteHTML(currentSelection.index, sanitizedContent)

                // Delay the selection to avoid the range error
                setTimeout(() => {
                  if (quill.root.contains(document.activeElement)) {
                    const delta = quill.clipboard.convert(sanitizedContent)
                    const insertedLength = delta.length()
                    quill.setSelection(currentSelection.index + insertedLength - 1, 0)
                  }
                }, 0)
              } else {
                // If no current selection, append to end
                const length = quill.getLength()
                quill.clipboard.dangerouslyPasteHTML(length - 1, sanitizedContent)

                // Delay the selection to avoid the range error
                setTimeout(() => {
                  if (quill.root.contains(document.activeElement)) {
                    const delta = quill.clipboard.convert(sanitizedContent)
                    const insertedLength = delta.length()
                    quill.setSelection(length - 1 + insertedLength - 1, 0)
                  }
                }, 0)
              }
            }
          } catch (error) {
            console.error('Error inserting content:', error)
          }

          // Get the HTML content and ensure it's sanitized before passing it on
          const htmlContent = DOMPurify.sanitize(quill.root.innerHTML)
          onSelectOptionAfterGenerating([htmlContent])
        }
      }
    },
    [editor, onSelectOptionAfterGenerating]
  )

  const onActivatorClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent default to avoid losing focus
      e.preventDefault()

      // Capture selection before toggling popover
      if (!popoverActive) {
        captureSelectionText()
      }

      togglePopoverActive()
    },
    [togglePopoverActive, popoverActive, captureSelectionText]
  )

  const activator = (
    <Tooltip content={t('generate-text')} dismissOnMouseOut>
      <button
        className={`${styles.ToolbarItem} ${popoverActive ? styles.ToolbarItemActive : ''}`}
        aria-label={t('generate-text')}
        onClick={onActivatorClick}
        onMouseDown={e => e.preventDefault()}
      >
        <InlineStack align="center" blockAlign="center" wrap={false}>
          <Icon source={MagicIcon} tone="success" />
          <Icon source={CaretDownIcon} tone="success" />
        </InlineStack>
      </button>
    </Tooltip>
  )

  useEffect(() => {
    if (!popoverActive) {
      return
    }

    Transmitter.listen(
      TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE,
      togglePopoverActive
    )

    return () => {
      Transmitter.remove(
        TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE,
        togglePopoverActive
      )
    }
  }, [popoverActive, togglePopoverActive])

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      autofocusTarget="first-node"
      onClose={togglePopoverActive}
      preferredAlignment="left"
      preferredPosition="below"
      preferInputActivator={true}
      zIndexOverride={1000}
    >
      {popoverActive && (
        <PopoverAIContentGenerator
          title={t('generate-product-description')}
          value={selectionText}
          mainTextLabel={t('features-and-keywords')}
          placeholderMainTextLabel={t('describe-the-features-and-keywords-of-the-product')}
          optionalTextLabel={t('enhance-refine-product-description')}
          disabledMainText={!!selectionText.length}
          defaultOpenOptionSettings={!!selectionText.length}
          disabledOptionSettings={!!selectionText.length}
          model="gpt-4o"
          containHTMLTags={true}
          contentWrapper={null}
          onSelectOptionAfterGenerating={handleLocalOptionSelect}
        />
      )}
    </Popover>
  )
}
