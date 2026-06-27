/* eslint-disable max-lines */
import { Box, Icon, InlineStack, Text } from '@shopify/polaris'
import { ChevronDownIcon, ChevronRightIcon, DragHandleIcon } from '@shopify/polaris-icons'
import { Fragment } from 'react'
import type { GroupableItem } from '../types'
import { getAncestorVisible } from '../fns'

interface GroupRendererProps {
  isGroupOpen: boolean
  isDraggable: boolean
  ancestorVisible?: boolean
  group: GroupableItem
  level: number
  queryValue: string
  highlightedItems: string[]
  id: string
  dragItem: boolean
  itemLabel: string
  actionRenderer: React.ReactNode
  groupItems: GroupableItem[]

  customRenderer: (
    group: GroupableItem,
    level: number,
    isDraggable: boolean,
    ancestorVisible?: boolean
  ) => React.ReactNode

  toggleGroup: (group: GroupableItem) => void
  isItemMatchQuery: (item: GroupableItem) => boolean
  getItemId: (item: GroupableItem) => string
  isGroup: (item: GroupableItem) => boolean
  getItemLabel: (item: GroupableItem) => string

  renderGroup: (group: GroupableItem, level: number, ancestorVisible?: boolean) => React.ReactNode
  renderItem: (item: GroupableItem, level: number, ancestorVisible?: boolean) => React.ReactNode
}

function GroupRenderer(props: GroupRendererProps) {
  const {
    isGroupOpen,
    group,
    level,
    ancestorVisible,
    highlightedItems,
    id,
    isDraggable,
    dragItem,
    itemLabel,
    actionRenderer,
    toggleGroup,
    isItemMatchQuery,
    getItemId,
    isGroup,
    customRenderer,
    groupItems,
    renderGroup,
    renderItem,
  } = props

  // Generate class name for the group HTML element
  const className = [
    group.visible ? '' : 'groupable--invisible',
    highlightedItems.includes(id) ? 'groupable--highlight' : '',
  ]
    .join(' ')
    .trim()

  // Get the ancestor visible status
  const _ancestorVisible = getAncestorVisible(ancestorVisible, group.visible)

  return (
    <li
      key={id}
      data-id={id}
      data-level={level}
      // @ts-ignore
      style={{ '--nested-level': level }}
      className={`groupable--item groupable--group ${className}`}
    >
      <div>
        <Box paddingBlock={'100'} paddingInline={'200'}>
          <InlineStack gap={'100'} align="space-between" blockAlign="center" wrap={false}>
            <InlineStack gap={'100'} align="start" blockAlign="center" wrap={false}>
              <span {...(isDraggable ? { draggable: true } : { className: 'non-draggable' })}>
                <Icon source={DragHandleIcon} />
              </span>
              <span className="groupable--group-toggler" onClick={() => toggleGroup(group)}>
                <Icon source={group.open ? ChevronDownIcon : ChevronRightIcon} />
              </span>
              <div
                data-item-type="group"
                data-item-visible={_ancestorVisible}
                className="groupable--item-label groupable--group-label"
              >
                {customRenderer ? (
                  customRenderer(group, level, !!dragItem, _ancestorVisible)
                ) : (
                  <Text variant="bodyMd" as="span">
                    {itemLabel}
                  </Text>
                )}
              </div>
            </InlineStack>
            {actionRenderer}
          </InlineStack>
        </Box>
      </div>

      {Boolean(isGroupOpen) && (
        <ul className="groupable--group-items-container">
          {groupItems
            .filter((item: GroupableItem) => isItemMatchQuery(item))
            .map((item: GroupableItem) => (
              <Fragment key={getItemId(item)}>
                {isGroup(item)
                  ? renderGroup(item, level + 1, _ancestorVisible)
                  : renderItem(item, level + 1, _ancestorVisible)}
              </Fragment>
            ))}
        </ul>
      )}
    </li>
  )
}

export default GroupRenderer
