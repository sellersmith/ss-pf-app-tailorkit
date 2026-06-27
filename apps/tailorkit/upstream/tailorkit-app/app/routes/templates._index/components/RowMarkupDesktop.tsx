import { Badge, Button, IndexTable, InlineStack, Link, Popover, Text, Thumbnail } from '@shopify/polaris'
import dateFormat from 'dateformat'
import { getDistanceToNow } from '~/bootstrap/fns/time'
import { ImageIcon } from '@shopify/polaris-icons'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useTranslation } from 'react-i18next'
import { TemplateTitleUIComponent } from '~/modules/TemplateEditor/components/Header/TemplateTitle'
import { IntegratedProducts } from './IntegratedProducts'
import { useCallback } from 'react'

interface RowMarkupDesktopProps {
  template: any
  index: number
  selectedResources?: string[]
  products: any
  numProducts: number
  productPopoverActive: number
  toggleProductPopover: (index?: number) => void
  generateRelativeEditorLink: (id: string) => string
  generateAbsoluteEditorLink: (id: string) => string
  onTemplateTitleClick: (template: any, products: any) => void
}

export default function RowMarkupDesktop(props: RowMarkupDesktopProps) {
  const { t } = useTranslation()
  const {
    template,
    index,
    selectedResources,
    products,
    numProducts,
    productPopoverActive,
    toggleProductPopover,
    generateAbsoluteEditorLink,
    onTemplateTitleClick,
  } = props
  const { _id, name, previewUrl, thumbnailUrl, status, createdAt, updatedAt } = template

  const openTemplateEditor = useCallback(() => {
    onTemplateTitleClick(template, products)
  }, [onTemplateTitleClick, template, products])

  return (
    <IndexTable.Row id={_id} key={_id} position={index} onClick={() => {}} selected={selectedResources?.includes(_id)}>
      <IndexTable.Cell>
        <InlineStack gap="200" blockAlign="center">
          <Thumbnail alt={name} size="small" source={getShopifyThumbnail(thumbnailUrl || previewUrl) || ImageIcon} />
          <div
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              openTemplateEditor()
            }}
          >
            <Link monochrome removeUnderline url={generateAbsoluteEditorLink(_id)}>
              <TemplateTitleUIComponent name={name} />
            </Link>
          </div>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Link monochrome removeUnderline onClick={openTemplateEditor}>
          <Badge tone={status === 'active' ? 'success' : undefined}>{t(status)}</Badge>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {numProducts > 0 ? (
          <Popover
            sectioned
            fluidContent
            onClose={toggleProductPopover}
            active={_id === productPopoverActive}
            activator={
              <Button
                textAlign="left"
                variant="monochromePlain"
                id="products-popover-button"
                disclosure={_id === productPopoverActive ? 'up' : 'down'}
              >
                {numProducts.toString()}
              </Button>
            }
          >
            <IntegratedProducts key={_id} t={t} products={products} />
          </Popover>
        ) : (
          '0'
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          <Link monochrome removeUnderline onClick={openTemplateEditor}>
            {dateFormat(createdAt, 'mmm d, yyyy')}
          </Link>
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          <Link monochrome removeUnderline onClick={openTemplateEditor}>
            {getDistanceToNow(updatedAt)}
          </Link>
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}
