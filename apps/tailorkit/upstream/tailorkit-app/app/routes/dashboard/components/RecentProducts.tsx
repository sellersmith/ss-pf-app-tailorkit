import { useNavigate } from '@remix-run/react'
import { Badge, BlockStack, Box, Button, Card, IndexTable, InlineStack, Link, Popover, Text } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDistanceToNow } from '~/bootstrap/fns/time'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import ListTable from '~/components/ListTable'
import { LIMIT_RECENT_TEMPLATES } from '~/routes/dashboard/constants'
import dateFormat from 'dateformat'
import { useRootLoaderData } from '~/root'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { NavMenuItems } from '~/bootstrap/app-config'
import { IntegrationStatus } from '~/types/integration'

export default function RecentProducts(props: WithTranslationProps) {
  const { t } = props
  const navigate = useNavigate()

  const createProduct = useCallback(() => {
    navigate('/personalized-products?action=create-new')
  }, [navigate])

  const emptyState = useMemo(
    () => (
      <Box paddingBlockEnd="400" paddingInline="400">
        <BlockStack gap="200">
          <Text as="p" variant="bodyMd">
            {t('no-personalized-products-created-yet-let-s-compose-now')}
          </Text>
          <InlineStack>
            <Button variant="primary" onClick={createProduct}>
              {t('create-personalized-product')}
            </Button>
          </InlineStack>
        </BlockStack>
      </Box>
    ),
    [createProduct, t]
  )

  const headings = useMemo(
    () => [
      {
        id: 'personalized-product',
        title: <Text as="span">{t('personalized-product')}</Text>,
      },
      {
        id: 'variants',
        title: <Text as="span">{t('variants')}</Text>,
      },
      {
        id: 'templates',
        title: <Text as="span">{t('templates')}</Text>,
      },
      {
        id: 'status',
        title: <Text as="span">{t('status')}</Text>,
      },
      {
        id: 'date-created',
        title: <Text as="span">{t('date-created')}</Text>,
      },
      {
        id: 'last-updated',
        title: <Text as="span">{t('last-update')}</Text>,
      },
    ],
    [t]
  )

  // Define popover state for products
  const [variantPopoverActive, setVariantPopoverActive] = useState<number>(-1)
  const toggleVariantPopover = useCallback((index?: number) => setVariantPopoverActive(index ?? -1), [])

  const [templatePopoverActive, setTemplatePopoverActive] = useState<number>(-1)
  const toggleTemplatePopover = useCallback((index?: number) => setTemplatePopoverActive(index ?? -1), [])

  useEffect(() => {
    function togglePopoverClick(e: any) {
      const button = e.target.closest('.Polaris-Button--disclosure')

      if (button) {
        if (button.getAttribute('data-state') === 'open') {
          toggleVariantPopover()
          toggleTemplatePopover()
        } else {
          const content = button.closest('[data-content]')?.getAttribute('data-content')

          if (content === 'variants') {
            toggleTemplatePopover()
            toggleVariantPopover(button.closest('tr')?.id)
          } else if (content === 'templates') {
            toggleVariantPopover()
            toggleTemplatePopover(button.closest('tr')?.id)
          }
        }
      } else {
        toggleVariantPopover()
        toggleTemplatePopover()
      }
    }

    document.addEventListener('click', togglePopoverClick)

    return () => document.removeEventListener('click', togglePopoverClick)
  }, [toggleTemplatePopover, toggleVariantPopover])

  // Render rows
  const { shopData: { shopDomain } = {}, PUBLIC_ENV: { APP_HANDLE } = {} } = useRootLoaderData() || {}

  const generateRelativeEditorLink = useCallback(
    (_id: string, mockupId: string) => `${NavMenuItems.PERSONALIZED_PRODUCTS}/${_id}?mockup=${mockupId}`,
    []
  )

  const generateAbsoluteEditorLink = useCallback(
    (_id: string, mockupId: string) => {
      const subdomain = getMyShopifySubdomainName(shopDomain)
      const baseUrl = `https://admin.shopify.com/store/${subdomain}/apps/${APP_HANDLE}`
      return `${baseUrl}${NavMenuItems.PERSONALIZED_PRODUCTS}/${_id}?mockup=${mockupId}`
    },
    [APP_HANDLE, shopDomain]
  )

  const renderRowMarkup = useCallback(
    (product: any, index: number, selectedResources?: string[], ref?: any) => {
      const {
        _id,
        label,
        status,
        createdAt,
        updatedAt,
        denormalizedData: { variants, templates, integration },
      } = product || {}

      const isPublished = status?.toLowerCase() === IntegrationStatus.PUBLISHED
      const isVariantPopoverActive = _id === variantPopoverActive
      const isTemplatePopoverActive = _id === templatePopoverActive

      return (
        <IndexTable.Row
          id={_id}
          key={_id}
          position={index}
          onClick={() => {}}
          selected={selectedResources?.includes(_id)}
        >
          <IndexTable.Cell>
            <div
              style={{ maxWidth: '262px' }}
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                navigate(generateRelativeEditorLink(integration._id, _id))
              }}
            >
              <Link monochrome removeUnderline url={generateAbsoluteEditorLink(integration._id, _id)}>
                <Text as="p" variant="bodyMd" truncate>
                  {label}
                </Text>
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
            <Badge tone={isPublished ? 'success' : 'attention'}>{t(status)}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span">{dateFormat(createdAt, 'mmm d, yyyy')}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span">{getDistanceToNow(updatedAt)}</Text>
          </IndexTable.Cell>
        </IndexTable.Row>
      )
    },
    [
      generateAbsoluteEditorLink,
      generateRelativeEditorLink,
      navigate,
      t,
      templatePopoverActive,
      toggleTemplatePopover,
      toggleVariantPopover,
      variantPopoverActive,
    ]
  )

  return (
    <Card padding={'0'}>
      <BlockStack>
        <Box padding={'400'}>
          <Text variant="headingMd" as="h2">
            <Link url="/personalized-products" removeUnderline>
              {t('recent-personalized-products')}
            </Link>
          </Text>
        </Box>

        <Box paddingBlockEnd={'400'} id="recent-personalized-products">
          <ListTable
            t={t}
            queryKey="name"
            selectable={false}
            showBorder={false}
            showFilter={false}
            headings={headings}
            updatePageUrl={false}
            showPagination={false}
            emptyState={emptyState}
            sort={['updatedAt desc']}
            limit={LIMIT_RECENT_TEMPLATES}
            renderRowMarkup={renderRowMarkup}
            dataSource="/api/personalized-products"
          />
        </Box>
      </BlockStack>
    </Card>
  )
}
