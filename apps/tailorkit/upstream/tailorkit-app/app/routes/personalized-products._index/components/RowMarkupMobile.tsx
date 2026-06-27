import dateFormat from 'dateformat'
import { useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { getDistanceToNow } from '~/bootstrap/fns/time'
import {
  Text,
  IndexTable,
  Badge,
  Button,
  Link,
  Popover,
  BlockStack,
  Tooltip,
  Box,
  InlineStack,
  ActionList,
} from '@shopify/polaris'
import RowActions from './RowActions'
import { MenuHorizontalIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'

interface RowMarkupMobileProps {
  product: any
  index: number
  selectedResources?: string[]
  isVariantPopoverActive: boolean
  variantPopoverActive: number
  isTemplatePopoverActive: boolean
  templatePopoverActive: number
  isPublished: boolean
  isAnyTemplateUpdatedAndPublished: boolean
  handleSelectionChange: (selectedResources: any[]) => void
  setBulkOperation: (operation: 'publish' | 'unpublish' | 'delete') => void
  toggleVariantPopover: (index?: number) => void
  toggleTemplatePopover: (index?: number) => void
  generateRelativeEditorLink: (
    id: string,
    mockupId: string,
    printAreaId?: string,
    templateId?: string,
    viewId?: string
  ) => string
  generateAbsoluteEditorLink: (
    id: string,
    mockupId: string,
    printAreaId?: string,
    templateId?: string,
    viewId?: string
  ) => string
}

export default function RowMarkupMobile(props: RowMarkupMobileProps) {
  const {
    product,
    index,
    selectedResources,
    isVariantPopoverActive,
    variantPopoverActive,
    isTemplatePopoverActive,
    templatePopoverActive,
    isPublished,
    isAnyTemplateUpdatedAndPublished,
    handleSelectionChange,
    setBulkOperation,
    toggleVariantPopover,
    toggleTemplatePopover,
    generateRelativeEditorLink,
    generateAbsoluteEditorLink,
  } = props
  const {
    _id,
    label,
    status,
    createdAt,
    updatedAt,
    denormalizedData: { variants, templates, integration },
    views,
  } = product || {}
  const navigate = useNavigate()
  const { t } = useTranslation()
  const numVariants = variants?.length || 0
  const [menuPopoverActive, setMenuPopoverActive] = useState(false)

  // Resolve printAreaId, templateId, and viewId before navigation
  const firstTemplate = templates?.[0]
  const templateId = firstTemplate?._id
  const firstVariant = variants?.[0]

  // Find the print area that contains this template
  const printAreaId = firstVariant?.printAreas?.find((pa: any) => {
    const paTemplate = pa.template
    // Handle both string ID and populated object
    const paTemplateId = typeof paTemplate === 'string' ? paTemplate : paTemplate?._id
    return paTemplateId === templateId
  })?._id

  // Get the first view ID from the mockup's views array
  const firstView = views?.[0]
  const viewId = typeof firstView === 'string' ? firstView : firstView?._id

  const toggleMenuPopover = useCallback(() => {
    setMenuPopoverActive(prev => !prev)
  }, [])

  return (
    <IndexTable.Row id={_id} key={_id} position={index} onClick={() => {}} selected={selectedResources?.includes(_id)}>
      <IndexTable.Cell>
        <Box width="calc(100vw - 24px)">
          <InlineStack gap="200" wrap={false} align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <div
                style={{ maxWidth: 'calc(100vw - 124px)' }}
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  navigate(generateRelativeEditorLink(integration._id, _id, printAreaId, templateId, viewId))
                }}
              >
                <Link
                  monochrome
                  removeUnderline
                  url={generateAbsoluteEditorLink(integration._id, _id, printAreaId, templateId, viewId)}
                >
                  <Tooltip content={label}>
                    <Text as="p" variant="bodyMd" truncate fontWeight="semibold">
                      {label}
                    </Text>
                  </Tooltip>
                </Link>
              </div>
              {/* Status badge */}
              <Box>
                <Badge tone={isPublished ? 'success' : 'enabled'}>{t(status)}</Badge>
              </Box>
              <Box maxWidth="fit-content">
                <InlineStack gap="100" wrap={false} blockAlign="start">
                  {/* Variants */}
                  <div data-content="variants">
                    <Popover
                      sectioned
                      fluidContent
                      onClose={toggleVariantPopover}
                      active={isVariantPopoverActive}
                      activator={
                        <Button
                          textAlign="left"
                          variant="monochromePlain"
                          id="variants-popover-button"
                          disclosure={_id === variantPopoverActive ? 'up' : 'down'}
                        >
                          {numVariants > 1 ? t(`${numVariants} variants`) : t(`${numVariants} variant`)}
                        </Button>
                      }
                    >
                      <BlockStack gap="200">
                        {variants.map((item: any, index: number) => (
                          <Text key={index} as="span" variant="bodyMd">
                            {item.title}
                          </Text>
                        ))}
                      </BlockStack>
                    </Popover>
                  </div>
                  {/* Templates */}
                  <div data-content="templates">
                    <Popover
                      sectioned
                      fluidContent
                      onClose={toggleTemplatePopover}
                      active={isTemplatePopoverActive}
                      activator={
                        <Button
                          textAlign="left"
                          variant="monochromePlain"
                          id="templates-popover-button"
                          disclosure={_id === templatePopoverActive ? 'up' : 'down'}
                        >
                          {templates.length > 1
                            ? t(`${templates.length} templates`)
                            : t(`${templates.length} template`)}
                        </Button>
                      }
                    >
                      <BlockStack gap="200">
                        {templates.map((item: any, index: number) => (
                          <Text key={index} as="span" variant="bodyMd">
                            {item.name}
                          </Text>
                        ))}
                      </BlockStack>
                    </Popover>
                  </div>
                </InlineStack>
              </Box>
              <InlineStack gap="100" wrap={false} align="start">
                <Text as="span">{dateFormat(createdAt, 'mmm d, yyyy')}</Text>
                <Text as="span">•</Text>
                <Text as="span">{getDistanceToNow(updatedAt)}</Text>
              </InlineStack>
            </BlockStack>

            <InlineStack gap="200" wrap={false} blockAlign="center">
              <RowActions product={product} isAnyTemplateUpdated={isAnyTemplateUpdatedAndPublished} />
              <Popover
                active={menuPopoverActive}
                onClose={toggleMenuPopover}
                activator={
                  <Button
                    icon={MenuHorizontalIcon}
                    variant="tertiary"
                    onClick={toggleMenuPopover}
                    id="menu-popover-button"
                  />
                }
              >
                <ActionList
                  items={[
                    {
                      content: isPublished ? t('unpublish') : t('publish'),
                      onAction: () => {
                        handleSelectionChange([product])
                        isPublished ? setBulkOperation('unpublish') : setBulkOperation('publish')
                      },
                    },
                    {
                      content: t('delete'),
                      destructive: true,
                      onAction: () => {
                        handleSelectionChange([product])
                        setBulkOperation('delete')
                      },
                    },
                  ]}
                />
              </Popover>
            </InlineStack>
          </InlineStack>
        </Box>
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}
