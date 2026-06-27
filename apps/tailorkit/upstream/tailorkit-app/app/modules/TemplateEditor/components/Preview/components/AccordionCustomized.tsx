import { type ReactNode, useCallback } from 'react'

interface AccordionCustomizedProps {
  title: string
  content: ReactNode
  classNameHeader?: string
  /** Controlled mode: when provided, controls whether accordion is open.
   *  When omitted, falls back to uncontrolled <details open> (always open). */
  open?: boolean
  /** Called when user clicks the accordion header. Only used in controlled mode. */
  onToggle?: () => void
}

const AccordionCustomized = (props: AccordionCustomizedProps) => {
  const { title, content, classNameHeader, open, onToggle } = props
  const isControlled = open !== undefined

  // In controlled mode, prevent native <details> toggle and delegate to onToggle callback
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      if (isControlled) {
        e.preventDefault()
        onToggle?.()
      }
    },
    [isControlled, onToggle]
  )

  return (
    <details open={isControlled ? open : true}>
      <summary
        className={`${classNameHeader} emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between`}
        onClick={handleToggle}
      >
        <span> {title} </span>
        <span className="emtlkit--accordion-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M14.53 12.28a.75.75 0 0 1-1.06 0l-3.47-3.47-3.47 3.47a.75.75 0 0 1-1.06-1.06l4-4a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06Z"
            />
          </svg>
        </span>
      </summary>

      <div className="emtlkit--accordion-content">{content}</div>
    </details>
  )
}

export default AccordionCustomized
