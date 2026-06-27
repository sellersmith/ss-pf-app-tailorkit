const MutationObserver = window.MutationObserver || window.WebKitMutationObserver
export function observeDOM(obj: Node, callback: any): Function | null {
  if (!obj || obj.nodeType !== 1) return null

  if (MutationObserver) {
    // define a new observer
    const mutationObserver = new MutationObserver(callback)

    // have the observer observe for changes in children
    mutationObserver.observe(obj, { childList: true, subtree: true })
    return () => {
      mutationObserver.disconnect()
    }
  }

  // browser support fallback
  if (typeof window.addEventListener === 'function') {
    obj.addEventListener('DOMNodeInserted', callback, false)
    obj.addEventListener('DOMNodeRemoved', callback, false)
    return () => {
      obj.removeEventListener('DOMNodeInserted', callback, false)
      obj.removeEventListener('DOMNodeRemoved', callback, false)
    }
  }
  return null
}
