import dateFormat from 'dateformat'
import { useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { getDistanceToNow } from '~/bootstrap/fns/time'
import { Text, IndexTable, Badge, Button, Link, Popover, BlockStack, Tooltip } from '@shopify/polaris'
import RowActions from './RowActions'

interface RowMarkupDesktopProps {
  product: any
  index: number
  selectedResources?: string[]
  isVariantPopoverActive: boolean
  variantPopoverActive: number
  isTemplatePopoverActive: boolean
  templatePopoverActive: number
  isPublished: boolean
  isAnyTemplateUpdatedAndPublished: boolean
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

export default function RowMarkupDesktop(props: RowMarkupDesktopProps) {
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

  return (
    <IndexTable.Row id={_id} key={_id} position={index} onClick={() => {}} selected={selectedResources?.includes(_id)}>
      <IndexTable.Cell>
        <div
          style={{ maxWidth: '262px' }}
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
              <Text as="p" variant="bodyMd" truncate>
                {label}
              </Text>
            </Tooltip>
          </Link>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell id={`${_id}-variants`}>
        {variants?.length > 0 ? (
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
                  {variants.length.toString()}
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
        ) : (
          '0'
        )}
      </IndexTable.Cell>
      <IndexTable.Cell id={`${_id}-templates`}>
        {templates?.length > 0 ? (
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
                  {templates.length.toString()}
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
        ) : (
          '0'
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={isPublished ? 'success' : 'enabled'}>{t(status)}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{dateFormat(createdAt, 'mmm d, yyyy')}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{getDistanceToNow(updatedAt)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <RowActions product={product} isAnyTemplateUpdated={isAnyTemplateUpdatedAndPublished} />
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}
