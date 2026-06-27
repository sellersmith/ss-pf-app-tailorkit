import { Box, Icon, InlineStack, Text } from '@shopify/polaris'
import { DragHandleIcon } from '@shopify/polaris-icons'
import React, { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react'
import type { GroupableItem } from '../types'
import { getAncestorVisible } from '../fns'

interface ItemRendererProps {
  id: string
  item: GroupableItem
  ancestorVisible?: boolean
  level: number
  highlightedItems: string[]
  checkedItems: string[]
  dragItem: boolean
  renderItem: (item: GroupableItem, level: number, dragItem: boolean, ancestorVisible?: boolean) => React.ReactNode
  isDraggable: boolean
  itemLabel: string
  actionRenderer: React.ReactNode
}

export const ItemRenderer = (props: ItemRendererProps) => {
  const {
    id,
    item,
    ancestorVisible,
    level,
    highlightedItems,
    checkedItems,
    renderItem,
    isDraggable,
    itemLabel,
    actionRenderer,
    dragItem,
  } = props

  const itemRef = useRef<HTMLLIElement>(null)
  const [isVisible, setIsVisible] = useState(true)

  // Generate class name for the item HTML element
  const className = useMemo(
    () =>
      [
        item.visible ? '' : 'groupable--invisible',
        checkedItems.includes(id) ? 'groupable--highlight' : '',
        highlightedItems.includes(id) ? 'groupable--highlight-caution' : '',
      ]
        .join(' ')
        .trim(),
    [item.visible, checkedItems, highlightedItems, id]
  )

  useEffect(() => {
    if (!itemRef.current) {
      return
    }

    // Observe the item element if this item is showing or disappearing on screen
    // If it is disappearing, we need to remove the item DOM inside the list element
    // If it is showing, we need to add the item DOM inside the list element
    // This action to perform large items.
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add the item DOM inside the list element
          setIsVisible(true)
        } else {
          // Remove the item DOM inside the list element
          setIsVisible(false)
        }
      })
    })

    observer.observe(itemRef.current)

    return () => observer.disconnect()
  }, [])

  // Get the ancestor visible status
  const _ancestorVisible = getAncestorVisible(ancestorVisible, item.visible)

  const renderChildren = () => (
    <ItemContainer>
      {isVisible ? (
        <Fragment>
          <div style={{ width: '100%' }}>
            <InlineStack gap={'100'} align="start" blockAlign="center" wrap={false}>
              <span {...(isDraggable ? { draggable: true } : { className: 'non-draggable' })}>
                <Icon source={DragHandleIcon} />
              </span>
              <div
                data-item-type={item.type}
                data-item-visible={_ancestorVisible}
                className={`groupable--item-label${item.visible ? '' : ' groupable--invisible'}`}
              >
                {renderItem ? (
                  renderItem(item, level, !!dragItem, _ancestorVisible)
                ) : (
                  <Text variant="bodyMd" as="span">
                    {itemLabel}
                  </Text>
                )}
              </div>
            </InlineStack>
          </div>
          {actionRenderer}
        </Fragment>
      ) : (
        <VirtualItem />
      )}
    </ItemContainer>
  )

  return (
    <li
      ref={itemRef}
      key={id}
      data-id={id}
      data-level={level}
      // @ts-ignore
      style={{ '--nested-level': level }}
      className={`groupable--item ${className} ${item.locked ? 'groupable--item-locked' : ''} ${item.visible ? '' : 'groupable--item-invisible'}`}
    >
      {renderChildren()}
    </li>
  )
}

const ItemContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box paddingBlock={'100'} paddingInline={'200'}>
      <InlineStack gap={'100'} align="space-between" blockAlign="center" wrap={false}>
        {children}
      </InlineStack>
    </Box>
  )
}

const VirtualItem = memo(
  function VirtualItem() {
    return <div style={{ height: '28px', width: '100%', visibility: 'hidden' }}>Virtual Item</div>
  },
  () => {
    return true
  }
)
