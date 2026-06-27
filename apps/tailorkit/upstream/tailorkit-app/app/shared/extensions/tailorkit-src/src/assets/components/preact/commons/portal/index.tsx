/** @jsxImportSource preact */
import { render } from 'preact'
import type { ComponentChildren, VNode } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

/**
 * Pure Preact portal – renders children into document.body without preact/compat.
 * Creates a wrapper <div data-emtlkit-portal> so the content escapes overflow/stacking contexts.
 */
export function Portal({ children }: { children: ComponentChildren }) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  if (!containerRef.current) {
    containerRef.current = document.createElement('div')
    containerRef.current.setAttribute('data-emtlkit-portal', '')
  }

  useLayoutEffect(() => {
    const container = containerRef.current!
    document.body.appendChild(container)
    return () => {
      render(null, container)
      container.remove()
    }
  }, [])

  // useLayoutEffect ensures children are rendered synchronously before paint,
  // so parent components' useLayoutEffect hooks see populated refs.
  // This matches the behavior of preact/compat's createPortal.
  useLayoutEffect(() => {
    if (containerRef.current) {
      render(children as VNode, containerRef.current)
    }
  })

  return null
}
