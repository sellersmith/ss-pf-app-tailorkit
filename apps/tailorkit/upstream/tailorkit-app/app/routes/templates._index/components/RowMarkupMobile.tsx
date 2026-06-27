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
  Thumbnail,
} from '@shopify/polaris'
import dateFormat from 'dateformat'
import { getDistanceToNow } from '~/bootstrap/fns/time'
import { ImageIcon, MenuHorizontalIcon } from '@shopify/polaris-icons'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useTranslation } from 'react-i18next'
import { TemplateTitleUIComponent } from '~/modules/TemplateEditor/components/Header/TemplateTitle'
import { IntegratedProducts } from './IntegratedProducts'
import { useCallback, useState } from 'react'

interface RowMarkupMobileProps {
  template: any
  index: number
  selectedResources?: string[]
  products: any
  numProducts: number
  productPopoverActive: number
  tableRef?: any
  onDuplicateTemplate: (selectedIds: string[]) => void
  onDeleteTemplate: (selectedIds: string[]) => void
  toggleProductPopover: (index?: number) => void
  generateRelativeEditorLink: (id: string) => string
  generateAbsoluteEditorLink: (id: string) => string
  onTemplateTitleClick: (template: any, products: any) => void
}

export default function RowMarkupMobile(props: RowMarkupMobileProps) {
  const { t } = useTranslation()
  const {
    template,
    index,
    selectedResources,
    products,
    numProducts,
    productPopoverActive,
    tableRef,
    onDuplicateTemplate,
    onDeleteTemplate,
    toggleProductPopover,
    generateAbsoluteEditorLink,
    onTemplateTitleClick,
  } = props
  const { _id, name, previewUrl, thumbnailUrl, status, createdAt, updatedAt } = template
  const [menuPopoverActive, setMenuPopoverActive] = useState(false)

  const toggleMenuPopover = useCallback(() => {
    setMenuPopoverActive(prev => !prev)
  }, [])

  const openTemplateEditor = useCallback(() => {
    onTemplateTitleClick(template, products)
  }, [onTemplateTitleClick, template, products])

  return (
    <IndexTable.Row id={_id} key={_id} position={index} onClick={() => {}} selected={selectedResources?.includes(_id)}>
      <IndexTable.Cell>
        <InlineStack gap="200" wrap={false}>
          <Box>
            <Thumbnail alt={name} size="small" source={getShopifyThumbnail(thumbnailUrl || previewUrl) || ImageIcon} />
          </Box>
          <InlineStack wrap={false} gap={'200'} blockAlign="center" align="space-between">
            <Box width="calc(100vw - 120px)">
              <BlockStack gap={'100'}>
                <div
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    openTemplateEditor()
                  }}
                >
                  <Link monochrome removeUnderline url={generateAbsoluteEditorLink(_id)}>
                    <TemplateTitleUIComponent name={name} maxWidth="calc(100vw - 102px)" fontWeight="semibold" />
                  </Link>
                </div>
                <Link monochrome removeUnderline onClick={openTemplateEditor}>
                  <Badge tone={status === 'active' ? 'success' : undefined}>{t(status)}</Badge>
                </Link>
                <Popover
                  sectioned
                  fluidContent
                  onClose={toggleProductPopover}
                  active={numProducts > 0 && _id === productPopoverActive}
                  activator={
                    <Button
                      textAlign="left"
                      variant="monochromePlain"
                      id="products-popover-button"
                      disclosure={numProducts > 0 && (_id === productPopoverActive ? 'up' : 'down')}
                    >
                      {numProducts > 1 ? t(`${numProducts} products`) : t(`${numProducts} product`)}
                    </Button>
                  }
                >
                  <IntegratedProducts key={_id} t={t} products={products} />
                </Popover>
                <Box width="fit-content">
                  <InlineStack wrap={false} gap={'200'} align="start">
                    <Text variant="bodyMd" as="span">
                      <Link monochrome removeUnderline onClick={openTemplateEditor}>
                        {dateFormat(createdAt, 'mmm d, yyyy')}
                      </Link>
                    </Text>
                    <Text variant="bodyMd" as="span">
                      •
                    </Text>
                    <Text variant="bodyMd" as="span">
                      <Link monochrome removeUnderline onClick={openTemplateEditor}>
                        {getDistanceToNow(updatedAt)}
                      </Link>
                    </Text>
                  </InlineStack>
                </Box>
              </BlockStack>
            </Box>
            <Box>
              <Popover
                active={menuPopoverActive}
                onClose={toggleMenuPopover}
                activator={<Button icon={MenuHorizontalIcon} variant="tertiary" onClick={toggleMenuPopover} />}
              >
                <ActionList
                  items={[
                    {
                      content: t('duplicate'),
                      onAction: () => {
                        tableRef && (tableRef.getSelectedResources = () => [_id])
                        onDuplicateTemplate([_id])
                      },
                    },
                    {
                      content: t('delete'),
                      onAction: () => {
                        tableRef && (tableRef.getSelectedResources = () => [_id])
                        onDeleteTemplate([_id])
                      },
                      destructive: true,
                    },
                  ]}
                />
              </Popover>
            </Box>
          </InlineStack>
        </InlineStack>
      </IndexTable.Cell>
      {/* <IndexTable.Cell>

      </IndexTable.Cell>
      <IndexTable.Cell>

      </IndexTable.Cell>
      <IndexTable.Cell>

      </IndexTable.Cell>
      <IndexTable.Cell>

      </IndexTable.Cell> */}
    </IndexTable.Row>
  )
}
