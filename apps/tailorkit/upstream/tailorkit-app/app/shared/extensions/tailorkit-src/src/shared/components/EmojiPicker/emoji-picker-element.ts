import { emojiPickerStyles } from './emoji-picker-styles'
import { splitGraphemes } from '../../utils/grapheme-utils'
import { FontLoader } from '../../../assets/utils/font-loader'

/** Shared font loader instance for emoji picker (avoids circular import from barrel) */
const emojiFontLoader = new FontLoader()

/**
 * <tailorkit-emoji-picker> — Inline emoji row (always visible, no popover).
 * Renders configured emojis as clickable buttons below the text input.
 * Dispatches `emoji-select` custom event when an emoji is clicked.
 *
 * Supports custom fonts via `data-font-family` and `data-font-src` attributes
 * for rendering private-use-area characters (e.g., monogram icon fonts).
 */
// Collapse the emoji row behind a "View all" toggle once the count exceeds
// this threshold — keeps the picker compact for merchants with many emojis.
const VISIBLE_THRESHOLD = 8

export class EmojiPickerElement extends HTMLElement {
  private emojis: string[] = []
  private mounted = false
  private fontFamily: string | null = null
  private fontSrc: string | null = null
  private isExpanded = false

  static get observedAttributes() {
    return ['data-emojis', 'data-font-family', 'data-font-src']
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null) {
    if (name === 'data-emojis') {
      this.emojis = newVal ? splitGraphemes(newVal) : []
      if (this.mounted) this.render()
    }
    if (name === 'data-font-family') {
      this.fontFamily = newVal
      if (this.mounted) this.loadFontAndRender()
    }
    if (name === 'data-font-src') {
      this.fontSrc = newVal
      if (this.mounted) this.loadFontAndRender()
    }
  }

  connectedCallback() {
    if (this.mounted) return
    this.mounted = true
    this.injectStyles()
    this.emojis = splitGraphemes(this.getAttribute('data-emojis') || '')
    this.fontFamily = this.getAttribute('data-font-family')
    this.fontSrc = this.getAttribute('data-font-src')
    if (this.emojis.length === 0) return
    this.loadFontAndRender()
  }

  disconnectedCallback() {
    this.mounted = false
  }

  /** Load custom font (if configured) then render emoji buttons */
  private loadFontAndRender() {
    if (this.fontFamily && this.fontSrc) {
      emojiFontLoader.loadFont(this.fontFamily, this.fontSrc).then(() => {
        if (this.mounted) this.render()
      })
    } else {
      this.render()
    }
  }

  private injectStyles() {
    if (document.getElementById('tlk-emoji-picker-styles')) return
    const style = document.createElement('style')
    style.id = 'tlk-emoji-picker-styles'
    style.textContent = emojiPickerStyles
    document.head.appendChild(style)
  }

  private render() {
    this.innerHTML = ''
    const row = document.createElement('div')
    row.className = 'emtlkit-emoji-picker-row'

    const total = this.emojis.length
    const canCollapse = total > VISIBLE_THRESHOLD
    const visible = canCollapse && !this.isExpanded ? this.emojis.slice(0, VISIBLE_THRESHOLD) : this.emojis

    for (const emoji of visible) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'emtlkit-emoji-item'
      btn.textContent = emoji
      btn.setAttribute('aria-label', `Insert ${emoji}`)
      if (this.fontFamily) {
        btn.style.setProperty('font-family', `'${this.fontFamily}'`, 'important')
      }
      btn.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        this.dispatchEvent(new CustomEvent('emoji-select', { detail: { emoji }, bubbles: true }))
      })
      row.appendChild(btn)
    }

    this.appendChild(row)

    if (canCollapse) {
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'emtlkit-view-all-toggle'
      toggle.textContent = this.isExpanded ? 'Show less' : `View all (${total})`
      toggle.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        this.isExpanded = !this.isExpanded
        this.render()
      })
      this.appendChild(toggle)
    }
  }
}
