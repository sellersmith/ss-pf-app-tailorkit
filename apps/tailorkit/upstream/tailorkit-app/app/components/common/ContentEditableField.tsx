import { Tooltip } from '@shopify/polaris'
import type { CSSProperties } from 'react'
import { useState, useRef, useEffect, createElement, useCallback } from 'react'
import { placeCaretAtPosition } from '~/utils/placeCaretAtPosition'

/**
 * Available HTML elements for the editable field
 */
export enum ContentEditableTagName {
  H3 = 'h3',
  Div = 'div',
}

/**
 * Ways to display content in the editable field
 */
export enum DisplayMode {
  DangerouslySetInnerHTML = 'dangerouslySetInnerHTML',
  InnerText = 'innerText',
}

/**
 * Actions to edit the content
 */
export enum EActionToEdit {
  DoubleClick = 'doubleClick',
  Click = 'click',
}

/**
 * Props for ContentEditableField component
 */
interface IContentEditableFieldProps {
  title: string
  setTitle: (value: string) => void
  id?: string
  styles?: CSSProperties
  className?: string
  maxLength?: number
  maxWidth?: number | string
  classEditing?: string
  contentEditable?: boolean
  stopPropagation?: boolean
  showTooltip?: boolean
  htmlTag?: ContentEditableTagName
  displayMode?: DisplayMode
  actionToEdit?: EActionToEdit
  onBlur?: (value: string) => void
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
}

/**
 * Styles applied during editing for different HTML elements
 */
const editingStyles: Record<ContentEditableTagName, CSSProperties> = {
  [ContentEditableTagName.H3]: {
    overflow: 'scroll',
    scrollbarWidth: 'none',
    whiteSpace: 'nowrap',
    textOverflow: 'clip',
    paddingRight: '12px',
  },
  [ContentEditableTagName.Div]: {},
}

/**
 * Default styles for displaying content (not editing)
 */
const ellipsisStyles: Record<ContentEditableTagName, CSSProperties> = {
  [ContentEditableTagName.H3]: {
    cursor: 'auto',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  [ContentEditableTagName.Div]: {},
}

/**
 * A component that renders text content that can be edited with a double-click
 */
export default function ContentEditableField(props: IContentEditableFieldProps) {
  const {
    title,
    setTitle,
    id,
    styles,
    className,
    maxLength,
    maxWidth,
    classEditing = 'editing',
    contentEditable = true,
    stopPropagation = true,
    showTooltip = true,
    actionToEdit = EActionToEdit.DoubleClick,
    htmlTag = ContentEditableTagName.H3,
    displayMode = DisplayMode.InnerText,
    onBlur,
    onClick,
    onDoubleClick: onDoubleClickProps,
  } = props

  // State and refs
  const [isEditing, setIsEditing] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  // Update the title if it has changed
  const onChangeTitle = useCallback(
    (value: string) => {
      if (value === title) return
      setTitle(value)
    },
    [title, setTitle]
  )

  // Handle blur event - update title and exit editing mode
  const updateTitle = useCallback(
    (e: React.FocusEvent<HTMLElement>, onChange: (value: string) => void) => {
      let currentText = title

      // Get updated text based on display mode
      if (displayMode === DisplayMode.DangerouslySetInnerHTML) {
        currentText = e.target.innerHTML.trim() || title
        ;(e.target as HTMLElement).innerHTML = currentText
      } else {
        currentText = e.target.innerText.trim() || title
        ;(e.target as HTMLElement).innerText = currentText
      }

      // Update the title and exit editing mode
      onChange(currentText)
      onBlur && onBlur(currentText)
      e.target.scrollLeft = 0
      e.target.blur()
      setIsEditing(false)
    },
    [title, displayMode, onBlur]
  )

  const handleStartEditing = useCallback(() => {
    if (contentEditable) {
      setIsEditing(true)

      // Focus the element and position cursor at the end
      setTimeout(() => {
        if (elementRef.current) {
          elementRef.current.focus()

          const range = document.createRange()
          range.selectNodeContents(elementRef.current)
          range.collapse(false) // Position at the end

          const selection = window.getSelection()
          if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }, 0)
    }
  }, [contentEditable])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.keyCode === 13 && !e.shiftKey) {
        e.currentTarget.blur()
      }

      // Cancel editing on Escape without saving changes
      if (e.keyCode === 27) {
        // 27 is the key code for Escape
        setIsEditing(false)
        // Reset to original value without saving changes
        if (displayMode === DisplayMode.DangerouslySetInnerHTML) {
          ;(e.currentTarget as HTMLElement).innerHTML = title
        } else {
          ;(e.currentTarget as HTMLElement).innerText = title
        }
        e.currentTarget.blur()
        e.preventDefault()
      }
    },
    [displayMode, title]
  )

  const onMouseClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      stopPropagation && e.stopPropagation()
      onClick && onClick(e)

      if (actionToEdit === EActionToEdit.Click) {
        handleStartEditing()
      }
    },
    [actionToEdit, stopPropagation, onClick, handleStartEditing]
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      onDoubleClickProps && onDoubleClickProps(e)
      if (actionToEdit === EActionToEdit.DoubleClick) {
        handleStartEditing()
      }
    },
    [handleStartEditing, actionToEdit, onDoubleClickProps]
  )

  const onMouseBlur = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      updateTitle(e, onChangeTitle)

      // Reset styles when not editing
      if (classEditing) {
        ;(e.target as HTMLElement).classList.remove(classEditing)
        Object.assign((e.target as HTMLElement).style, {
          cursor: 'auto',
          ...ellipsisStyles[htmlTag],
          ...styles,
        })
      }
    },
    [classEditing, htmlTag, styles, updateTitle, onChangeTitle]
  )

  const onMouseFocus = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (classEditing && isEditing) {
        ;(e.target as HTMLElement).classList.add(classEditing)
        Object.assign((e.target as HTMLElement).style, {
          cursor: 'auto',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth || '160px',
          ...editingStyles[htmlTag],
          ...styles,
        })
      }
    },
    [classEditing, htmlTag, isEditing, maxWidth, styles]
  )

  const onInput = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      if (maxLength) {
        const valueInputted = (e.target as HTMLElement).innerText.trim() || ''
        const lengthValueInputted = valueInputted.length || 0

        if (lengthValueInputted >= maxLength) {
          const newValue = valueInputted.substring(0, maxLength)
          ;(e.target as HTMLElement).innerText = newValue
          placeCaretAtPosition(e.target as HTMLElement, maxLength)
        }
      }
    },
    [maxLength]
  )

  // Props for the editable element
  const elementProps = {
    ref: elementRef,
    style: maxLength ? { cursor: 'auto', ...ellipsisStyles[htmlTag], ...styles } : { cursor: 'auto', ...styles },
    id,
    className,
    contentEditable: isEditing && contentEditable,
    suppressContentEditableWarning: true,
    onKeyDown,
    onClick: onMouseClick,
    onDoubleClick,
    onBlur: onMouseBlur,
    onFocus: onMouseFocus,
    onInput,
  }

  // Create the element based on display mode
  let renderContent: React.ReactElement
  if (displayMode === DisplayMode.DangerouslySetInnerHTML) {
    renderContent = createElement(htmlTag, {
      ...elementProps,
      dangerouslySetInnerHTML: { __html: title },
    })
  } else {
    renderContent = createElement(htmlTag, elementProps, title || 'Untitled')
  }

  // Prevent text selection when not editing
  useEffect(() => {
    const preventSelection = (e: Event) => {
      if (!isEditing) {
        e.preventDefault()
      }
    }

    const element = elementRef.current
    if (element) {
      element.addEventListener('selectstart', preventSelection)
      return () => {
        element.removeEventListener('selectstart', preventSelection)
      }
    }
  }, [isEditing])

  // Wrap with tooltip if needed
  if (showTooltip && !isEditing) {
    return <Tooltip content={'Double-click to edit'}>{renderContent}</Tooltip>
  }

  return renderContent
}
