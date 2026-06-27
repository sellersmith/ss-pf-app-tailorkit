import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ChevronDownIcon, ChevronUpIcon, InfoIcon } from '@shopify/polaris-icons'
import { Box, Collapsible, Icon, InlineStack, Text, Tooltip } from '@shopify/polaris'
import type { ColorBorderAlias } from '@shopify/polaris-tokens'
import { useLocalStorage } from '~/utils/hooks/useLocalStorage'
import useDevices from '~/utils/hooks/useDevice'

export type AccordionProps = {
  id: string
  label: string | ReactNode
  tooltip?: string
  open: boolean
  content: ReactNode
  borderColor?: ColorBorderAlias | 'transparent'
  className?: string
  style?: any
  hideDivider?: boolean
  paddingBlockEnd?: string
  rememberState?: boolean
  isControlled?: boolean
  onToggle?: (id: string) => void
}

export type AccordionListProps = {
  style?: any
  hideDivider?: boolean
  rememberState?: boolean
  paddingBlockEnd?: string
  items: AccordionProps[]
  exclusiveOpen?: boolean
  defaultOpenId?: string
  groupId?: string
}

const TRANSITION_DURATION = 250

export function Accordion(props: AccordionProps) {
  const {
    id,
    className,
    open,
    label,
    content,
    borderColor = 'border',
    tooltip,
    style,
    hideDivider,
    paddingBlockEnd = '400',
    rememberState = false,
    isControlled = false,
    onToggle,
  } = props

  const { isMobileView } = useDevices()

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
    if (isControlled) {
      // Controlled mode: notify parent
      onToggle?.(id)

      // Scroll into view when opening
      const willOpen = !open
      if (willOpen && !isMobileView) {
        setTimeout(() => {
          scrollIntoView()
        }, TRANSITION_DURATION + 16)
      }
    } else {
      // Uncontrolled mode: manage own state
      rememberState ? setCollapsed(!collapsed) : setOpened(!opened)

      // Only scroll into view when opening, not closing
      // and skip auto-scroll on mobile devices to prevent jarring UX
      const isOpening = rememberState ? collapsed : !opened

      if (isOpening && !isMobileView) {
        setTimeout(() => {
          scrollIntoView()
        }, TRANSITION_DURATION + 16)
      }
    }
  }, [id, isControlled, onToggle, open, collapsed, opened, rememberState, scrollIntoView, setCollapsed, isMobileView])

  return (
    <div className={className} style={style}>
      <Box {...(hideDivider ? {} : { borderBlockEndWidth: '025', borderColor: borderColor })}>
        <div className="emtlkit-collapsible">
          <Box paddingBlock={'300'} paddingInline={'400'}>
            <div id={id} onClick={toggleAccordion} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <InlineStack blockAlign="center" align="space-between">
                <InlineStack gap="200">
                  {typeof label === 'string' ? (
                    <Text variant="headingMd" fontWeight="medium" as="p">
                      {label}
                    </Text>
                  ) : (
                    label
                  )}
                  <s-box>
                    {tooltip && (
                      <Tooltip content={tooltip}>
                        <Icon source={InfoIcon} />
                      </Tooltip>
                    )}
                  </s-box>
                </InlineStack>
                <div>
                  {isControlled ? (
                    open ? (
                      <Icon source={ChevronUpIcon} tone="base" />
                    ) : (
                      <Icon source={ChevronDownIcon} tone="base" />
                    )
                  ) : (rememberState && collapsed) || (!rememberState && !opened) ? (
                    <Icon source={ChevronDownIcon} tone="base" />
                  ) : (
                    <Icon source={ChevronUpIcon} tone="base" />
                  )}
                </div>
              </InlineStack>
            </div>
          </Box>
        </div>

        <Box paddingInline={'400'} id={`collapsible-container__${id}`}>
          <Collapsible
            id={id}
            expandOnPrint
            open={isControlled ? open : (rememberState && !collapsed) || opened}
            transition={{ duration: `${TRANSITION_DURATION}ms`, timingFunction: 'ease-in-out' }}
          >
            {/* @ts-ignore */}
            <Box paddingBlockEnd={paddingBlockEnd}>{content}</Box>
          </Collapsible>
        </Box>
      </Box>
      <div ref={ref} />
    </div>
  )
}

export function AccordionList(props: AccordionListProps) {
  const {
    items,
    style,
    hideDivider,
    rememberState,
    paddingBlockEnd,
    exclusiveOpen = false,
    defaultOpenId,
    groupId = 'default',
  } = props

  // Determine default open ID
  const getDefaultOpenId = useCallback(() => {
    if (defaultOpenId) return defaultOpenId
    const firstOpenItem = items?.find(item => item.open)
    return firstOpenItem?.id || items?.[0]?.id || ''
  }, [items, defaultOpenId])

  // Manage state for exclusive mode
  const [openAccordionId, setOpenAccordionId] = useLocalStorage(
    `accordion_group_${groupId}_open_id`,
    getDefaultOpenId()
  )

  const handleToggle = useCallback(
    (id: string) => {
      setOpenAccordionId((prevId: string) => (prevId === id ? '' : id))
    },
    [setOpenAccordionId]
  )

  // If not in exclusive mode, render as before (backward compatible)
  if (!exclusiveOpen) {
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

  // Exclusive mode: controlled accordions
  return items?.map(item => (
    <Accordion
      key={item.id}
      style={style}
      hideDivider={hideDivider}
      paddingBlockEnd={paddingBlockEnd}
      {...item}
      open={openAccordionId === item.id}
      isControlled={true}
      onToggle={handleToggle}
      rememberState={false} // Disable individual persistence in exclusive mode
    />
  ))
}
