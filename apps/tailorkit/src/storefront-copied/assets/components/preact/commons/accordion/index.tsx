/* eslint-disable max-len */
/** @jsxImportSource preact */
import { useCallback, useRef, useState } from 'preact/hooks'
import { useLocalStorage } from '../../../../libraries/useLocalStorage'

export type AccordionProps = {
  id: string
  label: string | any
  tooltip?: string
  open: boolean
  content: any
  borderColor?: string
  className?: string
  style?: any
  hideDivider?: boolean
  paddingBlockEnd?: string
  rememberState?: boolean
}

export type AccordionListProps = {
  style?: any
  hideDivider?: boolean
  rememberState?: boolean
  paddingBlockEnd?: string
  items: AccordionProps[]
}

const TRANSITION_DURATION = 250

export function Accordion(props: AccordionProps) {
  const {
    id,
    className,
    open,
    label,
    content,
    borderColor = '#e5e7eb',
    tooltip,
    style,
    hideDivider,
    paddingBlockEnd = '1rem',
    rememberState = true,
  } = props

  // Use localStorage to persist accordion state with a unique key based on id
  // Store as collapsed state (inverse of open), defaulting to the inverse of the open prop
  const [opened, setOpened] = useState(open)
  const [collapsed, setCollapsed] = useLocalStorage(`accordion_collapsed_${id}`, !open)
  const ref = useRef<HTMLDivElement>(null)

  const scrollIntoView = useCallback(() => {
    const element = ref.current
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  const toggleAccordion = useCallback(() => {
    rememberState ? setCollapsed(!collapsed) : setOpened(!opened)

    setTimeout(() => {
      scrollIntoView()
    }, TRANSITION_DURATION + 16)
  }, [collapsed, opened, rememberState, scrollIntoView, setCollapsed])

  return (
    <div className={className} style={style}>
      <div
        style={{
          ...(!hideDivider && {
            borderBottom: `1px solid ${borderColor}`,
          }),
        }}
      >
        <div className="emtlkit--collapsible">
          <div style={{ padding: '0.75rem 1rem' }}>
            <div
              id={id}
              onClick={toggleAccordion}
              style={{
                cursor: 'pointer',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {label}
                {tooltip && (
                  <div
                    title={tooltip}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: '#6b7280',
                      cursor: 'help',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" // eslint-disable-line max-len
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div style={{ color: '#6b7280' }}>
                {(rememberState && collapsed) || !opened ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />{' '}
                    {/* eslint-disable-line max-len */}
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
                      clipRule="evenodd"
                    />{' '}
                    {/* eslint-disable-line max-len */}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ paddingLeft: '1rem', paddingRight: '1rem' }} id={`collapsible-container__${id}`}>
          <div
            id={id}
            style={{
              maxHeight: (rememberState && !collapsed) || opened ? '1000px' : '0',
              overflow: 'hidden',
              transition: `max-height ${TRANSITION_DURATION}ms ease-in-out`,
              paddingBottom: (rememberState && !collapsed) || opened ? paddingBlockEnd : '0',
            }}
          >
            {content}
          </div>
        </div>
      </div>
      <div ref={ref} />
    </div>
  )
}

export function AccordionList(props: AccordionListProps) {
  const { items, style, hideDivider, rememberState, paddingBlockEnd } = props
  return items?.map(item => (
    <Accordion
      key={item.id}
      style={style}
      hideDivider={hideDivider}
      rememberState={rememberState}
      paddingBlockEnd={paddingBlockEnd}
      {...item}
    />
  ))
}

export default Accordion
