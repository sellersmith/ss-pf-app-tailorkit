import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactQuill from 'react-quill-new'
import Quill from 'quill'
import { Attributor, Scope } from 'parchment'
import { TextGeneration } from './TextGeneration'
import { LinkModal } from './LinkModal'

// Modules object for setting up the Quill editor
export const EDITOR_TOOLBAR_MODULES = {
  toolbar: {
    container: '#toolbar',
    handlers: {
      link: () => {},
    },
  },
  history: {
    delay: 500,
    maxStack: 100,
    userOnly: true,
  },
}

// Formats objects for setting up the Quill editor
export const EDITOR_TOOLBAR_FORMATS = [
  'textGeneration',
  'header',
  'bold',
  'italic',
  'underline',
  'align',
  'strike',
  'background',
  'list',
  'bullet',
  'indent',
  'link',
  'target',
  'image',
  'color',
  'video',
]

// ---------------------------------------------------------------------------
// Quill: override default link behavior (target _blank) + add target attributor
// ---------------------------------------------------------------------------
let linkPatched = false

function ensureCustomLinkBlot() {
  if (linkPatched) {
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  const BaseQuill: any = (ReactQuill as any)?.Quill || (Quill as any)
  if (!BaseQuill?.import) {
    return
  }

  const QuillLink: any = BaseQuill.import('formats/link')
  if (!QuillLink) {
    return
  }

  // Persist link target in Delta and control rel logic
  class TargetAttributor extends Attributor {
    add(node: HTMLElement, value: string) {
      if (!value) {
        node.removeAttribute('target')
        node.removeAttribute('rel')

        return true
      }

      if (value === '_blank') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')

        return true
      }

      // Persist _self explicitly so Delta keeps intent
      node.setAttribute('target', '_self')
      node.removeAttribute('rel')

      return true
    }

    value(node: HTMLElement) {
      const target = node.getAttribute('target')

      return target === '_blank' ? '_blank' : '_self'
    }
  }

  class CustomLink extends QuillLink {
    static create(value: string) {
      const node = super.create(value) as HTMLElement

      // Do NOT force _blank; leave target unset unless user chooses otherwise
      node.removeAttribute('target')
      node.removeAttribute('rel')

      return node
    }
  }

  BaseQuill.register('formats/link', CustomLink as any, true)
  BaseQuill.register('formats/target', new TargetAttributor('target', 'target', { scope: Scope.INLINE }) as any, true)
  linkPatched = true
}

// Ensure custom link blot is applied
ensureCustomLinkBlot()

// Quill Toolbar component
export const QuillToolbar = ({
  quillRef,
  onChange,
  formats,
  toolbarId,
  plainTextPaste,
  extensions = [],
  showDivider = true,
}: {
  quillRef: React.RefObject<ReactQuill>
  onChange: (options: string[]) => void
  formats: string[]
  toolbarId: string
  plainTextPaste?: boolean
  extensions?: Array<{
    type: string
    render: (api: {
      insertText: (value: string) => void
      getSelectionText: () => string
      close: () => void
    }) => React.ReactNode
  }>
  showDivider?: boolean
}) => {
  const { t } = useTranslation()
  const [canLink, setCanLink] = useState(false)
  const lastRangeRef = useRef<{ index: number; length: number } | null>(null)
  const [linkModalState, setLinkModalState] = useState<{
    open: boolean
    url: string
    target: '_self' | '_blank'
    range: { index: number; length: number } | null
  }>({
    open: false,
    url: '',
    target: '_self',
    range: null,
  })
  const dividerClassName = showDivider ? 'ql-formats-divider' : ''
  const qlClassName = `ql-formats${dividerClassName ? ` ${dividerClassName}` : ''}`

  const getQuill = useCallback(() => {
    const instance = quillRef.current as any
    if (!instance) return null
    return typeof instance.getEditor === 'function' ? instance.getEditor() : instance
  }, [quillRef])

  /**
   * Keep track of whether the current selection has text to enable link actions.
   */
  useEffect(() => {
    const quill = getQuill()
    if (!quill || typeof quill.on !== 'function' || typeof quill.off !== 'function') return

    const updateSelectionState = () => {
      const range = quill.getSelection()
      if (!range) {
        setCanLink(false)
        return
      }
      lastRangeRef.current = range
      if (range.length > 0) {
        setCanLink(true)
        return
      }
      // If cursor is inside an existing link, still allow edit
      const [leaf] = quill.getLeaf(range.index)
      const anchor = leaf?.domNode?.parentElement
      setCanLink(!!anchor && anchor.tagName === 'A')
    }

    quill.on('selection-change', updateSelectionState)
    quill.on('text-change', updateSelectionState)

    updateSelectionState()

    return () => {
      quill.off('selection-change', updateSelectionState)
      quill.off('text-change', updateSelectionState)
    }
  }, [getQuill, quillRef])

  useEffect(() => {
    if (!plainTextPaste) return
    if (typeof window === 'undefined') return
    const quill = getQuill()
    if (!quill || !(quill as any).clipboard) return

    const BaseQuill: any = (ReactQuill as any)?.Quill || (Quill as any)
    const Delta = BaseQuill.import?.('delta')
    if (!Delta) return

    const matcher = (node: any) => {
      const textContent = (node && node.textContent) || ''
      return new Delta().insert(textContent)
    }

    ;(quill as any).clipboard.addMatcher(Node.ELEMENT_NODE, matcher)
  }, [getQuill, plainTextPaste, quillRef])

  /**
   * Extracts link context from the current Quill selection.
   * Determines if the selection is within an existing link and returns
   * the link's URL, target, and range.
   *
   * @param range - The current selection range
   * @returns Link context or null if no valid context
   */
  const extractLinkContext = useCallback(
    (range: { index: number; length: number }) => {
      const quill = getQuill()
      if (!quill) return null
      const [leaf, offset] = quill.getLeaf(range.index)
      const anchor = (leaf as any)?.parent?.domNode as HTMLElement | undefined
      const hasAnchor = !!anchor && anchor.tagName === 'A'

      if (!hasAnchor) {
        if (range.length === 0) return null
        return {
          url: '',
          target: '_self' as '_self' | '_blank',
          range,
        }
      }
      const leafLength = typeof (leaf as any)?.length === 'function' ? (leaf as any).length() : range.length || 0
      const linkRange = {
        index: range.index - (offset || 0),
        length: leafLength || range.length || 0,
      }
      const currentUrl = anchor?.getAttribute('href') || ''
      const tgt = anchor?.getAttribute('target')
      const currentTarget: '_self' | '_blank' = tgt === '_blank' ? '_blank' : '_self'

      return { url: currentUrl, target: currentTarget, range: linkRange }
    },
    [getQuill]
  )

  const handleOpenLinkModal = useCallback(() => {
    const quill = getQuill()
    if (!quill) return
    const selection = quill.getSelection() || lastRangeRef.current
    if (!selection) return

    const ctx = extractLinkContext(selection)
    if (!ctx) return

    setLinkModalState({
      open: true,
      url: ctx.url,
      target: ctx.target,
      range: ctx.range,
    })
    // Hide Quill default tooltip if any
    if ((quill as any)?.theme?.tooltip?.hide) {
      ;(quill as any).theme.tooltip.hide()
    }
  }, [extractLinkContext, getQuill])

  /**
   * Intercept Quill tooltip edit/remove buttons to use our modal/remove.
   */
  useEffect(() => {
    const quill = getQuill()
    if (!quill) return
    let tooltipRoot = (quill as any)?.theme?.tooltip?.root
    tooltipRoot = tooltipRoot || quill.root?.parentElement?.querySelector('.ql-tooltip')
    tooltipRoot = tooltipRoot || document.querySelector('.ql-tooltip')

    if (!tooltipRoot) return

    const handleTooltipClick = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const isEdit = target.classList.contains('ql-action')
      const isRemove = target.classList.contains('ql-remove')
      if (!isEdit && !isRemove) return

      event.preventDefault()
      event.stopPropagation()

      const range = quill.getSelection() || lastRangeRef.current
      if (!range) return
      const ctx = extractLinkContext(range)

      if (isRemove) {
        const targetRange = ctx?.range || range
        quill.setSelection(targetRange)
        quill.format('link', false)
        ;(quill as any)?.theme?.tooltip?.hide?.()
        return
      }

      if (ctx) {
        setLinkModalState({
          open: true,
          url: ctx.url,
          target: ctx.target,
          range: ctx.range,
        })
        ;(quill as any)?.theme?.tooltip?.hide?.()
      }
    }

    tooltipRoot.addEventListener('click', handleTooltipClick, true)
    tooltipRoot.addEventListener('mousedown', handleTooltipClick, true)
    return () => {
      tooltipRoot.removeEventListener('click', handleTooltipClick, true)
      tooltipRoot.removeEventListener('mousedown', handleTooltipClick, true)
    }
  }, [quillRef, extractLinkContext, getQuill])

  const applyLink = ({ url, target }: { url: string; target: '_self' | '_blank' }) => {
    const quill = getQuill()
    if (!quill) return
    const range = linkModalState.range || quill.getSelection()
    if (!range) return

    quill.setSelection(range)
    if (!url.trim()) {
      quill.format('link', false)
      setLinkModalState(prev => ({ ...prev, open: false }))
      return
    }

    quill.format('link', url)
    const targetValue = target === '_blank' ? '_blank' : '_self'
    quill.format('target', targetValue)

    setLinkModalState(prev => ({ ...prev, open: false }))
  }

  const removeLink = () => {
    const quill = getQuill()
    if (!quill) return
    const range = linkModalState.range || quill.getSelection()
    if (!range) return
    quill.setSelection(range)
    quill.format('link', false)
    setLinkModalState(prev => ({ ...prev, open: false }))
  }

  const hasFormat = (format: string) => formats.includes(format)
  const showTextFormats = ['bold', 'italic', 'underline', 'strike'].some(hasFormat)
  const showListFormats = ['list', 'bullet', 'indent'].some(hasFormat)
  const showAlignColorFormats = ['align', 'color', 'background'].some(hasFormat)
  const showMediaFormats = ['link', 'image', 'video'].some(hasFormat)
  const showHeader = hasFormat('header')
  const showTextGen = hasFormat('textGeneration')

  return (
    <div id={toolbarId}>
      {showTextGen && (
        <span className={qlClassName}>
          <TextGeneration editor={quillRef.current!} onSelectOptionAfterGenerating={onChange} />
        </span>
      )}

      {showHeader && (
        <span className={qlClassName}>
          <select className="ql-header" defaultValue="3">
            <option value="1">{t('heading')}</option>
            <option value="2">{t('subheading')}</option>
            <option value="3">{t('normal')}</option>
          </select>
        </span>
      )}

      {showTextFormats && (
        <span className={qlClassName}>
          {hasFormat('bold') && <button className="ql-bold" />}
          {hasFormat('italic') && <button className="ql-italic" />}
          {hasFormat('underline') && <button className="ql-underline" />}
          {hasFormat('strike') && <button className="ql-strike" />}
        </span>
      )}

      {showListFormats && (
        <span className={qlClassName}>
          {hasFormat('list') && <button className="ql-list" value="ordered" />}
          {hasFormat('bullet') && <button className="ql-list" value="bullet" />}
          {hasFormat('indent') && <button className="ql-indent" value="-1" />}
          {hasFormat('indent') && <button className="ql-indent" value="+1" />}
        </span>
      )}

      {showAlignColorFormats && (
        <span className={qlClassName}>
          {hasFormat('align') && <select className="ql-align" />}
          {hasFormat('color') && <select className="ql-color" />}
          {hasFormat('background') && <select className="ql-background" />}
        </span>
      )}

      {showMediaFormats && (
        <span className={qlClassName}>
          {hasFormat('link') && (
            <button
              type="button"
              className="ql-link ql-link-custom"
              disabled={!canLink}
              onClick={event => {
                event.preventDefault()
                event.stopPropagation()
                handleOpenLinkModal()
              }}
              aria-label={t('link')}
            />
          )}
          {hasFormat('image') && <button className="ql-image" />}
          {hasFormat('video') && <button className="ql-video" />}
        </span>
      )}

      {extensions.map((ext, index) => {
        const quill = getQuill()
        const insertText = (value: string) => {
          if (!quill || !value) return
          const range = quill.getSelection(true)
          const idx = range ? range.index : 0
          quill.insertText(idx, value)
          quill.setSelection(idx + value.length, 0)
        }
        const getSelectionText = () => {
          if (!quill) return ''
          const range = quill.getSelection()
          if (!range || range.length === 0) return ''
          return quill.getText(range.index, range.length)
        }
        const api = {
          insertText,
          getSelectionText,
          close: () => {},
        }
        return (
          <span className={qlClassName} key={`${ext.type}-${index}`}>
            {ext.render(api)}
          </span>
        )
      })}

      <LinkModal
        state={linkModalState}
        onClose={() => setLinkModalState(prev => ({ ...prev, open: false }))}
        onSave={applyLink}
        onRemove={removeLink}
      />
    </div>
  )
}

export default QuillToolbar
