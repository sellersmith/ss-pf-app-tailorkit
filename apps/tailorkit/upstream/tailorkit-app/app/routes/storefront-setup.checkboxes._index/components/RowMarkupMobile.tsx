import {
  ActionList,
  Badge,
  BlockStack,
  Box,
  Button,
  IndexTable,
  InlineStack,
  Link,
  Popover,
  Text,
} from '@shopify/polaris'
import { MenuHorizontalIcon } from '@shopify/polaris-icons'
import { useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { useCallback, useState } from 'react'
import { getDistanceToNow } from '~/bootstrap/fns/time'
import { EPlacementType } from '~/enums/checkbox'
import type { CheckboxDocument } from '~/types/checkbox'

interface RowMarkupMobileProps {
  checkbox: CheckboxDocument
  index: number
  selectedResources?: string[]
  tableRef?: any
  onDuplicate: (selectedIds: string[]) => void
  onDelete: (selectedIds: string[]) => void
  onActivate: (selectedIds: string[]) => void
  onDeactivate: (selectedIds: string[]) => void
}

/**
 * Maps placement type enum to display text
 */
function mapPlacement(typePlacement: string | null): string {
  switch (typePlacement) {
    case EPlacementType.CART:
      return 'Cart'
    case EPlacementType.PRODUCT_PAGE:
      return 'Product page'
    case EPlacementType.PRODUCT_DETAILS:
      return 'Product details'
    default:
      return 'Not set'
  }
}

export default function RowMarkupMobile(props: RowMarkupMobileProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { checkbox, index, selectedResources, tableRef, onDuplicate, onDelete, onActivate, onDeactivate } = props
  const { _id, title, isActive, typePlacement, updatedAt } = checkbox
  const [menuPopoverActive, setMenuPopoverActive] = useState(false)

  const toggleMenuPopover = useCallback(() => {
    setMenuPopoverActive(prev => !prev)
  }, [])

  const handleRowClick = () => {
    navigate(`/storefront-setup/checkboxes/edit/${_id}`)
  }

  const actionItems = [
    {
      content: isActive ? t('set-as-draft') : t('set-as-active'),
      onAction: () => {
        tableRef && (tableRef.getSelectedResources = () => [_id])
        if (isActive) {
          onDeactivate([_id])
        } else {
          onActivate([_id])
        }
        toggleMenuPopover()
      },
    },
    {
      content: t('duplicate'),
      onAction: () => {
        tableRef && (tableRef.getSelectedResources = () => [_id])
        onDuplicate([_id])
        toggleMenuPopover()
      },
    },
    {
      content: t('delete'),
      onAction: () => {
        tableRef && (tableRef.getSelectedResources = () => [_id])
        onDelete([_id])
        toggleMenuPopover()
      },
      destructive: true,
    },
  ]

  return (
    <IndexTable.Row id={_id} key={_id} position={index} onClick={() => {}} selected={selectedResources?.includes(_id)}>
      <IndexTable.Cell>
        <InlineStack gap="200" wrap={false}>
          <InlineStack wrap={false} gap="200" blockAlign="center" align="space-between">
            <Box width="calc(100vw - 100px)">
              <BlockStack gap="100">
                <div
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleRowClick()
                  }}
                >
                  <Link monochrome removeUnderline>
                    <Text variant="bodyMd" as="span" fontWeight="semibold" truncate>
                      {title || t('untitled')}
                    </Text>
                  </Link>
                </div>
                <InlineStack gap="200" align="start">
                  <Badge tone={isActive ? 'success' : undefined}>{isActive ? t('active') : t('draft')}</Badge>
                  <Text variant="bodySm" as="span" tone="subdued">
                    {mapPlacement(typePlacement)}
                  </Text>
                </InlineStack>
                <Text variant="bodySm" as="span" tone="subdued">
                  {t('updated')} {getDistanceToNow(updatedAt)}
                </Text>
              </BlockStack>
            </Box>
            <Box>
              <Popover
                active={menuPopoverActive}
                onClose={toggleMenuPopover}
                activator={<Button icon={MenuHorizontalIcon} variant="tertiary" onClick={toggleMenuPopover} />}
              >
                <ActionList items={actionItems} />
              </Popover>
            </Box>
          </InlineStack>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}
