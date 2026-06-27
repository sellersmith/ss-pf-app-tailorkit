/** @jsxImportSource preact */
import { h, render } from 'preact'
import { ColourGuideModal, type ColourGuideOption } from './ColourGuideModal'

/**
 * Singleton host that mounts the ColourGuideModal into document.body on demand.
 *
 * Vanilla web components can't render Preact JSX inline, so this helper provides
 * an imperative `openColourGuideModal()` callable from plain-TS swatch elements.
 * Mounts a single host container the first time a modal is requested, then reuses
 * it for subsequent opens (one modal at a time — the most recent call wins).
 */

interface OpenArgs {
  imageUrl: string
  description?: string
  optionSetLabel?: string
  options: ColourGuideOption[]
}

const HOST_ID = 'tailorkit-colour-guide-host'

function getOrCreateHost(): HTMLElement {
  let host = document.getElementById(HOST_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = HOST_ID
    document.body.appendChild(host)
  }
  return host
}

function renderModal(args: OpenArgs | null): void {
  const host = getOrCreateHost()
  if (!args) {
    render(null, host)
    return
  }
  render(
    h(ColourGuideModal, {
      open: true,
      onClose: () => renderModal(null),
      imageUrl: args.imageUrl,
      description: args.description,
      optionSetLabel: args.optionSetLabel,
      options: args.options,
    }),
    host
  )
}

export function openColourGuideModal(args: OpenArgs): void {
  renderModal(args)
}
