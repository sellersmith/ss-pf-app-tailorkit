import { useMemo, type ReactNode } from 'react'
import { Box, Button, Divider, InlineStack, Scrollable } from '@shopify/polaris'

export type TabListProps = {
  items: {
    id: string
    label: string
    content: ReactNode
    disabled?: boolean
    role?: string
  }[]
  showTabHeaders?: boolean
  selected?: number | string
  scrollableContainerHeight?: number | string
  setSelectedTab: (val: any) => void
}

export default function TabList(props: TabListProps) {
  const { items, selected, scrollableContainerHeight, setSelectedTab, showTabHeaders = true } = props
  const LABEL_BLOCK_HEIGHT = 52

  const _selected = useMemo(() => {
    if (selected) {
      if (typeof selected === 'number') {
        return selected
      }

      for (let i = 0; i < items.length; i++) {
        if (items[i].label === selected) {
          return i
        }
      }
    }

    return 0
  }, [items, selected])

  /**
   * Calculate the scrollable container height based on the input type and showLabel prop
   * @returns {string} The calculated height as a CSS value
   */
  const calculateScrollableHeight = useMemo(() => {
    if (!scrollableContainerHeight) return undefined

    if (typeof scrollableContainerHeight === 'number') {
      return `${scrollableContainerHeight + (!showTabHeaders ? LABEL_BLOCK_HEIGHT : 0)}px`
    }

    // Handle calc() string values
    if (typeof scrollableContainerHeight === 'string' && scrollableContainerHeight.trim().startsWith('calc(')) {
      // Extract the expression inside calc() using regex
      const calcExpression = scrollableContainerHeight.match(/calc\((.*)\)/)?.[1]

      if (!calcExpression) return scrollableContainerHeight

      return !showTabHeaders ? `calc(${calcExpression} + ${LABEL_BLOCK_HEIGHT}px)` : scrollableContainerHeight
    }

    return scrollableContainerHeight
  }, [scrollableContainerHeight, showTabHeaders])

  return (
    <>
      {showTabHeaders && (
        <>
          <Box paddingBlock={'300'} paddingInline={'200'}>
            <InlineStack gap={'050'}>
              {items.map((tab, index) => {
                const { id, label, disabled, role } = tab

                return (
                  <Button
                    key={id}
                    id={id}
                    variant="tertiary"
                    pressed={_selected === index}
                    onClick={() => setSelectedTab(index)}
                    disabled={disabled}
                    role={role}
                  >
                    {label}
                  </Button>
                )
              })}
            </InlineStack>
          </Box>

          <Divider />
        </>
      )}

      <Scrollable
        style={{
          height: calculateScrollableHeight,
        }}
      >
        {items[_selected]?.content}
      </Scrollable>
    </>
  )
}
