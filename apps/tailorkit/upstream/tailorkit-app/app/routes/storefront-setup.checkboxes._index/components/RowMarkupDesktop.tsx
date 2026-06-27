import { Badge, IndexTable, Link, Text } from '@shopify/polaris'
import { useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { getDistanceToNow } from '~/bootstrap/fns/time'
import { EPlacementType } from '~/enums/checkbox'
import type { CheckboxDocument } from '~/types/checkbox'

interface RowMarkupDesktopProps {
  checkbox: CheckboxDocument
  index: number
  selectedResources?: string[]
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

export default function RowMarkupDesktop(props: RowMarkupDesktopProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { checkbox, index, selectedResources } = props
  const { _id, title, isActive, typePlacement, updatedAt } = checkbox

  const handleRowClick = () => {
    navigate(`/storefront-setup/checkboxes/edit/${_id}`)
  }

  return (
    <IndexTable.Row
      id={_id}
      key={_id}
      position={index}
      onClick={handleRowClick}
      selected={selectedResources?.includes(_id)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span" truncate>
          <Link monochrome removeUnderline onClick={handleRowClick}>
            {title || t('untitled')}
          </Link>
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={isActive ? 'success' : undefined}>{isActive ? t('active') : t('draft')}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {mapPlacement(typePlacement)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {getDistanceToNow(updatedAt)}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}
