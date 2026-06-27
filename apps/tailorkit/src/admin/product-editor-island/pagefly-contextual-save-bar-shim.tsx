// PageFly shim for the copied TailorKit `~/components/ContextualSaveBar`.
//
// Upstream ContextualSaveBar imports `{ SaveBar, useAppBridge }` from `@shopify/app-bridge-react`. The
// app-platform admin runtime does NOT mount the app-bridge-react React provider, so `useAppBridge()` throws
// at mount. This shim renders the same declarative `<ui-save-bar>` App Bridge web component (registered by
// the App Bridge CDN script Shopify injects into every embedded app) and drives show/hide through the
// PageFly-owned `window.shopify` global via the existing pagefly-shopify-shim — keeping the app-bridge-react
// React wrapper (and its provider requirement) out of the copied bundle.
//
// Same prop interface as upstream so the shell's `onSave`/`onDiscard`/`isOpen`/`loading` pass through
// unchanged. onSave/onDiscard are the SaleToolsSaveBar provider's triggerSave/triggerDiscard (already wired
// to the active tab's handler), so the shim only owns visibility + button wiring.
import React from 'react'
import { CONTEXTUAL_SAVE_BAR_ID } from '../../../upstream/tailorkit-app/app/constants'
import { closeSaveBar, openSaveBar } from './pagefly-shopify-shim'

export type ContextualSaveBar = {
  isOpen: boolean
  showPageAction?: boolean
  onDiscard: () => void
  onSave: () => void
  loading?: boolean
}

export default function ContextualSaveBar(props: ContextualSaveBar) {
  const { isOpen, onDiscard, onSave, loading } = props
  const hasShownRef = React.useRef(false)

  React.useEffect(() => {
    if (isOpen) {
      hasShownRef.current = true
      openSaveBar(CONTEXTUAL_SAVE_BAR_ID)
    } else if (hasShownRef.current) {
      // Only hide if it was ever shown — calling `.hide` on a never-shown bar (e.g. the initial mount with
      // isOpen=false) just yields a spurious "not found" rejection the shim now swallows, but skipping it is
      // cleaner and avoids racing the element's first commit.
      closeSaveBar(CONTEXTUAL_SAVE_BAR_ID)
    }

    return () => {
      if (hasShownRef.current) closeSaveBar(CONTEXTUAL_SAVE_BAR_ID)
    }
  }, [isOpen, loading])

  // Declarative App Bridge save-bar web component. `window.shopify.saveBar.show(id)` (via openSaveBar)
  // targets this element by id. Children mirror upstream: empty-text buttons App Bridge labels by role.
  return React.createElement(
    'ui-save-bar' as unknown as 'div',
    { id: CONTEXTUAL_SAVE_BAR_ID },
    React.createElement('button', {
      variant: 'primary',
      onClick: onSave,
      loading: loading ? '' : undefined,
    } as React.ButtonHTMLAttributes<HTMLButtonElement>),
    React.createElement('button', { onClick: onDiscard, disabled: loading })
  )
}
